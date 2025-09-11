import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import "./App.css";

// shadcn/ui components
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs";
import { Textarea } from "./components/ui/textarea";
import { Button } from "./components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./components/ui/card";
import { Badge } from "./components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "./components/ui/accordion";
import { Checkbox } from "./components/ui/checkbox";
import { Progress } from "./components/ui/progress";
import { Toaster } from "sonner";
import { toast } from "sonner";
import { ShieldCheck, AlertTriangle, MessageCircle, Send } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function riskClass(score) {
  if (score >= 0.7) return "high";
  if (score >= 0.4) return "mid";
  return "low";
}

function usePoints() {
  const [userPoints, setUserPoints] = useState(() => Number(localStorage.getItem("cgk_points") || 0));
  const [badges, setBadges] = useState(() => JSON.parse(localStorage.getItem("cgk_badges") || "[]"));
  const [community, setCommunity] = useState({ community_total: 0, monthly_goal: 5000 });

  const thresholds = [
    { pts: 50, name: "Safety‑Starter" },
    { pts: 150, name: "Teamplayer" },
    { pts: 300, name: "Aufmerksam" },
  ];

  const refreshCommunity = async () => {
    try {
      const { data } = await axios.get(`${API}/community`);
      setCommunity(data);
    } catch { /* silent */ }
  };

  useEffect(() => { refreshCommunity(); }, []);

  const computeBadges = (pts) => {
    const earned = thresholds.filter(t => pts >= t.pts).map(t => t.name);
    return Array.from(new Set(earned));
  };

  const award = async (points, reason) => {
    const safe = Math.max(1, Math.min(100, Number(points || 0)));
    const next = userPoints + safe;
    const nextBadges = computeBadges(next);
    setUserPoints(next);
    setBadges(nextBadges);
    localStorage.setItem("cgk_points", String(next));
    localStorage.setItem("cgk_badges", JSON.stringify(nextBadges));
    // Update community
    try {
      const { data } = await axios.post(`${API}/points/award`, { points: safe, reason });
      setCommunity(data);
    } catch { /* ignore transient */ }
    toast.success(`+${safe} Punkte`);
  };

  return { userPoints, badges, community, award };
}

function HighlightedText({ text, highlights }) {
  if (!text) return null;
  const N = text.length;
  const mask = new Array(N).fill(null);
  (highlights || []).forEach((h) => {
    const s = Math.max(0, Math.min(N, h.start || 0));
    const e = Math.max(0, Math.min(N, h.end || 0));
    for (let i = s; i < e; i++) {
      const conf = h.confidence || 0;
      if (!mask[i] || conf > mask[i].confidence) {
        mask[i] = { category: h.category || "Risk", confidence: conf };
      }
    }
  });
  const segs = [];
  let i = 0;
  while (i < N) {
    const tag = mask[i];
    let j = i + 1;
    while (j < N && ((mask[j] && tag && mask[j].category === tag.category && mask[j].confidence === tag.confidence) || (!mask[j] && !tag))) j++;
    segs.push({ text: text.slice(i, j), tag });
    i = j;
  }
  return (
    <pre className="highlight-view">
      {segs.map((s, idx) =>
        s.tag ? (
          <span key={idx} className={`hl ${riskClass(s.tag.confidence)}`} title={`${s.tag.category} · ${(s.tag.confidence * 100).toFixed(0)}%`}>
            {s.text}
          </span>
        ) : (
          <span key={idx}>{s.text}</span>
        ),
      )}
    </pre>
  );
}

