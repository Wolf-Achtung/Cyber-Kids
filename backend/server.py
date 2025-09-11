from fastapi import FastAPI, APIRouter, HTTPException, Depends, Body
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timezone
import asyncio

# Optional OpenAI integration (uses Emergent LLM key if present)
try:
    from openai import AsyncOpenAI
except Exception:  # pragma: no cover
    AsyncOpenAI = None  # Will be handled in health check and classify fallback

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection (MUST use env)
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app and prefixed router
app = FastAPI()
api_router = APIRouter(prefix="/api")

# Configure CORS (env-driven). Do not hardcode URLs.
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# --------- Models ---------
class StatusCheck(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class StatusCheckCreate(BaseModel):
    client_name: str

class RiskCategory(BaseModel):
    category: str
    confidence: float
    description: str

class ClassificationRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=10000)

class ClassificationResponse(BaseModel):
    risk_categories: List[RiskCategory]
    overall_risk_score: float
    explanation: str
    suggested_reply: str
    processing_time: float

class ReportCreate(BaseModel):
    text: str = Field(..., min_length=1, max_length=10000)
    contact: Optional[str] = None

class ReportResponse(BaseModel):
    id: str
    created_at: datetime

class GuideSection(BaseModel):
    title: str
    content: str

class Guide(BaseModel):
    id: str
    title: str
    sections: List[GuideSection]

# --------- Helpers ---------

def _safe_now() -> datetime:
    return datetime.now(timezone.utc)

async def _insert_once_collection_flag(collection_name: str, flag_id: str) -> bool:
    """Ensure we insert only once; returns True if insert should proceed."""
    existing = await db.initialization_flags.find_one({"_id": flag_id})
    if existing:
        return False
    await db.initialization_flags.insert_one({"_id": flag_id, "created_at": _safe_now().isoformat()})
    return True

async def _import_docx_from_url(url: str) -> Optional[Guide]:
    """Fetch a .docx from URL and store as a guide. Best-effort; never raise."""
    try:
        import tempfile
        import requests
        from docx import Document

        logger.info(f"Attempting to import guide from: {url}")
        resp = requests.get(url, timeout=20)
        resp.raise_for_status()
        with tempfile.NamedTemporaryFile(suffix=".docx", delete=False) as f:
            f.write(resp.content)
            temp_path = f.name
        doc = Document(temp_path)

        title = "Cybergrooming – Leitfaden"
        sections: List[GuideSection] = []
        current_title = "Einführung"
        current_content = []
        for p in doc.paragraphs:
            txt = (p.text or '').strip()
            if not txt:
                continue
            # naive heading detection: uppercase lines as section headers
            if len(txt) <= 100 and txt.isupper():
                if current_content:
                    sections.append(GuideSection(title=current_title, content='\n'.join(current_content)))
                    current_content = []
                current_title = txt.title()
            else:
                current_content.append(txt)
        if current_content:
            sections.append(GuideSection(title=current_title, content='\n'.join(current_content)))

        guide_obj = Guide(id=str(uuid.uuid4()), title=title, sections=sections)
        await db.guides.insert_one({
            "id": guide_obj.id,
            "title": guide_obj.title,
            "sections": [s.model_dump() for s in guide_obj.sections],
            "created_at": _safe_now().isoformat()
        })
        logger.info("Guide import successful")
        return guide_obj
    except Exception as e:  # pragma: no cover
        logger.warning(f"Guide import skipped: {e}")
        return None

