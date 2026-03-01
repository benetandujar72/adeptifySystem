import React, { useState } from 'react';

const NetworkExpansion: React.FC = () => {
  const { t } = useLanguage();
  const [reference, setReference] = useState('');
  const [location, setLocation] = useState('');
  const [expansionData, setExpansionData] = useState<any>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // ... logic

  return (
    <div className="max-w-5xl mx-auto p-10 bg-white rounded-[40px] shadow-2xl border border-slate-100 mt-10 fade-in">
      <div className="flex items-center gap-4 mb-10">
        <div className="w-12 h-12 bg-cyan-500 rounded-2xl flex items-center justify-center text-white shadow-lg">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
        </div>
        <div>
          <h2 className="text-3xl font-bold text-slate-900">{t.expansionTitle}</h2>
          <p className="text-slate-500 text-sm">{t.expansionDesc}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Configuración */}
        <div className="lg:col-span-1 space-y-6">
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Caso de Éxito (Centro Referencia)</label>
            <input 
              type="text" 
              className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-cyan-500 outline-none transition-all"
              placeholder="Ej: Escola Pia Sarrià"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          </div>
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Ubicación / Zona</label>
            <input 
              type="text" 
              className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-cyan-500 outline-none transition-all"
              placeholder="Ej: Barcelona, Sarrià"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>
          <button 
            onClick={handleExpansion}
            disabled={isAnalyzing || !reference}
            className="w-full py-4 bg-cyan-600 text-white rounded-xl font-black uppercase tracking-widest hover:bg-cyan-700 transition-all disabled:opacity-50"
          >
            {isAnalyzing ? '...' : t.expansionProjectBtn}
          </button>
        </div>

        {/* Visualización del Grafo / Resultados */}
        <div className="lg:col-span-2">
          {expansionData ? (
            <div className="space-y-6">
              <div className="p-4 bg-cyan-50 border border-cyan-100 rounded-2xl">
                <p className="text-[10px] font-black text-cyan-700 uppercase tracking-widest mb-1">Nota Estratégica IA</p>
                <p className="text-sm text-cyan-900 italic">{expansionData.strategy_note}</p>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {expansionData?.expansion_nodes?.map((node: any, i: number) => (
                  <div key={i} className="p-6 bg-slate-900 text-white rounded-3xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-30 transition-opacity">
                      <svg className="w-20 h-20" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" /></svg>
                    </div>
                    <h4 className="text-lg font-bold mb-1 text-cyan-400">{node.target_name}</h4>
                    <p className="text-[10px] uppercase font-bold text-slate-500 mb-4">{node.reason_for_similarity}</p>
                    
                    <div className="p-4 bg-white/5 rounded-xl border border-white/10 mb-4">
                      <p className="text-[10px] font-black text-slate-400 uppercase mb-2">Mensaje de Referral IA:</p>
                      <p className="text-xs text-slate-300 leading-relaxed italic">"{node.custom_referral_pitch}"</p>
                    </div>

                    <button className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-cyan-400 hover:text-cyan-300 transition-colors">
                      Enviar Campaña de Vecindad
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center border-2 border-dashed border-slate-100 rounded-[32px] p-12 text-center">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 text-slate-300">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              </div>
              <p className="text-slate-400 text-sm font-medium">Elige un centro de referencia para ver los nodos de expansión sugeridos por la IA.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NetworkExpansion;
