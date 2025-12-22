
import React from 'react';

interface SelectionScreenProps {
  onChoice: (choice: 'QUICK' | 'DEEP' | 'DOCS') => void;
}

const SelectionScreen: React.FC<SelectionScreenProps> = ({ onChoice }) => {
  const cards = [
    {
      id: 'QUICK' as const,
      title: 'Acció Immediata',
      desc: 'Optimització tàctica de processos. Resolem colls d\'ampolla i fugues de temps en 48h.',
      icon: (
        <svg className="w-8 h-8 md:w-10 md:h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
      ),
      tag: 'TÀCTICA 48H',
      time: '60 SEG.',
      isDark: false
    },
    {
      id: 'DEEP' as const,
      title: 'Auditoria Visió',
      desc: 'Redisseny estructural 360°. Alineem el model operatiu amb l\'estratègia del centre.',
      icon: (
        <svg className="w-8 h-8 md:w-10 md:h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
      ),
      tag: 'ESTRATÈGIA CORE',
      time: '3 MIN.',
      isDark: true
    },
    {
      id: 'DOCS' as const,
      title: 'Redactor Docs',
      desc: 'Automatització de PGA i Memòries. Coherència normativa sense esforç manual.',
      icon: (
        <svg className="w-8 h-8 md:w-10 md:h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
      ),
      tag: 'GESTIÓ DADES',
      time: '2 MIN.',
      isDark: false
    }
  ];

  return (
    <div className="flex flex-col items-center justify-center py-6 px-4 animate-in fade-in duration-700">
      <div className="text-center mb-10 max-w-4xl w-full">
        <h1 className="text-5xl md:text-8xl font-brand text-slate-900 tracking-tighter mb-4 leading-none italic uppercase">
          Adeptify<span className="text-indigo-600">.</span>Systems
        </h1>
        <div className="inline-block border-y border-slate-200 py-2 px-6">
           <p className="text-slate-400 font-black uppercase text-[9px] tracking-[0.5em]">Consultoria d'Enginyeria Operativa</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-6xl">
        {cards.map((card) => (
          <div key={card.id} className="perspective-2000 h-[420px] md:h-[480px] w-full group cursor-pointer">
            <div className="relative w-full h-full transition-transform duration-700 preserve-3d group-hover:[transform:rotateY(180deg)]">
              
              {/* FRONT: Professional Identity */}
              <div className={`absolute inset-0 backface-hidden rounded-[3rem] border flex flex-col items-center justify-center p-8 text-center shadow-xl transition-all duration-500 ${card.isDark ? 'bg-[#0F172A] text-white border-slate-800' : 'bg-white text-slate-900 border-slate-100'}`}>
                <div className={`w-16 h-16 md:w-20 md:h-20 rounded-[1.8rem] flex items-center justify-center mb-8 shadow-2xl transition-transform group-hover:scale-105 ${card.isDark ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-indigo-600'}`}>
                  {card.icon}
                </div>
                <h3 className="text-2xl md:text-3xl font-black uppercase tracking-tighter leading-none">{card.title}</h3>
                <div className="absolute bottom-10 flex items-center gap-2 opacity-20">
                  <div className="w-1 h-1 rounded-full bg-indigo-500 animate-pulse" />
                  <span className="text-[8px] font-black uppercase tracking-widest italic">Explorar</span>
                </div>
              </div>

              {/* BACK: Strategic Summary (Zero Clashing) */}
              <div className="absolute inset-0 backface-hidden [transform:rotateY(180deg)] rounded-[3rem] border flex flex-col p-8 text-left shadow-2xl transition-all bg-indigo-600 text-white border-indigo-500 overflow-hidden">
                
                {/* 1. Static Header Tag */}
                <div className="h-6 mb-4 shrink-0">
                  <span className="text-[8px] font-black uppercase tracking-[0.2em] text-indigo-200 bg-white/10 px-3 py-1.5 rounded-full border border-white/10">{card.tag}</span>
                </div>
                
                {/* 2. Controlled Content Area */}
                <div className="flex-1 flex flex-col justify-start min-h-0">
                  <h3 className="text-xl font-black uppercase tracking-tight mb-4 leading-none">{card.title}</h3>
                  <p className="text-[12px] md:text-sm font-medium leading-relaxed text-indigo-50 opacity-90 line-clamp-4">
                    {card.desc}
                  </p>
                </div>
                
                {/* 3. Pinned Footer (Safe Zone) */}
                <div className="mt-4 pt-6 border-t border-white/10 flex flex-col gap-5 shrink-0">
                  <div className="flex justify-between items-baseline">
                    <span className="text-[8px] font-black uppercase tracking-[0.2em] text-indigo-200">Durada Auditoria</span>
                    <span className="text-xs font-black tracking-widest">{card.time}</span>
                  </div>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      onChoice(card.id);
                    }}
                    className="w-full py-4 bg-white text-indigo-600 rounded-2xl font-black text-[10px] uppercase tracking-[0.3em] transition-all hover:bg-slate-50 shadow-xl active:scale-95"
                  >
                    Iniciar →
                  </button>
                </div>

              </div>

            </div>
          </div>
        ))}
      </div>
      
      {/* Footer Info */}
      <div className="mt-12 flex items-center gap-6 opacity-30">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-indigo-600" />
          <span className="text-[8px] font-black uppercase tracking-[0.3em]">AES-256 Data Protection</span>
        </div>
      </div>
    </div>
  );
};

export default SelectionScreen;
