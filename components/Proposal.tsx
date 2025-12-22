
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
  const [selectedPlan, setSelectedPlan] = useState(data.subscriptionPlans.find(p => p.isRecommended)?.name || data.subscriptionPlans[0]?.name);

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
      pdf.save(`Proposta_Tecnica_Adeptify_${Date.now()}.pdf`);
    } catch (error) {
      alert("Error generant PDF de l'informe.");
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
        {/* Pro Header */}
        <div className="bg-slate-900 p-8 md:p-16 text-white flex flex-col md:flex-row justify-between items-start md:items-center gap-8 md:gap-10 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-indigo-600" />
          
          <div className="relative z-10">
            <h2 className="text-3xl md:text-5xl font-brand italic uppercase tracking-tighter mb-4">Adeptify<span className="text-indigo-500">.</span>Audit</h2>
            <div className="space-y-2">
              <p className="text-indigo-400 font-black text-[8px] md:text-[10px] tracking-[0.3em] md:tracking-[0.5em] uppercase border-l-2 border-indigo-600 pl-4">Enginyeria Operativa Educativa</p>
              <p className="text-slate-500 text-[8px] md:text-[10px] font-bold uppercase tracking-widest pl-4">Barcelona Headquarters</p>
            </div>
          </div>
          
          <div className="text-left md:text-right border-l md:border-l border-white/10 pl-6 md:pl-10 relative z-10 w-full md:w-auto">
             <div className="bg-white/5 px-4 md:px-6 py-2 md:py-3 rounded-xl text-[8px] md:text-[10px] font-black uppercase tracking-[0.2em] md:tracking-[0.3em] border border-white/10 mb-2 md:mb-4 inline-block">Ref. AUD-2025-ED</div>
             <p className="text-[8px] md:text-[10px] text-slate-500 font-bold uppercase tracking-widest">Document Confidencial</p>
             <p className="text-[10px] md:text-xs font-black text-white mt-1 uppercase tracking-tight">{new Date().toLocaleDateString()}</p>
          </div>
        </div>
        
        <div className="p-6 md:p-16 space-y-12 md:space-y-20">
          {/* Executive Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-20">
            <section className="space-y-4 md:space-y-6">
              <h3 className="text-[9px] md:text-[10px] font-black text-indigo-600 uppercase tracking-[0.4em] border-b border-slate-100 pb-3">Resum Executiu</h3>
              <p className="text-xl md:text-2xl font-black text-slate-900 leading-tight tracking-tight">{data.diagnosis}</p>
              <p className="text-xs md:text-sm text-slate-500 leading-relaxed font-medium italic">
                Aquesta anàlisi és fruit del protocol d'auditoria dinàmica Adeptify Systems.
              </p>
            </section>
            <section className="bg-slate-50 p-6 md:p-10 rounded-2xl md:rounded-[2rem] border border-slate-100 shadow-inner">
              <h3 className="text-[9px] md:text-[10px] font-black text-green-600 uppercase tracking-[0.4em] mb-6 md:mb-8">Arquitectura Proposada</h3>
              <div className="space-y-4 md:space-y-6">
                <p className="font-black text-lg md:text-xl text-slate-900 uppercase tracking-tighter">{data.miniAppSuggestion?.name}</p>
                <p className="text-xs md:text-sm text-slate-600 font-medium leading-relaxed">{data.solution}</p>
                <div className="flex flex-wrap gap-2 pt-2 md:pt-4">
                  {data.miniAppSuggestion?.features.map((f, i) => (
                    <span key={i} className="bg-white px-3 py-1.5 rounded-lg text-[8px] md:text-[10px] font-black text-indigo-600 border border-indigo-100 shadow-sm uppercase tracking-tight">{f}</span>
                  ))}
                </div>
              </div>
            </section>
          </div>

          {/* Roadmap - Responsive Scroll */}
          <section>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 md:mb-12 border-b border-slate-100 pb-6 gap-4">
               <h3 className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-[0.4em]">Fases d'Implementació</h3>
               <span className="text-[9px] md:text-[10px] font-black text-indigo-600 uppercase bg-indigo-50 px-4 py-2 rounded-xl border border-indigo-100">Operatiu en {data.implementationTime}</span>
            </div>
            
            <div className="overflow-x-auto pb-4 custom-scrollbar">
              <div className="min-w-[800px] md:min-w-0 relative space-y-8">
                 <div className="absolute top-0 left-[200px] h-full w-px bg-slate-100" />
                 <div className="flex text-[8px] md:text-[9px] font-black text-slate-300 uppercase ml-[200px] justify-between px-4">
                    {[1,2,3,4,5,6,7,8].map(n => <span key={n} className="w-12 text-center">Setm. {n}</span>)}
                 </div>
                 
                 {data.phases.map((phase, i) => (
                  <div key={i} className="flex items-center group">
                    <div className="w-[200px] pr-6 md:pr-10 text-right">
                      <p className="font-black text-[10px] md:text-[11px] text-slate-800 uppercase tracking-tight leading-tight group-hover:text-indigo-600 transition-colors">{phase.name}</p>
                    </div>
                    <div className="flex-1 h-10 md:h-14 bg-slate-50/30 rounded-xl md:rounded-2xl border border-slate-50 relative overflow-hidden group-hover:border-indigo-100 transition-all">
                      <div 
                        className="absolute h-full bg-indigo-600/10 border-l-[3px] border-indigo-600 flex items-center px-4 md:px-6"
                        style={{ 
                          left: `${(phase.startWeek - 1) * 12.5}%`, 
                          width: `${phase.durationWeeks * 12.5}%` 
                        }}
                      >
                        <span className="text-[8px] md:text-[9px] font-bold text-indigo-800 uppercase tracking-tighter truncate">{phase.description}</span>
                      </div>
                    </div>
                  </div>
                 ))}
              </div>
            </div>
          </section>

          {/* Financials - Stacked on Mobile */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 md:gap-12 pt-6 md:pt-10">
            {/* Setup */}
            <div className="lg:col-span-7 bg-slate-900 rounded-2xl md:rounded-[2.5rem] p-8 md:p-12 text-white shadow-2xl relative overflow-hidden order-1">
              <div className="absolute top-0 right-0 w-48 h-48 md:w-64 md:h-64 bg-indigo-500/10 rounded-full blur-[80px] md:blur-[100px]" />
              <h3 className="text-[9px] md:text-[10px] font-black text-indigo-400 uppercase mb-8 md:mb-10 tracking-[0.4em] flex items-center gap-3 md:gap-4">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" /> Enginyeria i Setup Inicial
              </h3>
              
              <div className="space-y-6 md:space-y-8 mb-10 md:mb-16">
                {data.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-start py-4 md:py-6 border-b border-white/5 group">
                    <div className="max-w-[70%]">
                      <span className="text-xs md:text-[14px] font-black text-white block mb-1 md:mb-2 group-hover:text-indigo-400 transition-colors uppercase tracking-tight">{item.concept}</span>
                      <span className="text-[9px] md:text-[10px] text-slate-500 font-bold uppercase tracking-widest leading-relaxed line-clamp-2 md:line-clamp-none">{item.description}</span>
                    </div>
                    <span className="font-brand italic text-lg md:text-2xl text-white ml-4">{item.price.toFixed(0)}€</span>
                  </div>
                ))}
              </div>

              <div className="pt-6 md:pt-8 space-y-3 md:space-y-4">
                <div className="flex justify-between text-[9px] md:text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                  <span>Subtotal Net</span>
                  <span>{data.subtotal.toFixed(0)}€</span>
                </div>
                <div className="flex justify-between items-baseline pt-6 md:pt-10 border-t border-white/10">
                  <span className="text-sm md:text-[16px] font-black uppercase text-slate-300 tracking-[0.1em] md:tracking-[0.2em]">Total Inicial</span>
                  <span className="text-4xl md:text-6xl font-brand italic text-white tracking-tighter">{data.totalInitial.toFixed(0)}€</span>
                </div>
              </div>
            </div>

            {/* Subscriptions */}
            <div className="lg:col-span-5 space-y-6 md:space-y-8 order-2">
               <h3 className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] mb-2 md:mb-4">Sostenibilitat Cloud</h3>
               {data.subscriptionPlans.map((plan) => (
                <button
                  key={plan.name}
                  onClick={() => setSelectedPlan(plan.name)}
                  className={`w-full p-6 md:p-10 rounded-xl md:rounded-[2rem] border transition-all text-left relative ${
                    selectedPlan === plan.name 
                      ? 'border-indigo-600 bg-white shadow-xl md:shadow-2xl md:scale-[1.03] ring-1 ring-indigo-600' 
                      : 'border-slate-200 bg-white hover:border-slate-400'
                  }`}
                >
                  <div className="flex justify-between items-start mb-6 md:mb-8">
                    <span className="font-black text-[9px] md:text-[11px] text-indigo-600 uppercase tracking-[0.3em] md:tracking-[0.4em]">{plan.name}</span>
                    {plan.isRecommended && <span className="bg-indigo-600 text-white text-[7px] md:text-[8px] px-3 md:px-4 py-1 rounded-full font-black uppercase tracking-widest">Standard</span>}
                  </div>
                  <div className="space-y-4 md:space-y-6 mb-8 md:mb-10">
                    <div className="flex justify-between items-baseline">
                      <span className="text-[8px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest">Quota Mensual</span>
                      <span className="text-xl md:text-2xl font-brand italic text-slate-900">{plan.monthlySoftwarePrice + plan.monthlyServerPrice}€</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 md:gap-3 pt-4 md:pt-6 border-t border-slate-100">
                    <span className="text-[8px] md:text-[10px] font-black text-slate-300 uppercase tracking-widest">Manteniment 24/7 inclòs</span>
                  </div>
                </button>
               ))}
            </div>
          </div>

          {/* Legal Footer */}
          <footer className="pt-10 md:pt-20 border-t border-slate-100 space-y-8 md:space-y-12">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
              <div className="space-y-2 md:space-y-3">
                 <p className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-[0.4em]">Contacte Directe</p>
                 <p className="text-lg md:text-xl font-black text-slate-900">931 000 000</p>
                 <p className="text-[10px] md:text-xs font-bold text-indigo-600 tracking-tight">executive@adeptify.cat</p>
              </div>
              <div className="md:col-span-2">
                 <p className="text-[8px] md:text-[10px] text-slate-400 font-bold uppercase tracking-tight leading-relaxed italic">
                   *AVÍS: Proposta basada en l'anàlisi de dades massives realitzada pel nostre sistema d'auditoria. Validesa de 30 dies.
                 </p>
              </div>
            </div>
            
            <div className="bg-slate-900 p-6 md:p-10 rounded-2xl md:rounded-[2rem] flex flex-col md:flex-row items-center justify-between gap-6 md:gap-10">
               <div className="flex items-center gap-4 md:gap-6 w-full md:w-auto">
                  <div className="w-12 h-12 md:w-14 md:h-14 bg-white/10 text-white rounded-xl md:rounded-2xl flex items-center justify-center shadow-lg border border-white/10 shrink-0">
                    <svg className="w-6 h-6 md:w-8 md:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                  </div>
                  <div>
                    <p className="text-[10px] md:text-xs font-black text-white uppercase tracking-widest">Validació Tècnica</p>
                    <p className="text-[8px] md:text-[10px] text-slate-500 font-medium uppercase mt-1">Reunió estratègica prioritària.</p>
                  </div>
               </div>
               <a href="mailto:consultoria@adeptify.cat" className="w-full md:w-auto text-center bg-white text-slate-900 px-8 md:px-10 py-3 md:py-4 rounded-xl font-black text-[9px] md:text-[10px] uppercase tracking-[0.3em] md:tracking-[0.4em] hover:bg-indigo-500 hover:text-white transition-all shadow-xl">Contactar Partner</a>
            </div>
          </footer>
        </div>
      </div>

      <div className="max-w-3xl mx-auto flex flex-col md:flex-row gap-4 md:gap-6 no-print">
        <button 
          onClick={() => onAccept(selectedPlan || '')} 
          className="w-full md:flex-[2] bg-slate-900 text-white py-5 md:py-6 rounded-xl md:rounded-2xl font-black text-xs md:text-sm uppercase tracking-[0.3em] md:tracking-[0.4em] hover:bg-indigo-600 transition-all shadow-2xl active:scale-95"
        >
          Validar Proposta
        </button>
        <button 
          onClick={downloadPDF} 
          disabled={isExporting}
          className="w-full md:flex-1 bg-white border border-slate-200 text-slate-600 py-5 md:py-6 rounded-xl md:rounded-2xl font-black text-xs md:text-sm uppercase tracking-[0.2em] hover:border-slate-400 transition-all shadow-xl active:scale-95 disabled:opacity-50"
        >
          {isExporting ? 'Processant...' : 'Baixar Informe'}
        </button>
      </div>

      <style>{`
        @media print { .no-print { display: none; } }
      `}</style>
    </div>
  );
};

export default Proposal;