async def initialize_seed_data():
    # Seed a simple simulator scenario set
    try:
        if await _insert_once_collection_flag("simulator", "seed_scenarios_v1"):
            scenarios = [
                {
                    "id": str(uuid.uuid4()),
                    "title": "Unbekannte Freundschaftsanfrage",
                    "message": "Hey, sag mal wie alt bist du? Schickst du mir ein Foto nur für mich?",
                    "hints": ["Fragen nach Alter &amp; Fotos", "Privat &amp; geheim"],
                },
                {
                    "id": str(uuid.uuid4()),
                    "title": "Treffen-Vorschlag",
                    "message": "Wir sollten uns mal nur wir zwei treffen. Sag's lieber niemandem.",
                    "hints": ["Treffen", "Geheimhaltung"],
                },
                {
                    "id": str(uuid.uuid4()),
                    "title": "Geschenk Lockmittel",
                    "message": "Ich kann dir In-Game-Geld schenken, wenn du mir schreibst, wo du wohnst.",
                    "hints": ["Geschenke", "Persönliche Daten"],
                },
            ]
            await db.simulator_scenarios.insert_many(scenarios)
    except Exception as e:  # pragma: no cover
        logger.warning(f"Simulator seeding issue: {e}")

    # Best-effort guide import from user's provided URL
    try:
        if await _insert_once_collection_flag("guides", "seed_guide_cybergrooming_docx_v1"):
            url = "https://customer-assets.emergentagent.com/job_30a6fdc8-b7c0-4978-9269-6e43b5538df0/artifacts/hxk084k9_cybergrooming-infos.docx"
            await _import_docx_from_url(url)
    except Exception as e:  # pragma: no cover
        logger.warning(f"Guide seeding issue: {e}")

# --------- OpenAI Utilities ---------

def get_openai_client() -> Optional[AsyncOpenAI]:
    """Return AsyncOpenAI client if available and key provided."""
    if AsyncOpenAI is None:
        return None
    api_key = os.environ.get('EMERGENT_LLM_KEY') or os.environ.get('OPENAI_API_KEY')
    if not api_key:
        return None
    try:
        return AsyncOpenAI(api_key=api_key)
    except Exception as e:  # pragma: no cover
        logger.warning(f"OpenAI client init failed: {e}")
        return None

async def llm_classify(text: str) -> ClassificationResponse:
    import time
    start = time.time()

    # Attempt LLM path
    client = get_openai_client()
    model_pref = os.environ.get('OPENAI_MODEL', 'gpt-4o-mini')

    system_prompt = (
        "Du bist ein Content-Safety-Analyst mit Fokus auf Cybergrooming-Prävention. "
        "Analysiere Nachrichten, erkenne Risiken (mit 0.0-1.0) und schlage eine sichere Antwort vor."
    )
    user_prompt = f"""
Analysiere folgenden Text auf mögliche Grooming-Risiken. Antworte als JSON mit Feldern:
- risk_categories: Liste von Objekten {{category, confidence, description}}
- overall_risk_score: Zahl [0..1]
- explanation: Text
- suggested_reply: kurze kindersichere Antwort

TEXT:\n{text}
"""

    if client:
        try:
            resp = await client.chat.completions.create(
                model=model_pref,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.1,
                max_tokens=500,
                response_format={"type": "json_object"},
            )
            content = resp.choices[0].message.content or "{}"
            import json
            data = json.loads(content)
            # Validate and coerce
            cats = []
            for c in data.get("risk_categories", [])[:10]:
                try:
                    cats.append(RiskCategory(
                        category=str(c.get("category", "Unknown"))[:64],
                        confidence=float(c.get("confidence", 0.0)),
                        description=str(c.get("description", "")).strip()[:500],
                    ))
                except Exception:
                    continue
            overall = float(data.get("overall_risk_score", max([x.confidence for x in cats], default=0.0)))
            explanation = str(data.get("explanation", "")).strip() or "Analyse abgeschlossen."
            suggested = str(data.get("suggested_reply", "")).strip() or "Ich möchte darüber mit einem Erwachsenen sprechen."
            return ClassificationResponse(
                risk_categories=cats or [
                    RiskCategory(category="Unklar", confidence=0.1, description="Keine klare Kategorie erkannt")
                ],
                overall_risk_score=max(0.0, min(1.0, overall)),
                explanation=explanation,
                suggested_reply=suggested,
                processing_time=time.time() - start,
            )
        except Exception as e:
            logger.warning(f"LLM classify failed, falling back: {e}")

    # Fallback: lightweight heuristic if LLM unavailable
    text_l = text.lower()
    rules = [
        ("Secrecy Requests", 0.9, any(k in text_l for k in ["secret", "don't tell", "privat", "geheim"])) ,
        ("Meeting Requests", 0.8, any(k in text_l for k in ["meet", "treffen", "come over", "visit"])) ,
        ("Personal Information Seeking", 0.7, any(k in text_l for k in ["age", "wie alt", "where do you live", "schule"])) ,
        ("Sexual Content", 0.95, any(k in text_l for k in ["nude", "sext", "sex", "kuss", "foto nur für mich"])) ,
        ("Gift Offering", 0.6, any(k in text_l for k in ["gift", "geschenk", "geld", "robux"])) ,
    ]
    cats = [RiskCategory(category=n, confidence=s, description=f"Heuristik erkannte Muster für {n}.") for n, s, cond in rules if cond]
    if not cats:
        cats = [RiskCategory(category="Safe Content", confidence=0.9, description="Kein auffälliges Muster gefunden.")]
        overall = 0.1
        suggested = "Danke für die Nachricht!"
        explanation = "Die Nachricht wirkt unbedenklich."
    else:
        overall = max(c.confidence for c in cats)
        suggested = "Ich fühle mich unwohl und werde mit einer vertrauten Person darüber sprechen."
        explanation = f"Es wurden {len(cats)} Risikokategorien erkannt. Bitte vorsichtig sein."

    import time as _t
    return ClassificationResponse(
        risk_categories=cats,
        overall_risk_score=overall,
        explanation=explanation,
        suggested_reply=suggested,
        processing_time=_t.time() - start,
    )

