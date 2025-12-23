
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
      const canvas = await html2canvas(element, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Adeptify_Estrategia_Executiva.pdf`);
    } catch (error) {
      alert("Error generant PDF.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-16 fade-up pb-32">
      <div ref={proposalRef} className="bg-white rounded-xl shadow-[0_40px_80px_rgba(0,0,0,0.08)] border border-slate-100 overflow-hidden max-w-5xl mx-auto">
        
        {/* Capçalera Estil Informe */}
        <div className="p-16 border-b border-slate-100 flex justify-between items-start">
          <div className="space-y-6">
            <h2 className="text-2xl font-serif italic text-slate-900 tracking-tight">Adeptify<span className="text-indigo-600">.</span>Systems</h2>
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em]">Informe de Consultoria Estratègica</p>
              <h3 className="text-3xl font-bold text-slate-900">Proposta d'Eficiència Operativa</h3>
            </div>
          </div>
          <div className="text-right space-y-2">
             <span className="inline-block bg-slate-50 border border-slate-100 px-4 py-2 rounded text-[10px] font-bold text-slate-600 tracking-widest uppercase">
               Ref: AD-{Math.random().toString(36).substring(7).toUpperCase()}
             </span>
             <p className="text-[10px] text-slate-400 font-medium">Data d'emissió: {new Date().toLocaleDateString()}</p>
          </div>
        </div>
        
        <div className="p-16 space-y-20">
          {/* Executive Summary */}
          <section className="max-w-3xl">
            <h4 className="text-[10px] font-bold text-indigo-600 uppercase tracking-[0.4em] mb-6">01 Resum Executiu</h4>
            <div className="space-y-6">
              <p className="text-2xl font-serif text-slate-800 leading-snug italic border-l-4 border-indigo-600 pl-8">
                "{data.diagnosis}"
              </p>
              <p className="text-base text-slate-600 leading-relaxed pl-8">
                {data.solution}
              </p>
            </div>
          </section>

          {/* Roadmap */}
          <section>
            <h4 className="text-[10px] font-bold text-indigo-600 uppercase tracking-[0.4em] mb-10">02 Implementació i Full de Ruta</h4>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-px bg-slate-100 border border-slate-100 rounded-lg overflow-hidden">
              {data.phases.map((phase, idx) => (
                <div key={idx} className="bg-white p-8 space-y-4">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Fase 0{idx+1}</span>
                  <h5 className="text-sm font-bold text-slate-900 uppercase tracking-tight">{phase.name}</h5>
                  <p className="text-xs text-slate-500 leading-relaxed font-medium">{phase.description}</p>
                  <p className="text-[10px] font-bold text-indigo-600 pt-2">Setmana {phase.startWeek}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Budget Analysis */}
          <section className="bg-slate-50 p-12 rounded-xl">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.4em] mb-12">03 Estructura d'Inversió</h4>
            <div className="space-y-4 mb-16">
              {data.items.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center py-4 border-b border-slate-200/60">
                  <div>
                    <span className="text-sm font-bold text-slate-800 block">{item.concept}</span>
                    <span className="text-[10px] text-slate-500 font-medium">{item.description}</span>
                  </div>
                  <span className="font-serif text-lg text-slate-900 font-bold">{item.price.toLocaleString()}€</span>
                </div>
              ))}
            </div>

            <div className="flex flex-col md:flex-row justify-between items-end gap-10">
              <div className="text-left">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Inversió Total Estimada</span>
                <span className="text-6xl font-serif text-slate-900 tracking-tighter">{(data.totalInitial).toLocaleString()}€</span>
              </div>
              
              <div className="bg-indigo-600 text-white p-8 rounded-xl space-y-2 min-w-[300px] shadow-xl shadow-indigo-100">
                 <p className="text-[10px] font-bold uppercase tracking-widest opacity-80">Amb Subvenció NextGen</p>
                 <p className="text-4xl font-serif italic">0,00€<span className="text-sm opacity-60 ml-2 font-sans font-normal">*</span></p>
                 <p className="text-[8px] opacity-60 leading-tight pt-2 uppercase font-bold tracking-widest">*Pendent de validació oficial</p>
              </div>
            </div>
          </section>
        </div>
        
        {/* Footer del Document */}
        <div className="bg-slate-50 p-12 border-t border-slate-100 flex flex-col items-center gap-6">
           <p className="text-[9px] text-slate-400 font-medium uppercase tracking-[0.2em] text-center max-w-2xl leading-relaxed">
             Adeptify Systems SLU • NIF {ADEPTIFY_INFO.nif} • {ADEPTIFY_INFO.address}<br/>
             Proposta de consultoria tècnica amb caràcter informatiu generada per IA estratègica.
           </p>
        </div>
      </div>

      <div className="max-w-lg mx-auto flex gap-4 no-print">
        <button 
          onClick={downloadPDF} 
          disabled={isExporting} 
          className="flex-1 bg-slate-900 text-white py-5 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center justify-center gap-3 shadow-2xl btn-premium"
        >
          {isExporting ? 'Processant...' : 'Exportar Informe (PDF)'}
        </button>
        <button 
          onClick={() => window.open(`https://wa.me/34690831770`, '_blank')}
          className="flex-1 bg-white border border-slate-200 text-slate-700 py-5 rounded-xl font-bold text-xs uppercase tracking-widest hover:border-slate-400 transition-all"
        >
          Contactar Consultor
        </button>
      </div>
    </div>
  );
};

export default Proposal;