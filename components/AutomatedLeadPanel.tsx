import React, { useState } from 'react';
import { useLanguage } from '../LanguageContext';
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
}

const AutomatedLeadPanel: React.FC = () => {
  const { t } = useLanguage();
  const [lead, setLead] = useState<LeadData>({ email: '', name: '', companyDescription: '' });
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [scrapeUrl, setScrapeUrl] = useState('');
  const [currentStep, setCurrentStep] = useState<number | null>(null);
  
  const [isTestMode, setIsTestMode] = useState(false);
  const [testEmail, setTestEmail] = useState('bandujar@edutac.es');

  // Credenciales y Proyectos Reales para el Informe
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

    const stepInterval = setInterval(() => {
      setCurrentStep(prev => (prev !== null && prev < steps.length - 1 ? prev + 1 : prev));
    }, 3000);

    try {
      const resp = await fetch('/api/automation/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: scrapeUrl, tenantSlug: 'default' })
      });
      
      clearInterval(stepInterval);
      const data = await resp.json();
      
      if (data.company_name) {
        setLead({
          name: data.company_name,
          email: data.contact_email || '',
          companyDescription: data.recommended_solution || ''
        });
        setAnalysis(data);
        setStatusMsg('Anàlisi IA completada amb èxit.');
      } else {
        setStatusMsg('Error: No s\'ha pogut extreure informació. Revisa la URL.');
      }
    } catch (err) {
      setStatusMsg('Timeout o error de xarxa. El servidor segueix processant.');
    } finally {
      setIsAnalyzing(false);
      setCurrentStep(null);
    }
  };

  const generateAndSendProposal = async () => {
    if (!analysis) return;
    setIsSending(true);
    setStatusMsg('Generant Informe Professional Adeptify...');

    try {
      const doc = new jsPDF();
      const primary = [79, 70, 229]; // Indigo-600
      const slate = [30, 41, 59];   // Slate-800
      
      // PAGE 1: Executive Cover
      doc.setFillColor(primary[0], primary[1], primary[2]);
      doc.rect(0, 0, 210, 60, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(28);
      doc.text("ADEPTIFY SYSTEMS", 20, 35);
      doc.setFontSize(12);
      doc.text("CONSULTORIA ESTRATÈGICA EN INTEL·LIGÈNCIA ARTIFICIAL", 20, 45);

      doc.setTextColor(slate[0], slate[1], slate[2]);
      doc.setFontSize(14);
      doc.text("INFORME D'AUDITORIA I PROPOSTA DE TRANSFORMACIÓ", 20, 80);
      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      doc.text(`PREPARAT PER A: ${lead.name.toUpperCase()}`, 20, 90);
      doc.text(`DATA: ${new Date().toLocaleDateString()}`, 20, 97);

      // Section: Executive Summary
      doc.setDrawColor(226, 232, 240);
      doc.line(20, 105, 190, 105);
      doc.setFont("helvetica", "bold");
      doc.text("1. RESUM EXECUTIU", 20, 115);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      const splitPitch = doc.splitTextToSize(analysis.custom_pitch, 170);
      doc.text(splitPitch, 20, 125);

      // Section: Recommended Solutions
      let y = 160;
      doc.setFont("helvetica", "bold");
      doc.text("2. SOLUCIONS ESTRATÈGIQUES SUGGERIDES", 20, y);
      doc.setFont("helvetica", "normal");
      (analysis.recommended_services || []).forEach(service => {
        y += 8;
        doc.text(`✓ ${service}`, 25, y);
      });

      // PAGE 2: Portfolio & Contact
      doc.addPage();
      doc.setFillColor(248, 250, 252);
      doc.rect(0, 0, 210, 40, 'F');
      doc.setTextColor(slate[0], slate[1], slate[2]);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.text("CREDENCIALS I PROJECTES D'ÈXIT", 20, 25);

      y = 60;
      PORTFOLIO.forEach(p => {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.text(p.name, 20, y);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        const splitAction = doc.splitTextToSize(p.action, 160);
        doc.text(splitAction, 25, y + 7);
        y += 25;
      });

      // Contact & CTA Box
      y = 180;
      doc.setFillColor(primary[0], primary[1], primary[2]);
      doc.rect(20, y, 170, 60, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("VOLS VEURE COM HO FEM?", 30, y + 15);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text("Agenda una sessió de consultoria estratègica personalitzada.", 30, y + 25);
      doc.text("EMAIL: bandujar@edutac.es", 30, y + 40);
      doc.text("WEB: www.adeptify.es", 30, y + 48);

      // Final Footer
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text("adeptify.es • Carrer de l'Avenir, Barcelona • Document Confidencial", 105, 285, { align: "center" });

      const pdfBase64 = doc.output('datauristring').split(',')[1];
      const recipient = isTestMode ? testEmail : lead.email;

      const resp = await fetch('/api/leads/send-proposal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: lead.id,
          email: recipient,
          subject: `${isTestMode ? '[TEST] ' : ''}Informe Estratègic Adeptify: ${lead.name}`,
          body: `Hola,\n\nAdjuntem la proposta de transformació digital preparada per Adeptify.es.\n\nSalutacions.`,
          pdfBase64,
          proposalData: analysis
        })
      });

      if (resp.ok) setStatusMsg(`Èxit: Proposta enviada a ${recipient}`);
      else throw new Error("Falla en l'enviament");

    } catch (err: any) {
      setStatusMsg(`Error: ${err.message}`);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-8 bg-white rounded-[40px] shadow-2xl border border-slate-100 fade-in">
      <header className="flex justify-between items-center mb-10">
        <div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tighter italic">ADEPTIFY LEAD GENERATOR</h2>
          <p className="text-slate-400 text-sm font-bold uppercase tracking-widest mt-1">Portal de Prospecció i Venda Senior</p>
        </div>
        <div className="flex items-center gap-4">
           <label className="flex items-center gap-3 cursor-pointer bg-slate-50 border border-slate-200 px-5 py-2.5 rounded-2xl shadow-inner">
              <input type="checkbox" checked={isTestMode} onChange={(e) => setIsTestMode(e.target.checked)} className="w-5 h-5 accent-indigo-600" />
              <span className="text-[10px] font-black uppercase text-slate-500">Mode Test</span>
           </label>
        </div>
      </header>

      {/* Scraper Input */}
      <div className="mb-10 p-10 bg-slate-900 rounded-[32px] text-white shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <svg className="w-32 h-32" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" /></svg>
        </div>
        <div className="relative z-10">
          <h3 className="text-2xl font-bold mb-2 italic">Captura Intel·ligent de Centres</h3>
          <p className="text-slate-400 mb-8 text-sm max-w-xl">Introdueix la URL d'una escola o institució per generar una proposta executiva basada en èxits reals d'Adeptify.</p>
          <div className="flex gap-4">
            <input 
              type="text" 
              className="flex-1 p-5 bg-slate-800 border border-slate-700 rounded-2xl text-white outline-none focus:ring-4 focus:ring-indigo-500/30 transition-all font-mono text-sm"
              placeholder="https://www.centre-educatiu.cat"
              value={scrapeUrl}
              onChange={(e) => setScrapeUrl(e.target.value)}
            />
            <button 
              onClick={handleScrapeAndCapture}
              disabled={isAnalyzing || !scrapeUrl}
              className="bg-indigo-600 px-10 py-5 rounded-2xl font-black uppercase text-[11px] tracking-[0.2em] hover:bg-indigo-500 transition-all disabled:opacity-50"
            >
              {isAnalyzing ? 'Explorant...' : 'Investigar'}
            </button>
          </div>
        </div>
      </div>

      {isAnalyzing && (
        <div className="mb-10 grid grid-cols-1 md:grid-cols-5 gap-4">
          {steps.map((s, i) => (
            <div key={i} className={`p-4 rounded-2xl border transition-all duration-700 ${i <= (currentStep || 0) ? 'bg-indigo-50 border-indigo-200' : 'bg-slate-50 border-slate-100 opacity-30'}`}>
              <div className={`w-2 h-2 rounded-full mb-2 ${i < (currentStep || 0) ? 'bg-green-500' : (i === currentStep ? 'bg-indigo-600 animate-pulse' : 'bg-slate-300')}`} />
              <p className={`text-[9px] font-black uppercase tracking-tighter ${i === currentStep ? 'text-indigo-600' : 'text-slate-400'}`}>{s}</p>
            </div>
          ))}
        </div>
      )}

      {statusMsg && <div className="mb-10 text-center p-5 bg-indigo-50/50 rounded-2xl text-xs font-black uppercase tracking-widest text-indigo-600 border border-indigo-100">{statusMsg}</div>}

      {analysis && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 border-t border-slate-100 pt-10 fade-in">
          {/* Left Column: Data Review */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-slate-50 p-8 rounded-[32px] border border-slate-100">
              <h4 className="text-[10px] font-black uppercase text-slate-400 mb-6 tracking-[0.2em]">Revisió de Dades</h4>
              <div className="space-y-6">
                <div>
                  <label className="text-[9px] font-black uppercase text-slate-400 mb-2 block tracking-widest">Institució</label>
                  <input type="text" value={lead.name} onChange={(e) => setLead({...lead, name: e.target.value})} className="w-full p-4 bg-white border border-slate-200 rounded-xl font-bold text-slate-800" />
                </div>
                <div>
                  <label className="text-[9px] font-black uppercase text-slate-400 mb-2 block tracking-widest">Email Target (Editable)</label>
                  <input type="email" value={lead.email} onChange={(e) => setLead({...lead, email: e.target.value})} className="w-full p-4 bg-indigo-50 border border-indigo-200 rounded-xl font-bold text-indigo-700 focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
              </div>
            </div>

            {/* Success Cases Preview */}
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

          {/* Right Column: Branded Preview */}
          <div className="lg:col-span-8 bg-white border-2 border-slate-900 rounded-[40px] p-10 shadow-2xl relative">
            <div className="absolute top-0 right-0 bg-slate-900 text-white px-6 py-2 rounded-bl-3xl text-[9px] font-black uppercase tracking-widest">Adeptify Executive Report</div>
            
            <div className="flex justify-between items-start mb-12">
              <h4 className="text-3xl font-serif italic text-slate-900">Anàlisi de Transformació</h4>
              <div className="text-right">
                <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-1">Inversió Estimat</p>
                <p className="text-2xl font-black text-slate-900">{analysis.estimated_budget_range || '5.000€ - 8.000€'}</p>
              </div>
            </div>

            <div className="prose prose-slate max-w-none mb-12">
              <div className="p-8 bg-slate-50 rounded-3xl border-l-8 border-indigo-600 mb-8">
                <p className="text-xs font-black text-indigo-600 uppercase mb-4 tracking-widest">Resum Executiu</p>
                <p className="text-sm text-slate-700 leading-relaxed italic">"{analysis.custom_pitch}"</p>
              </div>

              <div className="grid grid-cols-2 gap-8">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase mb-4 tracking-widest">Fuites Detectades</p>
                  <ul className="space-y-3">
                    {analysis.needs_detected?.map((n, i) => (
                      <li key={i} className="text-xs text-slate-600 flex gap-3"><span className="text-indigo-500 font-bold">●</span> {n}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase mb-4 tracking-widest">Solucions Proposades</p>
                  <ul className="space-y-3">
                    {analysis.recommended_services?.map((s, i) => (
                      <li key={i} className="text-xs text-slate-600 flex gap-3"><span className="text-green-500 font-bold">✓</span> {s}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <button 
                onClick={generateAndSendProposal}
                disabled={isSending || (!lead.email && !isTestMode)}
                className="flex-1 py-6 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-[0.2em] text-[11px] hover:bg-indigo-600 transition-all flex items-center justify-center gap-4"
              >
                {isSending ? 'ENVIANT INFORME...' : (isTestMode ? 'ENVIAR PROVA' : 'GENERAR I ENVIAR PROPOSTA REAL')}
              </button>
              <button onClick={() => window.open('https://adeptify.es', '_blank')} className="px-10 py-6 border-2 border-slate-900 rounded-2xl font-black uppercase text-[11px] tracking-widest hover:bg-slate-50 transition-all">Accés Consultoria</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AutomatedLeadPanel;
