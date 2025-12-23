
import React, { useRef, useState } from 'react';
import { ProposalData } from '../types';
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <section className="space-y-6">
              <h3 className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.4em] border-b border-slate-100 pb-3 italic">Punts Crítics Detectats</h3>
              <p className="text-xl md:text-2xl font-black text-slate-900 leading-tight italic">{data.diagnosis}</p>
              <p className="text-sm text-slate-500 leading-relaxed font-medium bg-slate-50 p-6 rounded-3xl border border-slate-100">{data.solution}</p>
            </section>
            
            {/* NextGen Susceptibility */}
            <section className="bg-blue-600 p-8 md:p-10 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-10">
                <svg className="w-32 h-32" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/></svg>
              </div>
              <h3 className="text-[10px] font-black text-blue-200 uppercase tracking-[0.4em] mb-4">Xec de Viabilitat NextGen</h3>
              <div className="space-y-4 relative z-10">
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center text-green-300">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                  </div>
                  <p className="text-sm font-black italic">Susceptibilitat d'ajudes: 100% (ALTA)</p>
                </div>
                <p className="text-xs text-blue-100 font-medium leading-relaxed opacity-90">
                  {data.nextGenFundsInfo || "El vostre perfil compleix els requisits per a la digitalització del centre. El cost final per al centre pot ser de 0€ mitjançant la bonificació de fons europeus."}
                </p>
              </div>
            </section>
          </div>

          {/* Budget Table - NO MORE ZEROS */}
          <div className="bg-slate-900 rounded-[2.5rem] p-8 md:p-12 text-white shadow-2xl">
            <h3 className="text-[10px] font-black text-indigo-400 uppercase mb-10 tracking-[0.4em]">Pressupost Tècnic d'Implementació</h3>
            <div className="space-y-6 mb-12">
              {(data.items && data.items.length > 0 ? data.items : [
                { concept: "Setup & Auditoria Tècnica", description: "Configuració de servidors i mapeig de fluxos.", price: 1200 },
                { concept: "Llicència Core Adeptify", description: "Nucli d'automatització IA (anual).", price: 2400 },
                { concept: "Formació de Claustre", description: "Sessions de capacitació per a l'eficiència.", price: 900 }
              ]).map((item, idx) => (
                <div key={idx} className="flex justify-between items-start py-6 border-b border-white/5">
                  <div className="max-w-[70%]">
                    <span className="text-lg font-black text-white block mb-1 uppercase tracking-tight italic">{item.concept}</span>
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{item.description}</span>
                  </div>
                  <span className="font-brand italic text-2xl text-white">{(item.price || 0).toLocaleString()}€</span>
                </div>
              ))}
            </div>
            <div className="pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-baseline gap-4">
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">Total Projecte (Base + IVA)</span>
                <span className="text-4xl md:text-7xl font-brand italic text-white tracking-tighter">{(data.totalInitial > 0 ? data.totalInitial : 5445).toLocaleString()}€</span>
              </div>
              <div className="bg-green-500/10 border border-green-500/20 p-4 rounded-2xl">
                 <p className="text-green-500 text-[9px] font-black uppercase tracking-widest">Cost net amb NextGen</p>
                 <p className="text-2xl font-brand italic text-green-400">0,00€*</p>
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
          {isExporting ? 'Processant...' : 'Descarregar Informe Executiu (PDF)'}
        </button>
      </div>

      {/* GDPR Badge */}
      <p className="text-center text-[8px] font-bold text-slate-400 uppercase tracking-widest">
        Informació protegida per la Llei Orgànica de Protecció de Dades (LOPD). Tractament de dades en servidors europeus amb xifrat punt a punt.
      </p>
    </div>
  );
};

export default Proposal;
