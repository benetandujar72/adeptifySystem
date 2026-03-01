
import React, { useState } from 'react';
import { useLanguage } from '../LanguageContext';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

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
  video_script?: string; // New field
}

const AutomatedLeadPanel: React.FC = () => {
  const { t } = useLanguage();
  const [lead, setLead] = useState<LeadData>({ email: '', name: '', companyDescription: '' });
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [scrapeUrl, setScrapeUrl] = useState('');

  const handleScrapeAndCapture = async () => {
    if (!scrapeUrl) return;
    setIsAnalyzing(true);
    setStatusMsg(`Scrapeando y analizando ${scrapeUrl}...`);
    try {
      const resp = await fetch('/api/automation/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: scrapeUrl, tenantSlug: 'default' })
      });
      const data = await resp.json();
      if (data.contact_email) {
        setLead({
          name: data.company_name,
          email: data.contact_email,
          companyDescription: data.recommended_solution
        });
        setAnalysis({
          needs_detected: data.detected_needs,
          pain_points: [],
          recommended_services: [data.recommended_solution],
          estimated_budget_range: 'A definir',
          custom_pitch: data.recommended_solution
        });
        setStatusMsg('Lead capturado y analizado con éxito desde la web.');
      } else {
        setStatusMsg('No se pudo extraer información relevante de esta URL.');
      }
    } catch (err) {
      setStatusMsg('Error en el proceso de captura automática.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    setStatusMsg('Analizando con Gemini AI...');
    try {
      const resp = await fetch('/api/leads/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantSlug: 'default', // O el slug correspondiente
          companyInfo: {
            name: lead.name,
            description: lead.companyDescription
          }
        })
      });
      const data = await resp.json();
      setAnalysis(data);
      setStatusMsg('Análisis completado.');
    } catch (err) {
      setStatusMsg('Error en el análisis.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const generateAndSendProposal = async () => {
    if (!analysis) return;
    setIsSending(true);
    setStatusMsg('Generando PDF y enviando propuesta...');

    try {
      // 1. Crear un elemento temporal para el PDF o usar uno oculto
      // Para este MVP, generaremos un PDF simple basado en el análisis
      const doc = new jsPDF();
      doc.setFontSize(20);
      doc.text(`Propuesta para ${lead.name}`, 20, 20);
      doc.setFontSize(12);
      doc.text(`Pitch: ${analysis.custom_pitch}`, 20, 40);
      doc.text(`Servicios recomendados:`, 20, 60);
      analysis.recommended_services.forEach((s, i) => {
        doc.text(`- ${s}`, 30, 70 + (i * 10));
      });
      doc.text(`Inversión estimada: ${analysis.estimated_budget_range}`, 20, 150);

      const pdfBase64 = doc.output('datauristring').split(',')[1];

      // 2. Enviar al backend
      const resp = await fetch('/api/leads/send-proposal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: lead.email,
          subject: `Plan de Transformación Digital para ${lead.name}`,
          body: `Hola ${lead.name},

Hemos analizado tus necesidades y adjuntamos una propuesta personalizada.

${analysis.custom_pitch}

Saludos,
Equipo Adeptify.`,
          pdfBase64
        })
      });

      if (resp.ok) {
        setStatusMsg('¡Propuesta enviada con éxito!');
      } else {
        throw new Error('Error en el envío');
      }
    } catch (err) {
      setStatusMsg('Error al enviar la propuesta.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-8 bg-white rounded-2xl shadow-xl border border-slate-100">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-bold text-slate-900">Gestión de Leads</h2>
        <span className="bg-indigo-50 text-indigo-600 px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
          AI Autopilot Enabled
        </span>
      </div>

      {/* Sección Autopiloto */}
      <div className="mb-12 p-8 bg-slate-900 rounded-2xl text-white shadow-2xl">
        <h3 className="text-lg font-bold mb-4 flex items-center gap-3">
          <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          Captura Automática (URL Scraper)
        </h3>
        <p className="text-sm text-slate-400 mb-6">Pega la URL de un colegio o empresa. Gemini extraerá los datos y detectará sus necesidades automáticamente.</p>
        <div className="flex gap-4">
          <input 
            type="text" 
            className="flex-1 p-4 bg-slate-800 border border-slate-700 rounded-xl text-white outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="https://www.colegio-ejemplo.com"
            value={scrapeUrl}
            onChange={(e) => setScrapeUrl(e.target.value)}
          />
          <button 
            onClick={handleScrapeAndCapture}
            disabled={isAnalyzing || !scrapeUrl}
            className="bg-indigo-600 px-8 py-4 rounded-xl font-bold uppercase tracking-widest hover:bg-indigo-500 transition-all disabled:opacity-50"
          >
            Investigar Web
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8 border-t border-slate-100 pt-8">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Nombre del Lead / Empresa</label>
            <input 
              type="text" 
              className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
              value={lead.name}
              onChange={(e) => setLead({...lead, name: e.target.value})}
              placeholder="Ej: Colegio Santa María"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Email de contacto</label>
            <input 
              type="email" 
              className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
              value={lead.email}
              onChange={(e) => setLead({...lead, email: e.target.value})}
              placeholder="director@colegio.com"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Descripción de necesidades / Contexto</label>
          <textarea 
            className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl h-32 focus:ring-2 focus:ring-indigo-500 outline-none"
            value={lead.companyDescription}
            onChange={(e) => setLead({...lead, companyDescription: e.target.value})}
            placeholder="Describe qué busca el cliente o qué has detectado..."
          />
        </div>
      </div>

      <button 
        onClick={handleAnalyze}
        disabled={isAnalyzing || !lead.name}
        className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold uppercase tracking-widest hover:bg-indigo-700 disabled:opacity-50 transition-all mb-4"
      >
        {isAnalyzing ? 'Procesando con IA...' : 'Analizar Necesidades con Gemini'}
      </button>

      {statusMsg && (
        <p className="text-sm font-medium text-indigo-600 mb-8 text-center">{statusMsg}</p>
      )}

      {analysis && (
        <div className="bg-slate-50 p-8 rounded-2xl border border-indigo-100 fade-in">
          <h3 className="text-xl font-bold text-slate-900 mb-4">Análisis Detectado:</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase mb-2">Necesidades</p>
              <ul className="text-sm text-slate-600 list-disc pl-5">
                {analysis.needs_detected.map((n, i) => <li key={i}>{n}</li>)}
              </ul>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase mb-2">Presupuesto Estimado</p>
              <p className="text-lg font-bold text-indigo-600">{analysis.estimated_budget_range}</p>
            </div>
          </div>
          <div className="mb-8">
            <p className="text-xs font-bold text-slate-400 uppercase mb-2">Pitch Personalizado</p>
            <p className="text-sm text-slate-700 italic border-l-4 border-indigo-500 pl-4 mb-6">{analysis.custom_pitch}</p>
            
            {analysis.video_script && (
              <div className="mt-6 p-6 bg-indigo-900 rounded-xl text-indigo-100 shadow-inner">
                <div className="flex items-center gap-2 mb-3">
                  <svg className="w-4 h-4 text-indigo-400" fill="currentColor" viewBox="0 0 20 20"><path d="M2 6a2 2 0 012-2h12a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zm13 2a1 1 0 00-1 1v4a1 1 0 102 0V9a1 1 0 00-1-1z" /></svg>
                  <span className="text-[10px] font-black uppercase tracking-widest">Guion para Avatar IA</span>
                </div>
                <textarea 
                  className="w-full bg-transparent border-none text-sm leading-relaxed focus:ring-0 resize-none h-24 text-indigo-50"
                  value={analysis.video_script}
                  onChange={(e) => setAnalysis({...analysis, video_script: e.target.value})}
                />
                <p className="text-[9px] text-indigo-400 mt-2 italic font-medium">Este es el texto que el avatar de vídeo dirá en el mensaje personalizado.</p>
              </div>
            )}
          </div>

          <button 
            onClick={generateAndSendProposal}
            disabled={isSending}
            className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold uppercase tracking-widest hover:bg-slate-800 disabled:opacity-50 transition-all"
          >
            {isSending ? 'Enviando...' : 'Generar PDF y Enviar Oferta'}
          </button>
        </div>
      )}
    </div>
  );
};

export default AutomatedLeadPanel;
