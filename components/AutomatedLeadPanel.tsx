
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

  const steps = [
    "Connectant amb el centre...",
    "Analitzant infraestructura digital...",
    "IA calculant ROI i fuites...",
    "Redactant proposta executiva...",
    "Finalitzant informe Adeptify..."
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
      doc.text("RESUM EXECUTIU", 20, 115);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      const pitch = analysis.custom_pitch || "Anàlisi estratègica en curs.";
      const splitPitch = doc.splitTextToSize(pitch, 170);
      doc.text(splitPitch, 20, 125);

      // Section: Detected Needs
      let y = 160;
      doc.setFont("helvetica", "bold");
      doc.text("PUNTS DE MILLORA DETECTATS", 20, y);
      doc.setFont("helvetica", "normal");
      (analysis.needs_detected || []).forEach(need => {
        y += 8;
        doc.text(`• ${need}`, 25, y);
      });

      // Section: Recommended Solutions
      y += 20;
      doc.setFont("helvetica", "bold");
      doc.text("SOLUCIONS ESTRATÈGIQUES", 20, y);
      doc.setFont("helvetica", "normal");
      (analysis.recommended_services || []).forEach(service => {
        y += 8;
        doc.text(`• ${service}`, 25, y);
      });

      // Footer Box: Budget & ROI
      y += 25;
      doc.setFillColor(248, 250, 252);
      doc.rect(20, y, 170, 35, 'F');
      doc.setFont("helvetica", "bold");
      doc.text("IMPACTE ECONÒMIC I INVERSIÓ", 30, y + 12);
      doc.setFont("helvetica", "normal");
      doc.text(`Inversió estimada: ${analysis.estimated_budget_range || 'A consultar'}`, 30, y + 22);
      doc.text(`Estalvi estimat: ${analysis.estimated_hours_lost_per_week || 20}h setmanals en gestió.`, 30, y + 29);

      // Legal Footer
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
          body: `Estimat/ada equip de ${lead.name},\n\nAdjuntem l'informe d'auditoria digital i la proposta de transformació que hem preparat.\n\nRestem a la vostra disposició.\n\nEquip Adeptify.es`,
          pdfBase64,
          proposalData: analysis
        })
      });

      if (resp.ok) setStatusMsg(`Enviat amb èxit a ${recipient}`);
      else throw new Error("Error en l'enviament");

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
          <p className="text-slate-400 text-sm font-bold uppercase tracking-widest mt-1">Arquitectura de Prospecció Autònoma</p>
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
        <div className="relative z-10 max-w-2xl">
          <h3 className="text-2xl font-bold mb-2">Explorador de Centres</h3>
          <p className="text-slate-400 mb-8 text-sm leading-relaxed">Introdueix la URL d'una institució. La IA realitzarà un escombrat exhaustiu de les seves necessitats i generarà un informe executiu professional.</p>
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
              className="bg-indigo-600 px-10 py-5 rounded-2xl font-black uppercase text-[11px] tracking-[0.2em] hover:bg-indigo-500 transition-all disabled:opacity-50 shadow-xl shadow-indigo-900/40"
            >
              {isAnalyzing ? 'Processant...' : 'Investigar'}
            </button>
          </div>
        </div>
      </div>

      {/* Progress Steps */}
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

      {statusMsg && <div className="mb-10 text-center p-5 bg-indigo-50/50 rounded-2xl text-xs font-black uppercase tracking-widest text-indigo-600 border border-indigo-100 animate-fade-in">{statusMsg}</div>}

      {/* Detailed Analysis UI */}
      {analysis && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 border-t border-slate-100 pt-10 fade-in">
          {/* Left Column: Data Review */}
          <div className="lg:col-span-5 space-y-8">
            <div className="bg-slate-50 p-8 rounded-[32px] border border-slate-100">
              <h4 className="text-[10px] font-black uppercase text-slate-400 mb-6 tracking-[0.2em]">Dades del Lead</h4>
              <div className="space-y-6">
                <div>
                  <label className="text-[9px] font-black uppercase text-slate-400 mb-2 block">Institució</label>
                  <input type="text" value={lead.name} onChange={(e) => setLead({...lead, name: e.target.value})} className="w-full p-4 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
                <div>
                  <label className="text-[9px] font-black uppercase text-slate-400 mb-2 block">Email Destinatari</label>
                  <input type="email" value={lead.email} onChange={(e) => setLead({...lead, email: e.target.value})} className="w-full p-4 bg-white border border-indigo-200 rounded-xl font-bold text-indigo-700 focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
                {isTestMode && (
                  <div className="p-5 bg-amber-50 border border-amber-200 rounded-2xl">
                    <label className="text-[9px] font-black uppercase text-amber-700 mb-2 block">Email de Prova Actiu</label>
                    <input type="email" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} className="w-full p-3 bg-white border border-amber-200 rounded-xl text-xs font-bold" />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Executive Report Preview */}
          <div className="lg:col-span-7 bg-slate-900 rounded-[40px] p-10 text-white shadow-2xl relative overflow-hidden">
            <div className="flex justify-between items-start mb-10">
              <div>
                <span className="px-3 py-1 bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded-full text-[9px] font-black uppercase tracking-widest mb-4 inline-block">Informe IA Previsualització</span>
                <h4 className="text-2xl font-bold italic font-serif">Proposta Estratègica Adeptify</h4>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Inversió Estimat</p>
                <p className="text-xl font-black text-indigo-400">{analysis.estimated_budget_range || '5.000€ - 8.000€'}</p>
              </div>
            </div>

            <div className="space-y-8 mb-12">
              <div className="p-6 bg-white/5 rounded-2xl border border-white/10">
                <p className="text-[9px] font-black text-indigo-400 uppercase mb-3">Resum executiu i Pitch</p>
                <p className="text-sm text-slate-300 leading-relaxed italic border-l-2 border-indigo-500 pl-4">{analysis.custom_pitch}</p>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-[9px] font-black text-slate-500 uppercase mb-3">Problemes Detectats</p>
                  <ul className="space-y-2">
                    {analysis.needs_detected?.map((n, i) => (
                      <li key={i} className="text-[11px] text-slate-400 flex gap-2"><span className="text-indigo-500">●</span> {n}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-[9px] font-black text-slate-500 uppercase mb-3">Solucions IA</p>
                  <ul className="space-y-2">
                    {analysis.recommended_services?.map((s, i) => (
                      <li key={i} className="text-[11px] text-slate-400 flex gap-2"><span className="text-green-500">✓</span> {s}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            <button 
              onClick={generateAndSendProposal}
              disabled={isSending || (!lead.email && !isTestMode)}
              className="w-full py-6 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-[0.2em] text-[11px] hover:bg-indigo-500 transition-all shadow-xl shadow-indigo-900/40 flex items-center justify-center gap-4"
            >
              {isSending ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ENVIANT INFORME...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                  {isTestMode ? 'ENVIAR PROVA DE SEGURETAT' : 'GENERAR I ENVIAR INFORME REAL'}
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AutomatedLeadPanel;
