import React, { useState, useRef, useEffect } from 'react';
import { useLanguage } from '../LanguageContext';
import { supabase } from '../services/supabaseClient';
import { jsPDF } from 'jspdf';

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
  const [tokenUsage, setTokenUsage] = useState({ input: 0, output: 0, cost_eur: 0 });
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
        const { data: dbLead } = await supabase!
          .from('leads')
          .upsert({ tenant_slug: 'default', email: contactEmail, company_name: data.company_name, source: scrapeUrl, ai_needs_analysis: data, status: 'new' }, { onConflict: 'tenant_slug,email' })
          .select().single();

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

  const handleGenerateFullReport = async () => {
    if (!analysis) return;
    setIsGeneratingReport(true);
    setReportDocxBase64(null);
    setReportProgress([]);
    setReportFase(0);
    setReportError(null);
    setTokenUsage({ input: 0, output: 0, cost_eur: 0 });
    setStatusMsg('');
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

      const { jobId } = await startResp.json();
      const es = new EventSource(`/api/automation/full-report/stream/${jobId}`);
      eventSourceRef.current = es;

      es.addEventListener('progress', (e: MessageEvent) => {
        const data = JSON.parse(e.data) as AgentEvent & { message: string };
        // TOKENS event: update token counter, don't add to log
        if (data.agent === 'TOKENS') {
          try {
            const t = JSON.parse(data.message);
            setTokenUsage({ input: t.total_input, output: t.total_output, cost_eur: t.cost_eur });
          } catch { /* ignore */ }
          return;
        }
        setReportProgress(prev => [...prev, data]);
        if (data.fase && data.fase > 0) setReportFase(data.fase);
      });

      es.addEventListener('complete', (e: MessageEvent) => {
        const data = JSON.parse(e.data);
        setReportDocxBase64(data.docxBase64);
        setReportClientName(data.clientName || lead.name);
        setReportProgress(prev => [...prev, { agent: 'ORQUESTADOR', message: 'Informe complet generat correctament!', fase: 5 }]);
        setStatusMsg('Informe de 14 Agents completat. Descarrega el document Word.');
        setIsGeneratingReport(false);
        es.close();
      });

      es.addEventListener('error', (e: MessageEvent) => {
        const data = e.data ? JSON.parse(e.data) : { message: 'Error desconegut al servidor' };
        const errMsg = data.message || 'Error desconegut';
        setReportError(errMsg);
        setReportProgress(prev => [...prev, { agent: 'ERROR', message: `ERROR: ${errMsg}`, fase: 0 }]);
        setIsGeneratingReport(false);
        es.close();
      });

      // onerror fires on connection issues — distinguish real errors from reconnects
      es.onerror = () => {
        if (es.readyState === EventSource.CONNECTING) return; // auto-reconnect, wait
        if (es.readyState === EventSource.CLOSED) return;
        const msg = 'Connexió SSE perduda (timeout o xarxa). Comprova els logs del servidor.';
        setReportError(msg);
        setReportProgress(prev => [...prev, { agent: 'ERROR', message: msg, fase: 0 }]);
        setIsGeneratingReport(false);
        es.close();
      };
    } catch (err: any) {
      const msg = err.message || 'Error desconegut';
      setReportError(msg);
      setReportProgress(prev => [...prev, { agent: 'ERROR', message: `ERROR: ${msg}`, fase: 0 }]);
      setIsGeneratingReport(false);
    }
  };

  const downloadFullReport = () => {
    if (!reportDocxBase64) return;
    const bytes = Uint8Array.from(atob(reportDocxBase64), c => c.charCodeAt(0));
    const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Proposta_Adeptify_${(reportClientName || lead.name).replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.docx`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const buildMappedDocxData = () => analysis ? { ...analysis.proposal_data, image_prompt: analysis.image_prompt, custom_pitch: analysis.custom_pitch, company_name: analysis.company_name, estimated_budget_range: analysis.estimated_budget_range, recommended_solution: analysis.recommended_solution } : {};

  const generateAndSendProposal = async () => {
    if (!analysis) return;
    setIsSending(true);
    setStatusMsg('Generant proposta oficial...');
    try {
      const doc = new jsPDF();
      const primary = [79, 70, 229]; const slate = [30, 41, 59];
      doc.setFillColor(primary[0], primary[1], primary[2]); doc.rect(0, 0, 210, 60, 'F');
      doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(28);
      doc.text("ADEPTIFY SYSTEMS", 20, 35); doc.setFontSize(12);
      doc.text(t.report_subtitle || "CONSULTORIA ESTRATÈGICA EN INTEL·LIGÈNCIA ARTIFICIAL", 20, 45);
      doc.setTextColor(slate[0], slate[1], slate[2]); doc.setFontSize(14);
      doc.text(t.report_title || "INFORME D'AUDITORIA I PROPOSTA DE TRANSFORMACIÓ", 20, 80);
      doc.setFontSize(11); doc.setFont("helvetica", "normal");
      doc.text(`${t.report_prepared || "PREPARAT PER A:"} ${lead.name.toUpperCase()}`, 20, 90);
      doc.text(`${t.report_date || "DATA:"} ${new Date().toLocaleDateString()}`, 20, 97);
      doc.setDrawColor(226, 232, 240); doc.line(20, 105, 190, 105);
      doc.setFont("helvetica", "bold"); doc.text(t.report_section1 || "1. RESUM EXECUTIU", 20, 115);
      doc.setFont("helvetica", "normal"); doc.setFontSize(10);
      doc.text(doc.splitTextToSize(analysis.custom_pitch, 170), 20, 125);
      let y = 160; doc.setFont("helvetica", "bold");
      doc.text(t.report_section2 || "2. SOLUCIONS ESTRATÈGIQUES SUGGERIDES", 20, y);
      doc.setFont("helvetica", "normal");
      (analysis.recommended_services || []).forEach(s => { y += 8; doc.text(`✓ ${s}`, 25, y); });
      doc.addPage(); y = 30; doc.setFont("helvetica", "bold"); doc.setFontSize(14);
      doc.text(t.report_section3 || "3. ELS NOSTRES SERVEIS PER A CENTRES EDUCATIUS", 20, y);
      y += 15;
      PORTFOLIO.forEach(p => {
        doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.text(p.name, 20, y);
        doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.text(doc.splitTextToSize(p.action, 160), 25, y + 7); y += 25;
      });
      y = 180; doc.setFillColor(primary[0], primary[1], primary[2]); doc.rect(20, y, 170, 60, 'F');
      doc.setTextColor(255, 255, 255); doc.setFontSize(14); doc.setFont("helvetica", "bold");
      doc.text(t.report_cta1 || "VOLS VEURE COM HO FEM?", 30, y + 15);
      doc.setFontSize(10); doc.setFont("helvetica", "normal");
      doc.text(t.report_cta2 || "Agenda una sessió de consultoria estratègica personalitzada.", 30, y + 25);
      doc.text("EMAIL: bandujar@edutac.es", 30, y + 40); doc.text("WEB: www.adeptify.es", 30, y + 48);
      doc.setFontSize(8); doc.setTextColor(148, 163, 184);
      doc.text(t.report_footer || "adeptify.es • Document Confidencial", 105, 285, { align: "center" });

      const pdfBase64 = doc.output('datauristring').split(',')[1];
      const recipient = isTestMode ? testEmail : lead.email;

      let docxBase64 = null;
      try {
        const dr = await fetch('/api/automation/generate-docx', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ leadData: buildMappedDocxData(), lang: language || 'ca' }) });
        if (dr.ok) { const buf = await dr.arrayBuffer(); let bin = ''; const b = new Uint8Array(buf); for (let i = 0; i < b.byteLength; i++) bin += String.fromCharCode(b[i]); docxBase64 = window.btoa(bin); }
      } catch { /* non-fatal */ }

      const resp = await fetch('/api/leads/send-proposal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ leadId: lead.id, email: recipient, subject: `${isTestMode ? '[TEST] ' : ''}Informe Estratègic Adeptify: ${lead.name}`, body: `Hola,\n\nAdjuntem la proposta de transformació digital preparada per Adeptify.es.\n\nSalutacions.`, pdfBase64, docxBase64, proposalData: analysis }) });
      if (resp.ok) setStatusMsg(`Èxit: Proposta enviada a ${recipient}`);
      else throw new Error("Falla en l'enviament");
    } catch (err: any) { setStatusMsg(`Error: ${err.message}`); }
    finally { setIsSending(false); }
  };

  const downloadDocx = async () => {
    if (!analysis) return;
    setIsSending(true); setStatusMsg('Generant Informe DOCX de 12 seccions...');
    try {
      const resp = await fetch('/api/automation/generate-docx', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ leadData: buildMappedDocxData(), lang: language || 'ca' }) });
      if (!resp.ok) throw new Error("Falla al generar el DOCX");
      const blob = await resp.blob(); const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `Auditoria_Adeptify_${lead.name.replace(/\s+/g, '_')}.docx`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a); window.URL.revokeObjectURL(url);
      setStatusMsg('Informe DOCX descarregat amb èxit!');
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
              <div className="flex flex-col md:flex-row gap-4">
                <button onClick={generateAndSendProposal} disabled={isSending || (!lead.email && !isTestMode)} className="flex-1 py-6 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] hover:bg-slate-800 transition-all flex items-center justify-center gap-4">
                  {isSending ? 'Processant...' : (isTestMode ? 'ENVIAR PROVA (PDF)' : 'ENVIAR PROPOSTA (PDF)')}
                </button>
                <button onClick={downloadDocx} disabled={isSending} className="flex-1 py-6 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] hover:bg-indigo-500 transition-all flex items-center justify-center gap-4 shadow-xl shadow-indigo-900/20">
                  {isSending ? 'GENERANT...' : 'DOCX RÀPID (12 SEC.)'}
                </button>
              </div>
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
                  <p className="text-slate-400 text-xs mt-1">13 seccions · Portada · Índex automàtic · ROI · Cronograma · RGPD · Change Management</p>
                </div>
                {reportDocxBase64 && (
                  <button onClick={downloadFullReport} className="ml-4 bg-green-500 hover:bg-green-400 text-white px-6 py-3 rounded-2xl font-black uppercase text-[9px] tracking-widest transition-all shadow-lg flex items-center gap-2 shrink-0">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    .docx
                  </button>
                )}
              </div>

              {/* Token usage live counter */}
              {(isGeneratingReport || tokenUsage.input > 0) && (
                <div className="mb-4 grid grid-cols-3 gap-3">
                  <div className="bg-slate-800/60 rounded-xl p-3 text-center">
                    <div className="text-[8px] font-black uppercase text-slate-400 mb-1">Tokens entrada</div>
                    <div className="text-sm font-black text-indigo-300 font-mono">{tokenUsage.input.toLocaleString()}</div>
                  </div>
                  <div className="bg-slate-800/60 rounded-xl p-3 text-center">
                    <div className="text-[8px] font-black uppercase text-slate-400 mb-1">Tokens sortida</div>
                    <div className="text-sm font-black text-purple-300 font-mono">{tokenUsage.output.toLocaleString()}</div>
                  </div>
                  <div className="bg-slate-800/60 rounded-xl p-3 text-center">
                    <div className="text-[8px] font-black uppercase text-slate-400 mb-1">Cost estimat</div>
                    <div className="text-sm font-black text-amber-300 font-mono">{tokenUsage.cost_eur.toFixed(3)} €</div>
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
                className={`w-full py-6 rounded-2xl font-black uppercase tracking-[0.2em] text-[11px] transition-all flex items-center justify-center gap-3 ${
                  reportDocxBase64
                    ? 'bg-green-600/20 text-green-300 cursor-default border border-green-700/30'
                  : reportError
                    ? 'bg-red-600 hover:bg-red-500 text-white shadow-xl shadow-red-900/40 cursor-pointer'
                  : isGeneratingReport
                    ? 'bg-indigo-800/60 text-indigo-300 cursor-wait'
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-xl shadow-indigo-900/40 hover:shadow-indigo-900/60'
                }`}
              >
                {reportDocxBase64 ? (
                  <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> Informe Generat — Descarrega el Botó Verd</>
                ) : reportError ? (
                  <><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg> ERROR — Clica per Reintentar</>
                ) : isGeneratingReport ? (
                  <><div className="w-4 h-4 border-2 border-indigo-300 border-t-transparent rounded-full animate-spin" /> Generant Informe ({reportProgress.filter(e => e.message.includes('completat') || e.message.includes('completada')).length}/14)...</>
                ) : (
                  <><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg> Generar Informe Complet (14 Agents IA)</>
                )}
              </button>
              {!isGeneratingReport && !reportDocxBase64 && !reportError && (
                <p className="text-center text-[9px] text-slate-500 mt-3 tracking-wide">Temps estimat: 8-12 min · Claude Sonnet 4.6 · 13 seccions · Portada + Índex</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AutomatedLeadPanel;
