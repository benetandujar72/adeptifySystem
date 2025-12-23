
import React from 'react';
import { ProductType } from '../types';

interface SelectionScreenProps {
  onChoice: (choice: ProductType | 'DOCS') => void;
}

const SelectionScreen: React.FC<SelectionScreenProps> = ({ onChoice }) => {
  const products = [
    {
      id: 'LMS' as ProductType,
      title: 'Vida Escolar Sencilla',
      desc: 'Centraliza notas, tareas y comunicación sin que parezca que estás trabajando en un banco. Simple para el docente, claro para el alumno.',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      ),
      accent: "border-indigo-100"
    },
    {
      id: 'AUDIT' as ProductType,
      title: 'Asistente Anti-Papeleo',
      desc: 'Convierte tus reuniones y notas en informes oficiales al instante. Cumple con la normativa sin sacrificar tus fines de semana.',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      ),
      accent: "border-slate-100"
    },
    {
      id: 'VISION' as ProductType,
      title: 'Seguridad y Bienestar',
      desc: 'Control de accesos y tranquilidad en el patio. Tecnología que cuida de los alumnos mientras tú te enfocas en liderar.',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      ),
      accent: "border-slate-100"
    }
  ];

  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 fade-up">
      <div className="text-center mb-16 max-w-3xl">
        <h1 className="text-5xl md:text-6xl font-serif text-slate-900 mb-6 leading-tight">
          Educad con pasión. <br/><span className="italic text-indigo-700 font-normal">Nosotros nos encargamos del papeleo.</span>
        </h1>
        <p className="text-slate-500 font-medium text-lg max-w-xl mx-auto leading-relaxed">
          Elija el área donde su equipo se siente más desbordado para que podamos ayudarles hoy mismo.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-6xl mb-20">
        {products.map((product) => (
          <div 
            key={product.id} 
            onClick={() => onChoice(product.id)}
            className="group bg-white p-10 rounded-2xl border border-slate-100 shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:shadow-[0_20px_40px_rgba(0,0,0,0.06)] hover:border-indigo-200 transition-all duration-500 cursor-pointer flex flex-col items-start text-left gap-6"
          >
            <div className="w-12 h-12 bg-slate-50 text-slate-900 rounded-xl flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-all duration-500">
              {product.icon}
            </div>
            <div className="space-y-3">
              <h3 className="text-xl font-bold text-slate-900 tracking-tight">{product.title}</h3>
              <p className="text-sm text-slate-500 leading-relaxed font-medium">{product.desc}</p>
            </div>
            <div className="mt-4 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-indigo-600 group-hover:translate-x-2 transition-transform">
              Empezar ahora
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
            </div>
          </div>
        ))}
      </div>

      <div className="w-full max-w-5xl bg-slate-950 rounded-2xl p-12 text-white flex flex-col md:flex-row items-center justify-between gap-10 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-[100px] -mr-40 -mt-40" />
        <div className="space-y-4 relative z-10 max-w-lg">
          <h2 className="text-3xl font-serif italic">Transformación Completa del Centro</h2>
          <p className="text-slate-400 text-sm leading-relaxed font-medium">
            Si siente que "todo" es urgente, analizaremos juntos cada rincón de su gestión para devolverle la calma a su sala de profesores.
          </p>
        </div>
        <button 
          onClick={() => onChoice('DEEP_AUDIT')}
          className="bg-white text-slate-900 px-10 py-5 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-indigo-50 hover:scale-105 active:scale-95 transition-all shadow-xl shrink-0 relative z-10 btn-premium"
        >
          Diagnóstico Global de Calma
        </button>
      </div>
    </div>
  );
};

export default SelectionScreen;