# --------- Routes ---------
@api_router.get("/")
async def root():
    return {"message": "CyberGuard API running"}

@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_obj = StatusCheck(client_name=input.client_name)
    await db.status_checks.insert_one(status_obj.model_dump())
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    status_checks = await db.status_checks.find().to_list(500)
    return [StatusCheck(**sc) for sc in status_checks]

@api_router.get("/health")
async def health():
    key_present = bool(os.environ.get('EMERGENT_LLM_KEY') or os.environ.get('OPENAI_API_KEY'))
    return {
        "status": "ok",
        "mongo": True,
        "llm_ready": key_present and (AsyncOpenAI is not None),
    }

@api_router.post("/classify", response_model=ClassificationResponse)
async def classify(req: ClassificationRequest):
    try:
        result = await llm_classify(req.text)
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Classification error: {e}")
        raise HTTPException(status_code=500, detail="Classification failed")

@api_router.get("/guides", response_model=List[Guide])
async def get_guides():
    items = await db.guides.find().to_list(20)
    guides: List[Guide] = []
    for g in items:
        try:
            sections = [GuideSection(**s) for s in g.get("sections", [])]
            guides.append(Guide(id=g["id"], title=g.get("title", "Guide"), sections=sections))
        except Exception:
            continue
    # If empty, provide minimal built-in tips
    if not guides:
        guides = [
            Guide(
                id=str(uuid.uuid4()),
                title="Schnell-Tipps gegen Cybergrooming",
                sections=[
                    GuideSection(title="Nicht teilen", content="Keine Adresse, Schule, Telefonnummer teilen."),
                    GuideSection(title="Screenshots sichern", content="Beweise sichern, bevor du blockierst."),
                    GuideSection(title="Vertrauensperson", content="Rede mit Eltern, Lehrkraft oder Beratung."),
                ],
            )
        ]
    return guides

@api_router.post("/reports", response_model=ReportResponse)
async def create_report(r: ReportCreate):
    rid = str(uuid.uuid4())
    now = _safe_now()
    await db.reports.insert_one({
        "id": rid,
        "text": r.text,
        "contact": r.contact,
        "created_at": now.isoformat(),
    })
    return ReportResponse(id=rid, created_at=now)

@api_router.get("/simulator/scenarios")
async def scenarios():
    items = await db.simulator_scenarios.find().to_list(50)
    # Fallback if not seeded yet
    if not items:
        await initialize_seed_data()
        items = await db.simulator_scenarios.find().to_list(50)
    return items

# Include router
app.include_router(api_router)

@app.on_event("startup")
async def on_startup():
    # Best-effort async initializations
    asyncio.create_task(initialize_seed_data())

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()