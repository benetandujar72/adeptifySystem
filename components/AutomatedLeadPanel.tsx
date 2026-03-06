import React, { useState, useRef, useEffect } from 'react';
import { useLanguage } from '../LanguageContext';
import { supabase } from '../services/supabaseClient';

interface LeadData {
  id?: string;
  email: string;
  name: string;
  companyDescription: string;
}

interface AIAnalysis {
  needs_detected: string[];
  recommended_services: string[];
  main_bottleneck: string;
  estimated_budget_range: string;
  custom_pitch: string;
  video_script?: string;
  estimated_hours_lost_per_week?: number;
  proposal_data?: any;
  image_prompt?: string;
  company_name?: string;
  recommended_solution?: string;
  contact_email?: string;
  sector?: string;
  client_type?: string;
}

interface AgentEvent {
  agent: string;
  message: string;
  fase: number;
}

const AGENT_LABELS: Record<string, string> = {
  'AG-01': 'Analista Requeriments',
  'AG-02': 'Investigador Mercat',
  'AG-03': 'Auditor Sistemes',
  'AG-04': 'Arquitecte Solucions',
  'AG-05': 'Dissenyador UX/UI',
  'AG-06': 'Especialista Integracions',
  'AG-07': 'Gestor Projecte',
  'AG-08': 'Enginyer DevOps',
  'AG-09': 'Especialista Seguretat',
  'AG-10': 'Analista Financer',
  'AG-11': "Director d'Estil",
  'AG-12': 'Redactor Tècnic',
  'AG-13': 'Gestió del Canvi',
  'AG-14': 'QA / Validador',
};

const FASE_LABELS = ['', 'Fase 1 — Anàlisi', 'Fase 2 — Disseny', 'Fase 3 — Planificació', 'Fase 4 — Documentació', 'Fase 5 — Document Final'];

