
import React, { useRef, useState } from 'react';
import { ProposalData, ImplementationPhase } from '../types';
import { ADEPTIFY_INFO } from '../constants';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

interface ProposalProps {
  data: ProposalData;
  onAccept: (planName: string) => void;
}

const Proposal: React.FC<ProposalProps> = ({ data, onAccept }) => {
  const proposalRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  const downloadPDF = async () => {
    if (!proposalRef.current) return;
    setIsExporting(true);
    try {
      const element = proposalRef.current;
      const canvas = await html2canvas(element, { scale: 2.5, useCORS: true, backgroundColor: '#ffffff' });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Adeptify_Proposta_Executiva.pdf`);
    } catch (error) {
      alert("Error generant PDF.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleWhatsAppContact = () => {
    const cleanPhone = ADEPTIFY_INFO.phone.replace(/[^0-9]/g, '');
    window.open(`https://wa.me/${cleanPhone}`, '_blank');
  };

  return (
    <div className="space-y-12 animate-in slide-in-from-bottom-10 duration-1000 pb-24 px-4 md:px-0">
      <div ref={proposalRef} className="bg-white rounded-[3rem] shadow-premium border border-slate-200 overflow-hidden max-w-6xl mx-auto">
        
        {/* Header Professional */}
        <div className="bg-slate-900 p-10 md:p-16 text-white flex flex-col md:flex-row justify-between items-start md:items-center gap-8 relative">
          <div className="absolute top-0 left-0 w-full h-2 bg-indigo-600" />
          <div className="relative z-10">
            <h2 className="text-3xl md:text-5xl font-brand italic uppercase tracking-tighter mb-4">Adeptify<span className="text-indigo-500">.</span>Systems</h2>
            <p className="text-indigo-400 font-black text-[10px] tracking-[0.4em] uppercase border-l-2 border-indigo-600 pl-4">Auditoria d'Eficiència Acadèmica v2.5</p>
          </div>
          <div className="text-left md:text-right relative z-10 bg-white/5 p-4 rounded-2xl border border-white/10">
             <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Codi Auditoria</p>
             <p className="text-lg font-brand italic tracking-tight">{Math.random().toString(36).substring(7).toUpperCase()}</p>
          </div>
        </div>
        
        <div className="p-8 md:p-16 space-y-16">
          {/* Diagnosis Section */}
          <section className="space-y-8">
            <div className="flex items-center gap-4">
               <div className="h-8 w-1 bg-indigo-600" />
               <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.4em]">Anàlisi de Situació Actual</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-1 gap-8">
              <div className="bg-slate-50 p-10 rounded-[2.5rem] border border-slate-100 shadow-inner">
                <p className="text-2xl font-black text-slate-900 leading-tight italic mb-6">
                  {data.diagnosis || "No s'han pogut extreure punts crítics. Si us plau, revisa l'historial d'auditoria."}
                </p>
                <div className="h-px bg-slate-200 w-full mb-6" />
                <p className="text-md text-slate-600 leading-relaxed font-medium">
                  {data.solution}
                </p>
              </div>
            </div>
          </section>

          {/* Roadmap / Deployment Phases */}
          <section className="space-y-8">
            <div className="flex items-center gap-4">
               <div className="h-8 w-1 bg-indigo-600" />
               <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.4em]">Full de Ruta d'Implementació</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {(data.phases || [
                { name: "Auditoria Tècnica", startWeek: 1, durationWeeks: 1, description: "Mapeig de fluxos de dades" },
                { name: "Configuració Core", startWeek: 2, durationWeeks: 2, description: "Instal·lació de servidors" },
                { name: "Formació Claustre", startWeek: 4, durationWeeks: 1, description: "Capacitació d'usuaris clau" },
                { name: "Llançament", startWeek: 5, durationWeeks: 1, description: "Monitorització de sortida" }
              ]).map((phase, idx) => (
                <div key={idx} className="bg-white border border-slate-100 p-6 rounded-3xl shadow-sm hover:shadow-md transition-shadow">
                  <div className="text-[9px] font-black text-indigo-600 mb-2 uppercase tracking-widest">Setmana {phase.startWeek}</div>
                  <h4 className="text-sm font-black text-slate-800 uppercase mb-2 tracking-tight">{phase.name}</h4>
                  <p className="text-[10px] text-slate-500 font-bold leading-relaxed mb-4">{phase.description}</p>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 flex-1 bg-slate-100 rounded-full overflow-hidden">
                       <div className="h-full bg-indigo-500" style={{ width: '100%' }} />
                    </div>
                    <span className="text-[8px] font-black text-slate-400">{phase.durationWeeks} Set.</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Detailed Budget Table */}
          <div className="bg-slate-900 rounded-[2.5rem] p-8 md:p-12 text-white shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-5">
              <svg className="w-64 h-64" fill="currentColor" viewBox="0 0 24 24"><path d="M11.5 2C6.81 2 3 5.81 3 10.5S6.81 19 11.5 19h.5v3c4.86-2.36 8-7.03 8-11.5C20 5.81 16.19 2 11.5 2zm1 14.5h-2v-2h2v2zm0-3.5h-2c0-3.25 3-3 3-5 0-1.1-.9-2-2-2s-2 .9-2 2h-2c0-2.21 1.79-4 4-4s4 1.79 4 4c0 2.5-3 2.75-3 5z"/></svg>
            </div>
            
            <h3 className="text-[10px] font-black text-indigo-400 uppercase mb-10 tracking-[0.4em] relative z-10">Desglossament Pressupostari Detallat</h3>
            
            <div className="space-y-4 mb-12 relative z-10">
              {(data.items && data.items.length > 0 ? data.items : [
                { concept: "Llicència Anual de Plataforma", description: "Nucli d'intel·ligència artificial Adeptify v2.5", price: 2400 },
                { concept: "Configuració i Setup Inicial", description: "Desplegament d'infraestructura i base de dades", price: 950 },
                { concept: "Integració de Sistemes Previs", description: "Migració de dades i connexió amb CRM/ERP", price: 1200 },
                { concept: "Pla de Formació Presencial", description: "3 sessions per a claustre i equip directiu", price: 850 },
                { concept: "Suport Tècnic Prioritari", description: "Atenció 24/7 i monitorització de servidors", price: 600 }
              ]).map((item, idx) => (
                <div key={idx} className="flex justify-between items-center py-5 border-b border-white/5 group hover:bg-white/5 transition-colors px-4 rounded-xl">
                  <div className="max-w-[70%]">
                    <span className="text-md font-black text-white block mb-0.5 uppercase tracking-tight italic">{item.concept}</span>
                    <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">{item.description}</span>
                  </div>
                  <span className="font-brand italic text-xl text-white">{(item.price || 0).toLocaleString()}€</span>
                </div>
              ))}
            </div>

            <div className="pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-end gap-6 relative z-10">
              <div className="text-left">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">Total Projecte d'Eficiència</span>
                <span className="text-4xl md:text-7xl font-brand italic text-white tracking-tighter">{(data.totalInitial > 0 ? data.totalInitial : 6000).toLocaleString()}€</span>
              </div>
              
              <div className="flex flex-col items-end gap-3">
                 <div className="bg-green-500/10 border border-green-500/20 p-5 rounded-2xl flex items-center gap-4">
                    <div className="h-10 w-10 bg-green-500 rounded-full flex items-center justify-center text-white shadow-lg">
                       <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                    </div>
                    <div>
                       <p className="text-green-500 text-[9px] font-black uppercase tracking-widest">Inversió Final amb NextGen</p>
                       <p className="text-3xl font-brand italic text-green-400">0,00€*</p>
                    </div>
                 </div>
                 <p className="text-[8px] text-slate-500 font-bold uppercase tracking-widest">*Subjecte a l'aprovació del Kit Digital / Fons Europeus</p>
              </div>
            </div>
          </div>

          {/* Legal Disclaimer */}
          <div className="bg-slate-50 p-10 rounded-[3rem] border border-slate-200 text-center space-y-6">
             <div className="w-12 h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center mx-auto mb-4">
               <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
             </div>
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-relaxed max-w-2xl mx-auto italic">
               Aquesta proposta ha estat generada mitjançant un motor d'intel·ligència artificial. No té caràcter vinculant fins a la seva validació presencial per un consultor certificat d'Adeptify Systems SLU. Les dades econòmiques són estimacions basades en els paràmetres introduïts i s'han de confirmar mitjançant l'anàlisi de la documentació oficial del centre.
             </p>
             <button 
               onClick={handleWhatsAppContact}
               className="bg-indigo-600 text-white px-12 py-5 rounded-2xl font-black text-[11px] uppercase tracking-[0.4em] hover:bg-slate-900 hover:scale-105 transition-all shadow-2xl active:scale-95"
             >
               Validar amb un Consultor Real →
             </button>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto flex flex-col md:flex-row gap-6 no-print">
        <button onClick={downloadPDF} disabled={isExporting} className="flex-1 bg-white border border-slate-200 text-slate-600 py-6 rounded-2xl font-black text-[10px] uppercase tracking-[0.3em] hover:border-slate-400 transition-all flex items-center justify-center gap-3 shadow-xl">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
          {isExporting ? 'Processant...' : 'Descarregar Informe Executiu (PDF)'}
        </button>
      </div>

      {/* GDPR Badge */}
      <p className="text-center text-[8px] font-bold text-slate-400 uppercase tracking-widest italic">
        Adeptify Systems SLU • NIF {ADEPTIFY_INFO.nif} • {ADEPTIFY_INFO.address}<br/>
        Informació protegida per la Llei Orgànica de Protecció de Dades (LOPD). Tractament de dades en servidors europeus amb xifrat punt a punt.
      </p>
    </div>
  );
};

export default Proposal;