function ChatCheck() {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const analyze = async () => {
    if (!text.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const { data } = await axios.post(`${API}/classify`, { text });
      setResult(data);
      const lvl = data.overall_risk_score;
      if (lvl >= 0.7) toast.error("Hohes Risiko erkannt. Vorsicht!");
      else if (lvl >= 0.4) toast.warning("Mittleres Risiko erkannt.");
      else toast.success("Kein auffälliges Risiko erkannt.");
    } catch (e) {
      console.error(e);
      toast.error("Analyse fehlgeschlagen. Bitte später erneut versuchen.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="section">
      <div className="panel">
        <div className="panel-left">
          <h2 className="section-title"><ShieldCheck size={22} /> Chat-Check</h2>
          <p className="muted">Füge eine Nachricht ein. Wir prüfen sie auf Cybergrooming-Risiken und schlagen eine kindersichere Antwort vor.</p>
          <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Hier Text einfügen oder tippen..." rows={8} />
          <div className="actions">
            <Button onClick={analyze} disabled={loading || !text.trim()}>
              <Send size={16} className="mr-2" /> {loading ? "Analysiere..." : "Analysieren"}
            </Button>
          </div>
        </div>
        <div className="panel-right">
          <Card className="result-card">
            <CardHeader>
              <CardTitle>Ergebnis</CardTitle>
              <CardDescription>Risiko, Kategorien, sichere Antwort und Markierungen</CardDescription>
            </CardHeader>
            <CardContent>
              {!result ? (
                <div className="placeholder"><MessageCircle className="icon" /><p>Die Auswertung erscheint hier.</p></div>
              ) : (
                <div className="results">
                  <div className="risk">
                    <span className="risk-label">Gesamtrisiko</span>
                    <span className={`risk-score ${riskClass(result.overall_risk_score)}`}>
                      {(result.overall_risk_score * 100).toFixed(1)}%
                    </span>
                  </div>

                  <div className="chips">
                    {result.risk_categories?.map((c, i) => (
                      <Badge key={i} variant="secondary" className="chip">
                        {c.category} · {(c.confidence * 100).toFixed(0)}%
                      </Badge>
                    ))}
                  </div>

                  {result.highlights?.length > 0 && (
                    <div className="highlights-block">
                      <h4>Markierungen im Originaltext</h4>
                      <HighlightedText text={text} highlights={result.highlights} />
                    </div>
                  )}

                  <div className="explanation">
                    <h4>Begründung</h4>
                    <p>{result.explanation}</p>
                  </div>

                  <div className="suggestion">
                    <h4>Sichere Antwort</h4>
                    <Card className="reply"><CardContent className="p-4">{result.suggested_reply}</CardContent></Card>
                  </div>

                  <div className="meta">Dauer: {result.processing_time.toFixed(2)}s</div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Lernhub({ award }) {
  const [guides, setGuides] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      try {
        const { data } = await axios.get(`${API}/guides`);
        setGuides(data);
      } catch (e) {
        toast.error("Konnte Inhalte nicht laden");
      } finally {
        setLoading(false);
      }
    };
    run();
  }, []);

  const isLearned = (gid, idx) => localStorage.getItem(`cgk_learned_${gid}_${idx}`) === "1";
  const markLearned = async (gid, idx) => {
    if (isLearned(gid, idx)) return;
    localStorage.setItem(`cgk_learned_${gid}_${idx}`, "1");
    await award(10, "learn_module");
  };

  return (
    <div className="section">
      <h2 className="section-title"><ShieldCheck size={22} /> Lernhub</h2>
      <p className="muted">Lerne Warnsignale zu erkennen und richtig zu reagieren.</p>
      {loading ? (
        <p className="muted">Lade Inhalte…</p>
      ) : (
        guides.map((g) => (
          <Card key={g.id} className="mb-6">
            <CardHeader><CardTitle>{g.title}</CardTitle></CardHeader>
            <CardContent>
              <Accordion type="single" collapsible>
                {g.sections.map((s, idx) => (
                  <AccordionItem key={idx} value={`sec-${idx}`}>
                    <AccordionTrigger>{s.title}</AccordionTrigger>
                    <AccordionContent>
                      <p className="whitespace-pre-wrap leading-7">{s.content}</p>
                      <div className="actions mt-3">
                        <Button variant="secondary" disabled={isLearned(g.id, idx)} onClick={() => markLearned(g.id, idx)}>
                          {isLearned(g.id, idx) ? "Abgeschlossen" : "Als gelernt markieren (+10)"}
                        </Button>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}

function Report({ award }) {
  const [text, setText] = useState("");
  const [contact, setContact] = useState("");
  const [steps, setSteps] = useState({ s1: false, s2: false, s3: false, s4: false });

  const submit = async () => {
    if (!text.trim()) return toast.error("Bitte beschreibe kurz den Vorfall.");
    try {
      await axios.post(`${API}/reports`, { text, contact: contact || undefined });
      toast.success("Meldung gespeichert. Wir zeigen dir nun wichtige Schritte.");
      setText("");
      setContact("");
    } catch (e) {
      toast.error("Meldung fehlgeschlagen");
    }
  };

  const allChecked = steps.s1 && steps.s2 && steps.s3 && steps.s4;
  const checklistAwarded = localStorage.getItem("cgk_checklist_awarded") === "1";
  const tryAwardChecklist = async () => {
    if (allChecked && !checklistAwarded) {
      localStorage.setItem("cgk_checklist_awarded", "1");
      await award(15, "safety_checklist");
    }
  };

  useEffect(() => { tryAwardChecklist(); }, [steps]);

  const rows = useMemo(() => [
    { key: "s1", label: "Screenshots/Chatverlauf gesichert" },
    { key: "s2", label: "Kontakt blockiert und gemeldet" },
    { key: "s3", label: "Mit Vertrauensperson gesprochen" },
    { key: "s4", label: "Bei Gefahr: 110 in Erwägung gezogen" },
  ], []);

  return (
    <div className="section">
      <h2 className="section-title"><AlertTriangle size={22} /> Melden & Hilfe</h2>
      <p className="muted">Formuliere eine anonyme Meldung und erhalte klare Schritte.</p>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Vorfall beschreiben</CardTitle>
          <CardDescription>Keine Klarnamen nötig. Teile nur, was du teilen möchtest.</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={6} placeholder="Was ist passiert?" />
          <div className="row mt-3">
            <input className="input" placeholder="Kontakt (optional)" value={contact} onChange={(e) => setContact(e.target.value)} />
            <Button className="ml-2" onClick={submit}>Absenden</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Checkliste “Sichere Schritte”</CardTitle>
          <CardDescription>Hake die Schritte ab – das hilft dir und bringt Punkte.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="steps">
            {rows.map((r) => (
              <li key={r.key} className="step-row">
                <Checkbox id={r.key} checked={steps[r.key]} onCheckedChange={(v) => setSteps((s) => ({ ...s, [r.key]: Boolean(v) }))} />
                <label htmlFor={r.key}>{r.label}</label>
              </li>
            ))}
          </ul>
          <div className="mt-3">
            {allChecked ? (
              <span className="pill ok">Checkliste abgeschlossen {checklistAwarded ? "(bereits gutgeschrieben)" : "+15"}</span>
            ) : (
              <span className="muted">Vervollständige alle Schritte (+15 Punkte)</span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Simulator({ award }) {
  const [scenarios, setScenarios] = useState([]);
  const [idx, setIdx] = useState(0);
  const [reply, setReply] = useState("");
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    const run = async () => {
      try {
        const { data } = await axios.get(`${API}/simulator/scenarios`);
        setScenarios(data);
      } catch (e) {
        toast.error("Konnte Szenarien nicht laden");
      }
    };
    run();
  }, []);

  const current = scenarios[idx];

  const evaluate = async () => {
    if (!reply.trim()) return;
    try {
      const { data } = await axios.post(`${API}/classify`, { text: reply });
      setFeedback(data);
      // Punkte einmal pro Szenario vergeben
      const key = `cgk_sim_award_${current?.id}`;
      if (current && !localStorage.getItem(key)) {
        localStorage.setItem(key, "1");
        await award(10, "simulator_answer");
      }
    } catch (e) {
      toast.error("Auswertung fehlgeschlagen");
    }
  };

  return (
    <div className="section">
      <h2 className="section-title"><MessageCircle size={22} /> Simulator</h2>
      {!current ? (
        <p className="muted">Lade Szenarien…</p>
      ) : (
        <>
          <Card className="mb-4">
            <CardHeader>
              <CardTitle>{current.title}</CardTitle>
              <CardDescription>Hinweise: {current.hints?.join(" · ")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bubble incoming">{current.message}</div>
              <div className="bubble me">
                <Textarea value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Deine sichere Antwort…" />
                <div className="actions"><Button onClick={evaluate}>Antwort prüfen (+10)</Button></div>
              </div>
            </CardContent>
          </Card>

          {feedback && (
            <Card>
              <CardHeader>
                <CardTitle>Feedback</CardTitle>
                <CardDescription>Risiko & Verbesserungen</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="risk">
                  <span className="risk-label">Risiko</span>
                  <span className={`risk-score ${riskClass(feedback.overall_risk_score)}`}>
                    {(feedback.overall_risk_score * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="chips">
                  {feedback.risk_categories?.map((c, i) => (
                    <Badge key={i} variant="secondary" className="chip">{c.category} · {(c.confidence * 100).toFixed(0)}%</Badge>
                  ))}
                </div>
                <p className="mt-3">Empfohlene Formulierung:</p>
                <Card className="reply"><CardContent className="p-4">{feedback.suggested_reply}</CardContent></Card>
              </CardContent>
            </Card>
          )}

          <div className="nav">
            <Button variant="secondary" onClick={() => setIdx((p) => Math.max(0, p - 1))} disabled={idx === 0}>Zurück</Button>
            <Button onClick={() => { setIdx((p) => Math.min((scenarios.length - 1), p + 1)); setReply(""); setFeedback(null); }}>Weiter</Button>
          </div>
        </>
      )}
    </div>
  );
}

function AppHeader({ userPoints, badges, community }) {
  const pct = Math.min(100, Math.round((community.community_total / (community.monthly_goal || 1)) * 100));
  return (
    <header className="hero">
      <div className="hero-inner">
        <div>
          <h1>CyberGuard Kids</h1>
          <p>Schützt Kinder & Jugendliche vor Cybergrooming – prüfen, lernen, melden, trainieren.</p>
          <div className="stats">
            <div className="stat">
              <span className="muted">Dein Punktestand</span>
              <div className="score">{userPoints} Punkte</div>
              <div className="badge-row">
                {badges.length === 0 ? <span className="muted small">Sammle Punkte, um Badges freizuschalten</span> : badges.map((b) => (
                  <span key={b} className="mini-badge">{b}</span>
                ))}
              </div>
            </div>
            <div className="stat">
              <span className="muted">Community‑Ziel</span>
              <Progress value={pct} className="progress" />
              <div className="muted small">{community.community_total} / {community.monthly_goal} Punkte</div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

function App() {
  const { userPoints, badges, community, award } = usePoints();

  useEffect(() => {
    // ping health, optional
    axios.get(`${API}/health`).catch(() => {});
  }, []);

  return (
    <div className="app-root">
      <Toaster richColors position="top-center" />
      <AppHeader userPoints={userPoints} badges={badges} community={community} />

      <main className="container">
        <Tabs defaultValue="check">
          <TabsList className="tabs">
            <TabsTrigger value="check">Chat-Check</TabsTrigger>
            <TabsTrigger value="learn">Lernhub</TabsTrigger>
            <TabsTrigger value="report">Melden</TabsTrigger>
            <TabsTrigger value="sim">Simulator</TabsTrigger>
          </TabsList>
          <TabsContent value="check"><ChatCheck /></TabsContent>
          <TabsContent value="learn"><Lernhub award={award} /></TabsContent>
          <TabsContent value="report"><Report award={award} /></TabsContent>
          <TabsContent value="sim"><Simulator award={award} /></TabsContent>
        </Tabs>
      </main>

      <footer className="footer">
        <div className="container small">
          <div className="foot-grid">
            <div>
              <strong>Hinweis</strong>
              <p>Diese App ersetzt keine akute Hilfe. Bei Gefahr: 110 anrufen.</p>
            </div>
            <div className="muted small">© 2025 CyberGuard Kids</div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;