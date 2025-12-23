
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
  const [selectedPlan, setSelectedPlan] = useState(data.subscriptionPlans?.find(p => p.isRecommended)?.name || data.subscriptionPlans?.[0]?.name);

  const downloadPDF = async () => {
    if (!proposalRef.current) return;
    setIsExporting(true);
    try {
      const element = proposalRef.current;
      const canvas = await html2canvas(element, { 
        scale: 3, 
        useCORS: true, 
        backgroundColor: '#ffffff',
        windowWidth: 1200 
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Proposta_Adeptify_${Date.now()}.pdf`);
    } catch (error) {
      alert("Error generant PDF.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-8 md:space-y-12 animate-in slide-in-from-bottom-10 duration-1000 pb-24 md:pb-40 px-4 md:px-0">
      <div 
        ref={proposalRef} 
        className="bg-white rounded-[1.5rem] md:rounded-[2.5rem] shadow-premium border border-slate-200 overflow-hidden max-w-6xl mx-auto"
      >
        {/* Header con Fondos NextGen Highlight */}
        <div className="bg-slate-900 p-8 md:p-16 text-white flex flex-col md:flex-row justify-between items-start md:items-center gap-8 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-indigo-600" />
          <div className="absolute -right-20 -top-20 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl" />
          
          <div className="relative z-10">
            <h2 className="text-3xl md:text-5xl font-brand italic uppercase tracking-tighter mb-4">Adeptify<span className="text-indigo-500">.</span>Pro</h2>
            <div className="space-y-2">
              <p className="text-indigo-400 font-black text-[9px] md:text-[10px] tracking-[0.4em] uppercase border-l-2 border-indigo-600 pl-4">Auditoria d'Eficiència Docent</p>
              <div className="flex items-center gap-2 pl-4 mt-2">
                 <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                 <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Next Generation EU Eligible</span>
              </div>
            </div>
          </div>
          
          <div className="text-left md:text-right border-l md:border-l border-white/10 pl-6 md:pl-10 relative z-10">
             <div className="bg-indigo-600/20 text-indigo-400 px-4 py-2 rounded-xl text-[8px] md:text-[10px] font-black uppercase tracking-[0.3em] border border-indigo-500/30 mb-4 inline-block italic">Ref. NEXTGEN-2025</div>
             <p className="text-[10px] md:text-xs font-black text-white mt-1 uppercase tracking-tight">Vàlid per a subvencions públiques</p>
          </div>
        </div>
        
        <div className="p-6 md:p-16 space-y-12 md:space-y-20">
          {/* Executive Summary & NextGen */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-20">
            <section className="space-y-6">
              <h3 className="text-[9px] md:text-[10px] font-black text-indigo-600 uppercase tracking-[0.4em] border-b border-slate-100 pb-3">Resum del Diagnòstic</h3>
              <p className="text-xl md:text-2xl font-black text-slate-900 leading-tight tracking-tight italic">{data.diagnosis}</p>
              <p className="text-xs md:text-sm text-slate-500 leading-relaxed font-medium italic">
                Hem detectat punts on l'equip docent perd massa temps en tasques repetitives que es poden automatitzar sense esforç.
              </p>
            </section>
            
            <section className="bg-blue-50/50 p-8 rounded-[2rem] border border-blue-100 shadow-sm relative group overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:rotate-12 transition-transform">
                <svg className="w-20 h-20 text-blue-600" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/></svg>
              </div>
              <h3 className="text-[9px] md:text-[10px] font-black text-blue-600 uppercase tracking-[0.4em] mb-4">Oportunitat de Finançament</h3>
              <p className="text-sm font-black text-blue-900 mb-4 leading-tight">Ajuts Next Generation EU</p>
              <p className="text-xs text-blue-700 leading-relaxed font-medium">{data.nextGenFundsInfo}</p>
              <div className="mt-6 flex items-center gap-3">
                 <div className="bg-blue-600 text-white p-2 rounded-lg">
                   <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                 </div>
                 <span className="text-[8px] font-black text-blue-600 uppercase tracking-widest">T'ajudem amb la tramitació</span>
              </div>
            </section>
          </div>

          {/* Financials & Action */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 md:gap-12">
            <div className="lg:col-span-7 bg-slate-900 rounded-[2.5rem] p-8 md:p-12 text-white shadow-2xl relative">
              <h3 className="text-[9px] md:text-[10px] font-black text-indigo-400 uppercase mb-10 tracking-[0.4em]">Detall de la Intervenció</h3>
              
              <div className="space-y-6 mb-16">
                {data.items?.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-start py-6 border-b border-white/5 group">
                    <div className="max-w-[75%]">
                      <span className="text-sm md:text-lg font-black text-white block mb-2 group-hover:text-indigo-400 transition-colors uppercase tracking-tight">{item.concept}</span>
                      <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest leading-relaxed line-clamp-2">{item.description}</span>
                    </div>
                    <span className="font-brand italic text-xl md:text-2xl text-white ml-4">{(item.price || 0).toFixed(0)}€</span>
                  </div>
                ))}
              </div>

              <div className="pt-8 border-t border-white/10">
                <div className="flex justify-between items-baseline mb-4">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Inversió Total (IVA incl.)</span>
                  <span className="text-4xl md:text-6xl font-brand italic text-white tracking-tighter">{(data.totalInitial || 0).toFixed(0)}€</span>
                </div>
                <p className="text-[8px] text-indigo-400 font-black uppercase tracking-[0.3em]">*Finançable al 100% si compleixes els requisits de digitalització.</p>
              </div>
            </div>

            <div className="lg:col-span-5 flex flex-col justify-center gap-6">
              <div className="bg-white p-8 rounded-[2rem] border-2 border-slate-100 shadow-sm text-center space-y-6">
                <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-[1.5rem] flex items-center justify-center mx-auto mb-2">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                </div>
                <h4 className="text-xl font-black text-slate-900 uppercase tracking-tight">Següent Pas: Consultoria Personalitzada</h4>
                <p className="text-xs text-slate-500 font-medium leading-relaxed">
                  Valida aquesta proposta amb un dels nostres consultors educatius. Analitzarem la viabilitat dels fons europeus per al vostre centre i tancarem el pla d'execució.
                </p>
                <button 
                  onClick={() => onAccept(selectedPlan || 'Pro')} 
                  className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black text-xs uppercase tracking-[0.3em] hover:bg-indigo-600 transition-all shadow-xl active:scale-95"
                >
                  Reservar Consultoria →
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto flex flex-col md:flex-row gap-6 no-print">
        <button 
          onClick={downloadPDF} 
          disabled={isExporting}
          className="w-full bg-white border border-slate-200 text-slate-600 py-6 rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:border-slate-400 transition-all shadow-xl disabled:opacity-50"
        >
          {isExporting ? 'Generant...' : 'Baixar Proposta Completa (PDF)'}
        </button>
      </div>
    </div>
  );
};

export default Proposal;
