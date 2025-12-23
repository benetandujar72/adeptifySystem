
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
        scale: 2.5, 
        useCORS: true, 
        backgroundColor: '#ffffff',
        windowWidth: 1200 
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Proposta_Eficiencia_${Date.now()}.pdf`);
    } catch (error) {
      alert("Error generant PDF.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-8 md:space-y-12 animate-in slide-in-from-bottom-10 duration-1000 pb-24 px-4 md:px-0">
      <div 
        ref={proposalRef} 
        className="bg-white rounded-[2rem] md:rounded-[3rem] shadow-premium border border-slate-200 overflow-hidden max-w-6xl mx-auto"
      >
        {/* Header - Corporate Look */}
        <div className="bg-slate-900 p-8 md:p-16 text-white flex flex-col md:flex-row justify-between items-start md:items-center gap-8 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-indigo-600" />
          <div className="relative z-10">
            <h2 className="text-3xl md:text-5xl font-brand italic uppercase tracking-tighter mb-4">Adeptify<span className="text-indigo-500">.</span>Systems</h2>
            <p className="text-indigo-400 font-black text-[10px] tracking-[0.4em] uppercase border-l-2 border-indigo-600 pl-4">Proposta d'Eficiència Docent</p>
          </div>
          <div className="text-left md:text-right relative z-10">
             <div className="bg-indigo-600/20 text-indigo-400 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-indigo-500/30 mb-2 inline-block italic">Ref. AUDIT-2025</div>
             <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{new Date().toLocaleDateString()}</p>
          </div>
        </div>
        
        <div className="p-8 md:p-16 space-y-16">
          {/* Diagnosis & Funds */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <section className="space-y-6">
              <h3 className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.4em] border-b border-slate-100 pb-3 italic">Diagnòstic Executiu</h3>
              <p className="text-xl md:text-2xl font-black text-slate-900 leading-tight italic">{data.diagnosis}</p>
              <p className="text-sm text-slate-500 leading-relaxed font-medium">{data.solution}</p>
            </section>
            
            <section className="bg-blue-50/50 p-8 rounded-[2.5rem] border border-blue-100 shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform duration-700">
                <svg className="w-32 h-32 text-blue-900" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/>
                </svg>
              </div>
              <div className="flex items-center gap-3 mb-6 relative z-10">
                 <div className="bg-blue-600 text-white p-2.5 rounded-xl shadow-lg">
                   <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                   </svg>
                 </div>
                 <h3 className="text-[10px] font-black text-blue-600 uppercase tracking-[0.4em]">Fons Next Generation EU</h3>
              </div>
              <p className="text-xs text-blue-800 leading-relaxed font-black mb-4 relative z-10">
                Projecte 100% elegible per a digitalització.
              </p>
              <p className="text-[11px] text-blue-700 leading-relaxed italic relative z-10">
                {data.nextGenFundsInfo}
              </p>
            </section>
          </div>

          {/* Budget Breakdown */}
          <div className="bg-slate-900 rounded-[2.5rem] p-8 md:p-12 text-white shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
              <svg className="w-64 h-64" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 8c-1.657 0-3 1.343-3 3s1.343 3 3 3 3-1.343 3-3-1.343-3-3-3z"/>
                <path fillRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zM7.001 5a1 1 0 011-1h8a1 1 0 110 2h-8a1 1 0 01-1-1zM12 18a6 6 0 100-12 6 6 0 000 12z" clipRule="evenodd"/>
              </svg>
            </div>
            <h3 className="text-[10px] font-black text-indigo-400 uppercase mb-10 tracking-[0.4em] relative z-10">Inversió Inicial Detallada</h3>
            <div className="space-y-6 mb-12 relative z-10">
              {data.items?.map((item, idx) => (
                <div key={idx} className="flex justify-between items-start py-6 border-b border-white/5 group transition-colors hover:bg-white/[0.02] px-2 rounded-xl">
                  <div className="max-w-[70%]">
                    <span className="text-lg font-black text-white block mb-1 group-hover:text-indigo-400 transition-colors uppercase tracking-tight italic">{item.concept}</span>
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest leading-relaxed line-clamp-2">{item.description}</span>
                  </div>
                  <span className="font-brand italic text-2xl text-white ml-4 shrink-0">{(item.price || 0).toFixed(0)}€</span>
                </div>
              ))}
            </div>
            <div className="pt-8 border-t border-white/10 flex justify-between items-baseline relative z-10">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Total Inversió (IVA incl.)</span>
              <span className="text-5xl md:text-7xl font-brand italic text-white tracking-tighter">{(data.totalInitial || 0).toFixed(0)}€</span>
            </div>
          </div>

          {/* CTA & Next Steps */}
          <div className="bg-indigo-50 rounded-[3rem] p-10 md:p-16 text-center space-y-10 relative group overflow-hidden border border-indigo-100">
             <div className="absolute inset-0 bg-gradient-to-b from-transparent to-white/30" />
             <div className="w-20 h-20 bg-indigo-600 text-white rounded-[2rem] flex items-center justify-center mx-auto shadow-2xl relative z-10 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-500">
               <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
               </svg>
             </div>
             <div className="space-y-4 max-w-2xl mx-auto relative z-10">
               <h3 className="text-3xl font-black text-slate-900 uppercase tracking-tight italic">Validem la viabilitat?</h3>
               <p className="text-slate-600 text-sm font-medium leading-relaxed">
                 Reserva una sessió de 30 minuts amb els nostres consultors. Revisarem l'audit tècnic i t'ajudarem amb la memòria de digitalització per als fons europeus per a que el cost del projecte sigui zero.
               </p>
             </div>
             <button 
               onClick={() => window.open('https://wa.me/34600000000', '_blank')}
               className="bg-slate-900 text-white px-12 py-5 rounded-2xl font-black text-[11px] uppercase tracking-[0.4em] hover:bg-indigo-600 hover:scale-105 transition-all shadow-2xl active:scale-95 relative z-10"
             >
               Reservar Cita Consultoria →
             </button>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto flex gap-6 no-print">
        <button 
          onClick={downloadPDF} 
          disabled={isExporting}
          className="w-full bg-white border border-slate-200 text-slate-600 py-6 rounded-2xl font-black text-[10px] uppercase tracking-[0.3em] hover:border-slate-400 hover:bg-slate-50 transition-all shadow-xl disabled:opacity-50 flex items-center justify-center gap-3"
        >
          {isExporting ? (
            <div className="w-5 h-5 border-2 border-slate-300 border-t-indigo-600 rounded-full animate-spin" />
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          )}
          {isExporting ? 'Generant...' : 'Descarregar Informe Complet (PDF)'}
        </button>
      </div>
    </div>
  );
};

export default Proposal;