const AutomatedLeadPanel: React.FC = () => {
  const { t, language } = useLanguage();
  const [lead, setLead] = useState<LeadData>({ email: '', name: '', companyDescription: '' });
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [scrapeUrl, setScrapeUrl] = useState('');
  const [currentStep, setCurrentStep] = useState<number | null>(null);
  const [isTestMode, setIsTestMode] = useState(false);
  const [testEmail] = useState('bandujar@edutac.es');

  // Multi-agent state
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [reportProgress, setReportProgress] = useState<AgentEvent[]>([]);
  const [reportDocxBase64, setReportDocxBase64] = useState<string | null>(null);
  const [reportClientName, setReportClientName] = useState('');
  const [reportFase, setReportFase] = useState(0);
  const [reportError, setReportError] = useState<string | null>(null);
  const [tokenUsage, setTokenUsage] = useState({ input: 0, output: 0, cost_eur: 0, budget_pct: 0 });
  const [reportRawJsonBase64, setReportRawJsonBase64] = useState<string | null>(null);
  const BUDGET_EUR = 5.00; // must match orchestrator BUDGET_STOP_EUR
  const progressRef = useRef<HTMLDivElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (progressRef.current) progressRef.current.scrollTop = progressRef.current.scrollHeight;
  }, [reportProgress]);

  useEffect(() => {
    if (reportError && errorRef.current) {
      errorRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [reportError]);

  useEffect(() => () => { eventSourceRef.current?.close(); }, []);

  const PORTFOLIO = [
    { name: "GESTIÓ DE GUÀRDIES", action: "Automatització total del quadrant de substitucions diàries mitjançant IA." },
    { name: "ASSISTATUT v3.1", action: "Control d'assistència intel·ligent per a 7 classes simultànies amb anàlisi predictiu." },
    { name: "ROYAL MATH", action: "Plataforma gamificada d'aprenentatge matemàtic amb itineraris personalitzats." },
    { name: "qViC v2.0", action: "Sistema de gestió de qualitat educativa certificat i automatitzat." }
  ];

  const steps = [
    "Connectant amb el centre...",
    "Analitzant infraestructura digital...",
    "IA calculant ROI i fuites...",
    "Redactant proposta executiva...",
    "Integrant casos d'èxit Adeptify..."
  ];

  const handleScrapeAndCapture = async () => {
    if (!scrapeUrl) return;
    setIsAnalyzing(true);
    setAnalysis(null);
    setStatusMsg('');
    setCurrentStep(0);
    setReportDocxBase64(null);
    setReportProgress([]);

    const stepInterval = setInterval(() => {
      setCurrentStep(prev => (prev !== null && prev < steps.length - 1 ? prev + 1 : prev));
    }, 3000);

    try {
      const resp = await fetch('/api/automation/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: scrapeUrl, tenantSlug: 'default', lang: language || 'ca' })
      });
      clearInterval(stepInterval);
      const data = await resp.json();

      if (data.company_name) {
        const contactEmail = data.contact_email || `contacto@${new URL(scrapeUrl).hostname.replace('www.', '')}`;
        const dbLead = data.dbLead;

        setLead({ id: dbLead?.id, name: data.company_name, email: contactEmail, companyDescription: data.recommended_solution || '' });
        setAnalysis(data);
        setStatusMsg("Anàlisi ràpida completada. Ara pots generar l'Informe Complet amb 14 Agents IA.");
      } else {
        setStatusMsg("Error: No s'ha pogut extreure informació. Revisa la URL.");
      }
    } catch {
      setStatusMsg('Timeout o error de xarxa.');
    } finally {
      setIsAnalyzing(false);
      setCurrentStep(null);
    }
  };

  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  const handleGenerateFullReport = async () => {
    if (!analysis) return;
    setIsGeneratingReport(true);
    setReportDocxBase64(null);
    setReportProgress([]);
    setReportFase(0);
    setReportError(null);
    setReportRawJsonBase64(null);
    setTokenUsage({ input: 0, output: 0, cost_eur: 0, budget_pct: 0 });
    setStatusMsg('');
    setActiveJobId(null);
    eventSourceRef.current?.close();

    try {
      const datosCliente = {
        cliente: {
          nombre: analysis.company_name || lead.name,
          tipo: analysis.client_type || 'educacion',
          sector: analysis.sector || 'Educació',
          web: scrapeUrl,
          ubicacion: 'Catalunya',
        },
        sistemas_existentes: [],
        proposta: {
          idioma: language || 'ca',
          tipus_projecte: analysis.recommended_solution || 'Transformació digital',
          pressupost_orientatiu: analysis.estimated_budget_range || '8000-15000',
          termini_desitjat: '3-4 mesos',
        },
        contexto_inicial: {
          needs_detected: analysis.needs_detected,
          recommended_services: analysis.recommended_services,
          main_bottleneck: analysis.main_bottleneck,
          custom_pitch: analysis.custom_pitch,
          proposal_data: analysis.proposal_data,
        },
      };

      const startResp = await fetch('/api/automation/full-report/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: scrapeUrl, lang: language || 'ca', datosCliente }),
      });

      if (!startResp.ok) {
        const err = await startResp.json();
        throw new Error(err.error || 'Error iniciant el sistema multi-agent');
      }

      const { jobId, message } = await startResp.json();
      if (message) {
        setStatusMsg(message);
      }
      setActiveJobId(jobId);

      // SSE with auto-reconnect on QUIC/network drops
      // Server sends _cursor in each event; on reconnect we pass ?cursor=N to resume
      let sseCursor = 0;
      let finished = false;
      const MAX_RECONNECTS = 10;
      let reconnectCount = 0;

      const dispatchSSE = (eventType: string, rawData: string) => {
        if (!rawData) return;
        try {
          const data = JSON.parse(rawData);
          // Track cursor for reconnection
          if (data._cursor) sseCursor = data._cursor;

          if (eventType === 'progress') {
            if (data.agent === 'TOKENS') {
              try {
                const t = JSON.parse(data.message);
                setTokenUsage({ input: t.total_input, output: t.total_output, cost_eur: t.cost_eur, budget_pct: t.budget_pct || 0 });
              } catch { /* ignore */ }
              return;
            }
            setReportProgress(prev => [...prev, data]);
            if (data.fase && data.fase > 0) setReportFase(data.fase);
          } else if (eventType === 'complete') {
            finished = true;
            if (data.success) {
              setReportDocxBase64('ready');
              setReportRawJsonBase64('ready');
            }
            setReportClientName(data.clientName || lead.name);
            const msg = data.success
              ? 'Informe complet generat (DOCX + PDF). Descarrega o envia per email.'
              : 'Agents completats. La generació de documents ha fallat — descarrega el JSON per revisar.';
            setReportProgress(prev => [...prev, { agent: 'ORQUESTADOR', message: msg, fase: 5 }]);
            setStatusMsg(msg);
            setIsGeneratingReport(false);
          } else if (eventType === 'error') {
            finished = true;
            const errMsg = data.message || 'Error desconegut';
            setReportError(errMsg);
            setReportProgress(prev => [...prev, { agent: 'ERROR', message: `ERROR: ${errMsg}`, fase: 0 }]);
            setIsGeneratingReport(false);
          }
        } catch { /* ignore parse errors */ }
      };

      const connectSSE = async () => {
        while (!finished && reconnectCount <= MAX_RECONNECTS) {
          const abortCtrl = new AbortController();
          try {
            const url = `/api/automation/full-report/stream/${jobId}${sseCursor ? `?cursor=${sseCursor}` : ''}`;
            const sseResp = await fetch(url, { signal: abortCtrl.signal });

            if (!sseResp.ok || !sseResp.body) {
              throw new Error('SSE connection failed');
            }

            // Reset reconnect counter on successful connection
            reconnectCount = 0;
            const reader = sseResp.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let currentEvent = 'message';

            while (true) {
              const { value, done } = await reader.read();
              if (done) break;
              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split('\n');
              buffer = lines.pop() ?? '';
              for (const line of lines) {
                if (line.startsWith('event:')) {
                  currentEvent = line.slice(6).trim();
                } else if (line.startsWith('data:')) {
                  dispatchSSE(currentEvent, line.slice(5).trim());
                  currentEvent = 'message';
                } else if (line === '') {
                  currentEvent = 'message';
                }
              }
            }

            // Stream ended cleanly (server closed) — if not finished, reconnect
            if (finished) return;
          } catch (err: any) {
            if (err?.name === 'AbortError' || finished) return;
            // Network error (QUIC drop, etc.) — reconnect
          }

          if (finished) return;
          reconnectCount++;
          setReportProgress(prev => [...prev, { agent: 'SSE', message: `Reconnectant... (${reconnectCount}/${MAX_RECONNECTS})`, fase: prev[prev.length - 1]?.fase || 0 }]);
          // Wait before reconnecting (exponential backoff capped at 5s)
          await new Promise(r => setTimeout(r, Math.min(1000 * reconnectCount, 5000)));
        }

        // Exhausted reconnects without finishing
        if (!finished) {
          setReportError('Connexió SSE perduda després de múltiples intents.');
          setReportProgress(prev => [...prev, { agent: 'ERROR', message: 'Connexió SSE perduda. Comprova els logs del servidor.', fase: 0 }]);
          setIsGeneratingReport(false);
        }
      };

      connectSSE();

    } catch (err: any) {
      const msg = err.message || 'Error desconegut';
      setReportError(msg);
      setReportProgress(prev => [...prev, { agent: 'ERROR', message: `ERROR: ${msg}`, fase: 0 }]);
      setIsGeneratingReport(false);
    }
  };

  const downloadFullReport = () => {
    if (!activeJobId) return;
    window.location.href = `/api/automation/full-report/download/${activeJobId}/docx`;
  };

  const downloadRawJson = () => {
    if (!activeJobId) return;
    window.location.href = `/api/automation/full-report/download/${activeJobId}/json`;
  };

  const downloadPdf = () => {
    if (!activeJobId) return;
    window.location.href = `/api/automation/full-report/download/${activeJobId}/pdf`;
  };

  const sendReportByEmail = async () => {
    if (!activeJobId || !lead.email) return;
    setIsSending(true);
    setStatusMsg("Enviant l'informe per email...");
    try {
      // Fetch DOCX and PDF as base64 from the already-generated report
      let docxBase64 = null;
      let pdfBase64 = null;
      try {
        const dResp = await fetch(`/api/automation/full-report/download/${activeJobId}/docx`);
        if (dResp.ok) { const buf = await dResp.arrayBuffer(); const b = new Uint8Array(buf); let bin = ''; for (let i = 0; i < b.byteLength; i++) bin += String.fromCharCode(b[i]); docxBase64 = window.btoa(bin); }
      } catch { /* non-fatal */ }
      try {
        const pResp = await fetch(`/api/automation/full-report/download/${activeJobId}/pdf`);
        if (pResp.ok) { const buf = await pResp.arrayBuffer(); const b = new Uint8Array(buf); let bin = ''; for (let i = 0; i < b.byteLength; i++) bin += String.fromCharCode(b[i]); pdfBase64 = window.btoa(bin); }
      } catch { /* non-fatal */ }

      const recipient = isTestMode ? testEmail : lead.email;
      const resp = await fetch('/api/leads/send-proposal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: lead.id, email: recipient,
          subject: `${isTestMode ? '[TEST] ' : ''}Informe Estratègic Adeptify: ${lead.name}`,
          body: `Hola,\n\nAdjuntem la proposta de transformació digital preparada per Adeptify.es.\n\nSalutacions.`,
          pdfBase64, docxBase64, proposalData: analysis,
        }),
      });
      if (resp.ok) setStatusMsg(`Èxit: Informe enviat a ${recipient}`);
      else throw new Error("Falla en l'enviament");
    } catch (err: any) { setStatusMsg(`Error: ${err.message}`); }
    finally { setIsSending(false); }
  };

  return (
    <div className="max-w-6xl mx-auto p-8 bg-white rounded-[40px] shadow-2xl border border-slate-100 fade-in">
      <header className="flex justify-between items-center mb-10">
        <div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tighter italic">ADEPTIFY LEAD GENERATOR</h2>
          <p className="text-slate-400 text-sm font-bold uppercase tracking-widest mt-1">Portal de Prospecció i Venda Senior</p>
        </div>
        <label className="flex items-center gap-3 cursor-pointer bg-slate-50 border border-slate-200 px-5 py-2.5 rounded-2xl shadow-inner">
          <input type="checkbox" checked={isTestMode} onChange={(e) => setIsTestMode(e.target.checked)} className="w-5 h-5 accent-indigo-600" />
          <span className="text-[10px] font-black uppercase text-slate-500">Mode Test</span>
        </label>
      </header>

      {/* URL Input */}
      <div className="mb-10 p-10 bg-slate-900 rounded-[32px] text-white shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <svg className="w-32 h-32" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" /></svg>
        </div>
        <div className="relative z-10">
          <h3 className="text-2xl font-bold mb-2 italic">Captura Intel·ligent de Centres</h3>
          <p className="text-slate-400 mb-8 text-sm max-w-xl">Introdueix la URL d'una escola o institució. Primer anàlisi ràpida (Gemini), després informe complet professional amb 14 Agents Claude.</p>
          <div className="flex gap-4">
            <input
              type="text"
              className="flex-1 p-5 bg-slate-800 border border-slate-700 rounded-2xl text-white outline-none focus:ring-4 focus:ring-indigo-500/30 transition-all font-mono text-sm"
              placeholder="https://www.centre-educatiu.cat"
              value={scrapeUrl}
              onChange={(e) => setScrapeUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleScrapeAndCapture()}
            />
            <button onClick={handleScrapeAndCapture} disabled={isAnalyzing || !scrapeUrl} className="bg-indigo-600 px-10 py-5 rounded-2xl font-black uppercase text-[11px] tracking-[0.2em] hover:bg-indigo-500 transition-all disabled:opacity-50">
              {isAnalyzing ? 'Explorant...' : 'Investigar'}
            </button>
          </div>
        </div>
      </div>

      {isAnalyzing && (
        <div className="mb-10 grid grid-cols-1 md:grid-cols-5 gap-4">
          {steps.map((s, i) => (
            <div key={i} className={`p-4 rounded-2xl border transition-all duration-700 ${i <= (currentStep || 0) ? 'bg-indigo-50 border-indigo-200' : 'bg-slate-50 border-slate-100 opacity-30'}`}>
              <div className={`w-2 h-2 rounded-full mb-2 ${i < (currentStep || 0) ? 'bg-green-500' : i === currentStep ? 'bg-indigo-600 animate-pulse' : 'bg-slate-300'}`} />
              <p className={`text-[9px] font-black uppercase tracking-tighter ${i === currentStep ? 'text-indigo-600' : 'text-slate-400'}`}>{s}</p>
            </div>
          ))}
        </div>
      )}

      {statusMsg && <div className="mb-10 text-center p-5 bg-indigo-50/50 rounded-2xl text-xs font-black uppercase tracking-widest text-indigo-600 border border-indigo-100">{statusMsg}</div>}

      {analysis && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 border-t border-slate-100 pt-10 fade-in">
          {/* Left */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-slate-50 p-8 rounded-[32px] border border-slate-100">
              <h4 className="text-[10px] font-black uppercase text-slate-400 mb-6 tracking-[0.2em]">Revisió de Dades</h4>
              <div className="space-y-6">
                <div>
                  <label className="text-[9px] font-black uppercase text-slate-400 mb-2 block tracking-widest">Institució</label>
                  <input type="text" value={lead.name} onChange={(e) => setLead({ ...lead, name: e.target.value })} className="w-full p-4 bg-white border border-slate-200 rounded-xl font-bold text-slate-800" />
                </div>
                <div>
                  <label className="text-[9px] font-black uppercase text-slate-400 mb-2 block tracking-widest">Email Target</label>
                  <input type="email" value={lead.email} onChange={(e) => setLead({ ...lead, email: e.target.value })} className="w-full p-4 bg-indigo-50 border border-indigo-200 rounded-xl font-bold text-indigo-700 focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
              </div>
            </div>
            <div className="p-6 border border-slate-100 rounded-[32px]">
              <h4 className="text-[10px] font-black uppercase text-slate-400 mb-4 tracking-[0.2em]">Incloure Casos d'Èxit</h4>
              <div className="space-y-3">
                {PORTFOLIO.map((p, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                    <div className="w-2 h-2 bg-green-500 rounded-full" />
                    <span className="text-[9px] font-bold text-slate-600">{p.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right */}
          <div className="lg:col-span-8 space-y-6">
            {/* Quick preview */}
            <div className="bg-white border-2 border-slate-900 rounded-[40px] p-10 shadow-2xl relative">
              <div className="absolute top-0 right-0 bg-slate-900 text-white px-6 py-2 rounded-bl-3xl text-[9px] font-black uppercase tracking-widest">Adeptify Executive Report</div>
              <div className="flex justify-between items-start mb-12">
                <h4 className="text-3xl font-serif italic text-slate-900">Anàlisi de Transformació</h4>
                <div className="text-right">
                  <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-1">Inversió Estimat</p>
                  <p className="text-2xl font-black text-slate-900">{analysis.estimated_budget_range || '5.000€ - 8.000€'}</p>
                </div>
              </div>
              <div className="mb-12">
                <div className="p-8 bg-slate-50 rounded-3xl border-l-8 border-indigo-600 mb-8">
                  <p className="text-xs font-black text-indigo-600 uppercase mb-4 tracking-widest">Resum Executiu</p>
                  <p className="text-sm text-slate-700 leading-relaxed italic">"{analysis.custom_pitch}"</p>
                </div>
                <div className="grid grid-cols-2 gap-8">
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase mb-4 tracking-widest">Fuites Detectades</p>
                    <ul className="space-y-3">{analysis.needs_detected?.map((n, i) => <li key={i} className="text-xs text-slate-600 flex gap-3"><span className="text-indigo-500 font-bold">●</span>{n}</li>)}</ul>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase mb-4 tracking-widest">Solucions Proposades</p>
                    <ul className="space-y-3">{analysis.recommended_services?.map((s, i) => <li key={i} className="text-xs text-slate-600 flex gap-3"><span className="text-green-500 font-bold">✓</span>{s}</li>)}</ul>
                  </div>
                </div>
              </div>
              {/* Download & send buttons — visible only after multi-agent report completes */}
              {reportDocxBase64 && (
                <div className="flex flex-col md:flex-row gap-3">
                  <button onClick={downloadFullReport} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] hover:bg-indigo-500 transition-all flex items-center justify-center gap-2 shadow-xl shadow-indigo-900/20">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    DOCX
                  </button>
                  <button onClick={downloadPdf} className="flex-1 py-4 bg-red-600 text-white rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] hover:bg-red-500 transition-all flex items-center justify-center gap-2 shadow-xl shadow-red-900/20">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    PDF
                  </button>
                  <button onClick={sendReportByEmail} disabled={isSending || (!lead.email && !isTestMode)} className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] hover:bg-slate-800 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                    {isSending ? 'ENVIANT...' : 'ENVIAR PER EMAIL'}
                  </button>
                </div>
              )}
              {!reportDocxBase64 && !isGeneratingReport && (
                <p className="text-center text-[9px] text-slate-400 mt-2 tracking-wide">Genera l'informe complet amb el sistema multi-agent per descarregar i enviar</p>
              )}
            </div>

            {/* ─── Multi-Agent Full Report ─── */}
            <div className="bg-gradient-to-br from-slate-900 to-indigo-950 rounded-[40px] p-10 text-white shadow-2xl">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`w-3 h-3 rounded-full ${reportError ? 'bg-red-500' : 'bg-indigo-400 animate-pulse'}`} />
                    <span className="text-[9px] font-black uppercase tracking-[0.3em] text-indigo-300">Sistema Multi-Agent Claude</span>
                  </div>
                  <h3 className="text-2xl font-black">Informe Complet — 14 Agents IA</h3>
                  <p className="text-slate-400 text-xs mt-1">13 seccions · DOCX + PDF · Portada · ROI · Cronograma · RGPD · Change Management</p>
                </div>
                <div className="flex flex-col gap-2 ml-4 shrink-0">
                  {reportDocxBase64 && (
                    <button onClick={downloadFullReport} className="bg-green-500 hover:bg-green-400 text-white px-5 py-2.5 rounded-2xl font-black uppercase text-[9px] tracking-widest transition-all shadow-lg flex items-center gap-2">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                      .docx
                    </button>
                  )}
                  {reportDocxBase64 && (
                    <button onClick={downloadPdf} className="bg-red-500 hover:bg-red-400 text-white px-5 py-2.5 rounded-2xl font-black uppercase text-[9px] tracking-widest transition-all shadow-lg flex items-center gap-2">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                      .pdf
                    </button>
                  )}
                  {reportRawJsonBase64 && (
                    <button onClick={downloadRawJson} className="bg-slate-600 hover:bg-slate-500 text-slate-200 px-5 py-2.5 rounded-2xl font-black uppercase text-[9px] tracking-widest transition-all flex items-center gap-2">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                      json
                    </button>
                  )}
                </div>
              </div>

              {/* Token usage live counter */}
              {(isGeneratingReport || tokenUsage.input > 0) && (
                <div className="mb-4 space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-slate-800/60 rounded-xl p-3 text-center">
                      <div className="text-[8px] font-black uppercase text-slate-400 mb-1">Tokens entrada</div>
                      <div className="text-sm font-black text-indigo-300 font-mono">{tokenUsage.input.toLocaleString()}</div>
                    </div>
                    <div className="bg-slate-800/60 rounded-xl p-3 text-center">
                      <div className="text-[8px] font-black uppercase text-slate-400 mb-1">Tokens sortida</div>
                      <div className="text-sm font-black text-purple-300 font-mono">{tokenUsage.output.toLocaleString()}</div>
                    </div>
                    <div className={`rounded-xl p-3 text-center ${tokenUsage.budget_pct >= 80 ? 'bg-red-900/60 border border-red-700/50' : tokenUsage.budget_pct >= 50 ? 'bg-amber-900/40' : 'bg-slate-800/60'}`}>
                      <div className="text-[8px] font-black uppercase text-slate-400 mb-1">Cost · Límit {BUDGET_EUR}€</div>
                      <div className={`text-sm font-black font-mono ${tokenUsage.budget_pct >= 80 ? 'text-red-400' : tokenUsage.budget_pct >= 50 ? 'text-amber-300' : 'text-amber-300'}`}>
                        {tokenUsage.cost_eur.toFixed(3)} €
                      </div>
                    </div>
                  </div>
                  {/* Budget progress bar */}
                  <div>
                    <div className="flex justify-between text-[8px] font-black uppercase text-slate-500 mb-1">
                      <span>Pressupost consumit</span>
                      <span className={tokenUsage.budget_pct >= 80 ? 'text-red-400' : ''}>{tokenUsage.budget_pct}%</span>
                    </div>
                    <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${tokenUsage.budget_pct >= 80 ? 'bg-red-500' : tokenUsage.budget_pct >= 50 ? 'bg-amber-400' : 'bg-emerald-500'}`}
                        style={{ width: `${Math.max(tokenUsage.budget_pct > 0 ? 3 : 0, Math.min(100, tokenUsage.budget_pct))}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Progress log */}
              {(isGeneratingReport || reportProgress.length > 0) && (
                <div className="mb-6">
                  <div className="flex gap-1.5 mb-3">
                    {[1, 2, 3, 4, 5].map(f => (
                      <div key={f} className={`flex-1 h-1.5 rounded-full transition-all duration-700 ${reportError ? 'bg-red-700' : f <= reportFase ? 'bg-indigo-400' : 'bg-slate-700'}`} />
                    ))}
                  </div>
                  {reportFase > 0 && !reportError && <p className="text-[9px] font-black uppercase tracking-[0.2em] text-indigo-300 mb-2">{FASE_LABELS[reportFase]}</p>}
                  <div ref={progressRef} className="bg-slate-800/60 rounded-2xl p-4 max-h-52 overflow-y-auto space-y-1 font-mono text-xs">
                    {reportProgress.map((ev, i) => {
                      const isErr = ev.agent === 'ERROR';
                      const isDone = !isErr && (ev.message.includes('completat') || ev.message.includes('completada') || ev.message.includes('Informe'));
                      return (
                        <div key={i} ref={isErr ? errorRef : undefined}
                          className={`flex items-start gap-3 ${isErr ? 'text-red-400 font-bold' : isDone ? 'text-green-400' : 'text-slate-300'}`}>
                          <span className={`shrink-0 font-black text-[10px] ${isErr ? 'text-red-500' : 'text-indigo-400'}`}>{ev.agent}</span>
                          <span>{ev.message}</span>
                        </div>
                      );
                    })}
                    {isGeneratingReport && !reportError && (
                      <div className="flex items-center gap-2 text-indigo-300 pt-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-ping" />
                        <span>Processant agents...</span>
                      </div>
                    )}
                  </div>

                  {/* Error callout */}
                  {reportError && (
                    <div ref={errorRef} className="mt-3 p-4 bg-red-900/40 border border-red-700/60 rounded-2xl">
                      <p className="text-[9px] font-black uppercase text-red-400 mb-1 tracking-widest">Error detectat</p>
                      <p className="text-xs text-red-300 font-mono">{reportError}</p>
                      <button onClick={handleGenerateFullReport} className="mt-3 px-4 py-2 bg-red-700 hover:bg-red-600 text-white text-[9px] font-black uppercase rounded-xl tracking-widest transition-all">
                        Reintenta
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Agent grid (idle) */}
              {!isGeneratingReport && reportProgress.length === 0 && (
                <div className="grid grid-cols-7 gap-2 mb-6">
                  {Object.entries(AGENT_LABELS).map(([id, label]) => (
                    <div key={id} className="text-center p-2 bg-slate-800/50 rounded-xl border border-slate-700/50">
                      <div className="text-[8px] font-black text-indigo-300">{id}</div>
                      <div className="text-[7px] text-slate-400 mt-0.5 leading-tight">{label.split(' ').slice(0, 2).join(' ')}</div>
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={reportError ? handleGenerateFullReport : handleGenerateFullReport}
                disabled={isGeneratingReport || !!reportDocxBase64}
                className={`w-full py-6 rounded-2xl font-black uppercase tracking-[0.2em] text-[11px] transition-all flex items-center justify-center gap-3 ${reportDocxBase64
                  ? 'bg-green-600/20 text-green-300 cursor-default border border-green-700/30'
                  : reportError
                    ? 'bg-red-600 hover:bg-red-500 text-white shadow-xl shadow-red-900/40 cursor-pointer'
                    : isGeneratingReport
                      ? 'bg-indigo-800/60 text-indigo-300 cursor-wait'
                      : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-xl shadow-indigo-900/40 hover:shadow-indigo-900/60'
                  }`}
              >
                {reportDocxBase64 ? (
                  <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> Informe Generat — DOCX + PDF disponibles</>
                ) : reportError ? (
                  <><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg> ERROR — Clica per Reintentar</>
                ) : isGeneratingReport ? (
                  <><div className="w-4 h-4 border-2 border-indigo-300 border-t-transparent rounded-full animate-spin" /> Generant Informe ({reportProgress.filter(e => e.message.includes('completat') || e.message.includes('completada')).length}/14)...</>
                ) : (
                  <><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg> Generar Informe Complet (14 Agents IA)</>
                )}
              </button>
              {!isGeneratingReport && !reportDocxBase64 && !reportError && (
                <p className="text-center text-[9px] text-slate-500 mt-3 tracking-wide">Temps estimat: 8-12 min · 14 Agents IA · 13 seccions · DOCX + PDF + Email automàtic</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AutomatedLeadPanel;
