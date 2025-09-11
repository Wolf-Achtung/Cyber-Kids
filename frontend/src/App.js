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

function Lernhub() {
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

function Report() {
  const [text, setText] = useState("");
  const [contact, setContact] = useState("");
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

  const steps = useMemo(() => [
    { icon: "📸", title: "Beweise sichern", text: "Screenshots/Chatverlauf sichern." },
    { icon: "🚫", title: "Blockieren & Melden", text: "Im jeweiligen Dienst blockieren und melden." },
    { icon: "👨‍👩‍👧", title: "Vertrauensperson", text: "Mit Eltern/Lehrkraft/Beratungsstelle sprechen." },
    { icon: "👮", title: "Polizei/110", text: "Bei akuter Gefahr sofort 110 anrufen." },
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
          <CardTitle>Nächste Schritte</CardTitle>
          <CardDescription>Konkrete, direkt umsetzbare Hinweise</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="steps">
            {steps.map((s, i) => (
              <li key={i}><span className="step-emoji">{s.icon}</span><strong>{s.title}:</strong> {s.text}</li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function Simulator() {
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
                <div className="actions"><Button onClick={evaluate}>Antwort prüfen</Button></div>
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

function App() {
  const [health, setHealth] = useState(null);
  useEffect(() => {
    axios.get(`${API}/health`).then(({ data }) => setHealth(data)).catch(() => setHealth({ status: "error" }));
  }, []);

  return (
    <div className="app-root">
      <Toaster richColors position="top-center" />
      <header className="hero">
        <div className="hero-inner">
          <div>
            <h1>CyberGuard Kids</h1>
            <p>Schützt Kinder & Jugendliche vor Cybergrooming – prüfen, lernen, melden, trainieren.</p>
            {health && (
              <div className="health">
                <span className={`pill ${health.llm_ready ? "ok" : "warn"}`}>KI {health.llm_ready ? "aktiv" : "inaktiv"}</span>
                <span className="pill">Backend {health.status}</span>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="container">
        <Tabs defaultValue="check">
          <TabsList className="tabs">
            <TabsTrigger value="check">Chat-Check</TabsTrigger>
            <TabsTrigger value="learn">Lernhub</TabsTrigger>
            <TabsTrigger value="report">Melden</TabsTrigger>
            <TabsTrigger value="sim">Simulator</TabsTrigger>
          </TabsList>
          <TabsContent value="check"><ChatCheck /></TabsContent>
          <TabsContent value="learn"><Lernhub /></TabsContent>
          <TabsContent value="report"><Report /></TabsContent>
          <TabsContent value="sim"><Simulator /></TabsContent>
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