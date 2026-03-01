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
  pain_points: string[];
  recommended_services: string[];
  estimated_budget_range: string;
  custom_pitch: string;
  video_script?: string;
  suggested_micro_app?: any;
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
  
  // Test Mode State
  const [isTestMode, setIsTestMode] = useState(false);
  const [testEmail, setTestEmail] = useState('bandujar@edutac.es');

  const steps = [
    "Conectant amb el servidor...",
    "Extraient contingut web...",
    "Gemini 3.1 Pro analitzant...",
    "Generant IA Insights...",
    "Finalitzant..."
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
        body: JSON.stringify({ url: scrapeUrl, tenantSlug: 'default' }),
        // Añadimos una señal de aborto si fuera necesario en el futuro
      });
      
      clearInterval(stepInterval);
      const data = await resp.json();
      
      if (data.company_name) {
        setCurrentStep(null);
        setLead({
          name: data.company_name,
          email: data.contact_email || '',
          companyDescription: data.recommended_solution
        });
        setAnalysis(data);
        setStatusMsg('Anàlisi completada. Revisa i edita les dades abans d\'enviar.');
      } else {
        setStatusMsg(data.error || 'No s\'ha pogut extreure informació rellevant.');
        setCurrentStep(null);
      }
    } catch (err) {
      clearInterval(stepInterval);
      setCurrentStep(null);
      setStatusMsg('Error de xarxa o timeout. El servidor està processant, reintenta en uns segons.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const generateAndSendProposal = async () => {
    if (!analysis) return;
    setIsSending(true);
    setStatusMsg('Generant PDF professional...');

    try {
      const doc = new jsPDF();
      const brandColor = [79, 70, 229];
      
      // Branded Header
      doc.setFillColor(brandColor[0], brandColor[1], brandColor[2]);
      doc.rect(0, 0, 210, 40, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(22);
      doc.text("ADEPTIFY SYSTEMS", 20, 25);
      doc.setFontSize(10);
      doc.text("CONSULTORIA ESTRATÈGICA IA", 20, 32);

      doc.setTextColor(30, 41, 59);
      doc.text(`PROPOSTA PER A: ${lead.name.toUpperCase()}`, 20, 60);
      
      const splitPitch = doc.splitTextToSize(analysis.custom_pitch, 170);
      doc.text(splitPitch, 20, 80);

      const pdfBase64 = doc.output('datauristring').split(',')[1];
      const finalRecipient = isTestMode ? testEmail : lead.email;

      if (!finalRecipient) {
        throw new Error("Falta email de destí");
      }

      const resp = await fetch('/api/leads/send-proposal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: lead.id,
          email: finalRecipient,
          subject: `${isTestMode ? '[TEST] ' : ''}Proposta Estratègica Adeptify: ${lead.name}`,
          body: `Hola,\n\nAdjuntem la proposta de transformació digital preparada per Adeptify.es.\n\nSalutacions.`,
          pdfBase64,
          proposalData: analysis
        })
      });

      if (resp.ok) setStatusMsg(`¡Èxit! Proposta enviada a ${finalRecipient}`);
      else throw new Error("Falla en l'enviament");

    } catch (err: any) {
      setStatusMsg(`Error: ${err.message}`);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-8 bg-white rounded-[32px] shadow-2xl border border-slate-100 fade-in">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">Gestió de Leads IA</h2>
        <div className="flex items-center gap-4">
           <label className="flex items-center gap-2 cursor-pointer bg-slate-100 px-4 py-2 rounded-xl border border-slate-200">
              <input type="checkbox" checked={isTestMode} onChange={(e) => setIsTestMode(e.target.checked)} className="w-4 h-4 accent-indigo-600" />
              <span className="text-[10px] font-black uppercase text-slate-600">Mode Test</span>
           </label>
        </div>
      </div>

      <div className="mb-8 p-8 bg-slate-900 rounded-3xl text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10">
          <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
            <span className="w-2 h-2 bg-indigo-500 rounded-full animate-ping" />
            Explorador Autònom de Centres
          </h3>
          <p className="text-sm text-slate-400 mb-6">Analitza qualsevol web escolar i genera una oferta professional a l'instant.</p>
          <div className="flex gap-3">
            <input 
              type="text" 
              className="flex-1 p-4 bg-slate-800 border border-slate-700 rounded-2xl text-white outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              placeholder="https://www.escolaejemplo.cat"
              value={scrapeUrl}
              onChange={(e) => setScrapeUrl(e.target.value)}
            />
            <button 
              onClick={handleScrapeAndCapture}
              disabled={isAnalyzing || !scrapeUrl}
              className="bg-indigo-600 px-8 py-4 rounded-2xl font-bold uppercase text-[10px] tracking-widest hover:bg-indigo-500 transition-all disabled:opacity-50"
            >
              {isAnalyzing ? 'Processant...' : 'Investigar'}
            </button>
          </div>
        </div>
      </div>

      {isAnalyzing && (
        <div className="mb-8 space-y-3 p-6 bg-indigo-50 rounded-2xl border border-indigo-100">
          {steps.map((s, i) => (
            <div key={i} className={`flex items-center gap-3 transition-opacity ${i > (currentStep || 0) ? 'opacity-20' : 'opacity-100'}`}>
              <div className={`w-2 h-2 rounded-full ${i < (currentStep || 0) ? 'bg-green-500' : 'bg-indigo-600 animate-pulse'}`} />
              <span className="text-xs font-medium text-slate-600">{s}</span>
            </div>
          ))}
        </div>
      )}

      {statusMsg && <div className="mb-8 text-center p-4 bg-slate-50 rounded-xl text-xs font-bold text-indigo-600 border border-indigo-50">{statusMsg}</div>}

      {analysis && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 border-t border-slate-100 pt-8 fade-in">
          <div className="space-y-6">
            <div>
              <label className="text-[10px] font-black uppercase text-slate-400 mb-2 block">Nom de la Institució</label>
              <input type="text" value={lead.name} onChange={(e) => setLead({...lead, name: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800" />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase text-slate-400 mb-2 block tracking-widest">Email de Contacte (Editable)</label>
              <input 
                type="email" 
                value={lead.email} 
                onChange={(e) => setLead({...lead, email: e.target.value})} 
                className="w-full p-4 bg-indigo-50 border border-indigo-200 rounded-xl font-bold text-indigo-700 focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="correu@centre.cat"
              />
              <p className="text-[9px] text-slate-400 mt-1 italic">Verifica aquest correu abans d'enviar la proposta.</p>
            </div>
            
            {isTestMode && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <label className="text-[10px] font-black uppercase text-amber-700 mb-2 block">Email de Prova</label>
                <input type="email" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} className="w-full p-3 bg-white border border-amber-200 rounded-lg text-xs" />
              </div>
            )}
          </div>

          <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
            <h4 className="text-xs font-black uppercase text-slate-400 mb-4">Anàlisi de l'IA</h4>
            <p className="text-sm text-slate-700 leading-relaxed italic border-l-4 border-indigo-500 pl-4 mb-6">{analysis.custom_pitch}</p>
            <button 
              onClick={generateAndSendProposal}
              disabled={isSending || (!lead.email && !isTestMode)}
              className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-xl disabled:opacity-30"
            >
              {isSending ? 'Enviant...' : (isTestMode ? 'Enviar Prova' : 'Generar i Enviar Proposta Real')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AutomatedLeadPanel;
