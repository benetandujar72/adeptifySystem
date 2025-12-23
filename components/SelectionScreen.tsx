
import React from 'react';
import { ProductType } from '../types';

interface SelectionScreenProps {
  onChoice: (choice: ProductType | 'DOCS') => void;
}

const SelectionScreen: React.FC<SelectionScreenProps> = ({ onChoice }) => {
  const products = [
    {
      id: 'LMS' as ProductType,
      title: 'Formació Lleugera (LMS)',
      desc: 'Elimina el caos de l\'email. App offline per a claustre i alumnat.',
      icon: (
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 14l9-5-9-5-9 5 9 5z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
        </svg>
      ),
      color: "bg-indigo-50",
      textColor: "text-indigo-600"
    },
    {
      id: 'AUDIT' as ProductType,
      title: 'Checklists IA',
      desc: 'Digitalitza auditories de menjador, aules i seguretat amb evidència IA.',
      icon: (
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
        </svg>
      ),
      color: "bg-orange-50",
      textColor: "text-orange-600"
    },
    {
      id: 'VISION' as ProductType,
      title: 'Visió Artificial',
      desc: 'Comptatge automàtic, OCR i detecció de perills mitjançant càmeres IA.',
      icon: (
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
      ),
      color: "bg-teal-50",
      textColor: "text-teal-600"
    }
  ];

  return (
    <div className="flex flex-col items-center justify-center py-6 px-4 animate-in fade-in duration-700">
      <div className="text-center mb-12 max-w-4xl w-full">
        <h1 className="text-4xl md:text-7xl font-brand text-slate-900 tracking-tighter mb-6 leading-none uppercase">
          Deixa de sobreviure,<br/><span className="text-indigo-600 italic">comença a educar.</span>
        </h1>
        <p className="text-slate-500 font-bold text-xl max-w-2xl mx-auto leading-relaxed">
          "Allibera el teu centre de la dictadura del paper. Selecciona una solució i inicia l'auditoria dinàmica ara."
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-5xl mb-16">
        {products.map((product) => (
          <div 
            key={product.id} 
            onClick={() => onChoice(product.id)}
            className="group bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-xl hover:border-indigo-100 transition-all cursor-pointer flex flex-col items-center text-center gap-5"
          >
            <div className={`w-16 h-16 ${product.color} ${product.textColor} rounded-2xl flex items-center justify-center transition-transform duration-500 group-hover:scale-110`}>
              {product.icon}
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">{product.title}</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-relaxed">{product.desc}</p>
            </div>
            <button className="mt-4 text-[9px] font-black uppercase tracking-widest text-indigo-600 border-b border-indigo-200 pb-1 group-hover:border-indigo-600 transition-all">
              Configurar Solució →
            </button>
          </div>
        ))}
      </div>

      <div className="w-full max-w-4xl bg-indigo-600 rounded-[3rem] p-12 text-white flex flex-col md:flex-row items-center justify-between gap-8 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-20 -mt-20" />
        <div className="space-y-3 relative z-10 text-center md:text-left">
          <h2 className="text-3xl font-brand uppercase italic">Auditoria Integral</h2>
          <p className="text-indigo-100 text-sm font-medium opacity-80 max-w-md">No saps per on començar? Fes una auditoria de 360º del teu centre.</p>
        </div>
        <button 
          onClick={() => onChoice('DEEP_AUDIT')}
          className="bg-white text-indigo-600 px-12 py-6 rounded-2xl font-black text-[11px] uppercase tracking-[0.4em] hover:bg-slate-50 hover:scale-105 active:scale-95 transition-all shadow-xl shrink-0 relative z-10"
        >
          Anàlisi Global →
        </button>
      </div>
    </div>
  );
};

export default SelectionScreen;
