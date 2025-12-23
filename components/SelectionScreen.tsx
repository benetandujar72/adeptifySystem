
import React from 'react';

interface SelectionScreenProps {
  onChoice: (choice: 'QUICK' | 'DEEP' | 'DOCS') => void;
}

const SelectionScreen: React.FC<SelectionScreenProps> = ({ onChoice }) => {
  const products = [
    {
      id: 'LMS' as const,
      title: 'Formació Lleugera (LMS)',
      desc: 'Capacita el teu equip amb una app que funciona sense internet i sense emails.',
      icon: (
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 14l9-5-9-5-9 5 9 5z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222" />
        </svg>
      ),
      color: "bg-indigo-50",
      textColor: "text-indigo-600"
    },
    {
      id: 'AUDIT' as const,
      title: 'Checklists IA',
      desc: 'Audita l\'estat de les aules o processos del centre amb checklists intel·ligents.',
      icon: (
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      ),
      color: "bg-orange-50",
      textColor: "text-orange-600"
    },
    {
      id: 'VISION' as const,
      title: 'Visió Artificial',
      desc: 'Extracció automàtica de dades i comptatge d\'objectes mitjançant reconeixement d\'imatges.',
      icon: (
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
      ),
      color: "bg-teal-50",
      textColor: "text-teal-600"
    },
    {
      id: 'SURVEY' as const,
      title: 'Veu de les Famílies',
      desc: 'Enquestes de satisfacció i lealtat per millorar el servei educatiu amb anàlisi de sentiment.',
      icon: (
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
      color: "bg-purple-50",
      textColor: "text-purple-600"
    },
    {
      id: 'DASHBOARD' as const,
      title: 'Dashboard Unificat',
      desc: 'Totes les dades del centre (notes, faltes, enquestes) en un sol centre de comandament.',
      icon: (
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 01-2 2h22a2 2 0 01-2-2v-6a2 2 0 00-2-2h-2a2 2 0 00-2 2v6M9 19h6m-6 0l-1-1m7 1l1-1m-7 1h-1m8 1h1m-7-10V5a2 2 0 00-2-2H9a2 2 0 00-2 2v10m10 0V5a2 2 0 012-2h2a2 2 0 012 2v10m-10 0h10" />
        </svg>
      ),
      color: "bg-blue-50",
      textColor: "text-blue-600"
    },
    {
      id: 'NEXTGEN' as const,
      title: 'Fons Next Generation',
      desc: 'T’ajudem a tramitar les ajudes europees de digitalització per finançar el projecte.',
      icon: (
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      ),
      color: "bg-yellow-50",
      textColor: "text-yellow-600"
    }
  ];

  return (
    <div className="flex flex-col items-center justify-center py-6 px-4 animate-in fade-in duration-700">
      <div className="text-center mb-12 max-w-4xl w-full">
        <h1 className="text-4xl md:text-6xl font-brand text-slate-900 tracking-tighter mb-4 leading-none uppercase">
          Productes d'Eficiència<span className="text-indigo-600">.</span>
        </h1>
        <p className="text-slate-500 font-medium text-lg">Rescatem docents i directius del caos burocràtic.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full max-w-6xl">
        {products.map((product) => (
          <div 
            key={product.id} 
            onClick={() => onChoice(product.id === 'NEXTGEN' ? 'DEEP' : 'QUICK')}
            className="group bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-xl hover:border-indigo-100 transition-all cursor-pointer flex flex-col items-start gap-5"
          >
            <div className={`w-16 h-16 ${product.color} ${product.textColor} rounded-2xl flex items-center justify-center shadow-sm group-hover:scale-110 group-hover:rotate-3 transition-transform duration-500`}>
              {product.icon}
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">{product.title}</h3>
              <p className="text-xs text-slate-500 leading-relaxed font-medium">{product.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-16 w-full max-w-4xl bg-slate-900 rounded-[2.5rem] p-10 flex flex-col md:flex-row items-center justify-between gap-8 text-white relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -mr-20 -mt-20 group-hover:bg-indigo-500/20 transition-all duration-700" />
        <div className="space-y-2 text-center md:text-left relative z-10">
          <h2 className="text-3xl font-brand uppercase italic">Vols una auditoria profunda?</h2>
          <p className="text-slate-400 text-sm font-medium">Analitzem tot el centre i busquem finançament NextGen per a vosaltres.</p>
        </div>
        <button 
          onClick={() => onChoice('DEEP')}
          className="bg-white text-slate-900 px-10 py-5 rounded-2xl font-black text-[10px] uppercase tracking-[0.4em] hover:bg-indigo-50 hover:scale-105 active:scale-95 transition-all shadow-2xl shrink-0 relative z-10"
        >
          Iniciar Auditoria →
        </button>
      </div>

      <div className="mt-12 flex items-center gap-6 opacity-30 grayscale hover:grayscale-0 hover:opacity-100 transition-all duration-700 cursor-default">
        <svg className="h-6 w-auto" viewBox="0 0 30 20" fill="none">
          <rect width="30" height="20" fill="#003399"/>
          <circle cx="15" cy="10" r="1" fill="#FFCC00"/><circle cx="15" cy="6" r="1" fill="#FFCC00"/><circle cx="15" cy="14" r="1" fill="#FFCC00"/><circle cx="11" cy="10" r="1" fill="#FFCC00"/><circle cx="19" cy="10" r="1" fill="#FFCC00"/><circle cx="12.5" cy="7.5" r="1" fill="#FFCC00"/><circle cx="17.5" cy="7.5" r="1" fill="#FFCC00"/><circle cx="12.5" cy="12.5" r="1" fill="#FFCC00"/><circle cx="17.5" cy="12.5" r="1" fill="#FFCC00"/><circle cx="13.5" cy="6.2" r="1" fill="#FFCC00"/><circle cx="16.5" cy="6.2" r="1" fill="#FFCC00"/><circle cx="13.5" cy="13.8" r="1" fill="#FFCC00"/><circle cx="16.5" cy="13.8" r="1" fill="#FFCC00"/>
        </svg>
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">Finançat per fons Next Generation EU</span>
      </div>
    </div>
  );
};

export default SelectionScreen;
