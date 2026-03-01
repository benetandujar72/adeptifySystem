import React, { useState, useEffect } from 'react';

const DigitalTwinDashboard: React.FC = () => {
  const [prediction, setPrediction] = useState<any>(null);
  const [isScanning, setIsScanning] = useState(false);

  const runPrediction = async () => {
    setIsScanning(true);
    try {
      const resp = await fetch('/api/automation/digital-twin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantSlug: 'demo', context: { staff: 65, avg_absences: 4 } })
      });
      const data = await resp.json();
      setPrediction(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsScanning(false);
    }
  };

  useEffect(() => {
    runPrediction();
  }, []);

  return (
    <div className="max-w-6xl mx-auto p-10 bg-[#0f172a] rounded-[40px] shadow-2xl border border-slate-800 mt-10 fade-in text-white overflow-hidden relative">
      {/* Background Cyber-grid */}
      <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'linear-gradient(#334155 1px, transparent 1px), linear-gradient(90deg, #334155 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

      <div className="relative z-10">
        <header className="flex justify-between items-center mb-12">
          <div>
            <h2 className="text-3xl font-black uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-300">
              Gemelo Digital
            </h2>
            <p className="text-slate-400 text-sm mt-2">Motor Predictivo Adeptify AI</p>
          </div>
          <button 
            onClick={runPrediction}
            disabled={isScanning}
            className="flex items-center gap-3 px-6 py-3 bg-indigo-600/20 text-indigo-400 border border-indigo-500/50 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all"
          >
            {isScanning ? (
              <span className="animate-pulse">Escaneando Centro...</span>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                Actualizar Modelo
              </>
            )}
          </button>
        </header>

        {isScanning || !prediction ? (
          <div className="h-96 flex flex-col items-center justify-center space-y-6">
            <div className="w-32 h-32 border-4 border-indigo-500/30 border-t-indigo-400 rounded-full animate-spin" />
            <p className="text-indigo-300 uppercase tracking-[0.3em] text-xs font-black animate-pulse">Sincronizando Gemelo...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Status */}
            <div className="col-span-1 bg-slate-900/50 border border-slate-700/50 p-8 rounded-3xl backdrop-blur-sm">
              <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-8">Nivel de Estrés Operativo</p>
              <div className="flex flex-col items-center justify-center">
                <div className="relative flex items-center justify-center">
                  <svg className="w-40 h-40 transform -rotate-90">
                    <circle cx="80" cy="80" r="70" stroke="currentColor" strokeWidth="12" fill="transparent" className="text-slate-800" />
                    <circle cx="80" cy="80" r="70" stroke="currentColor" strokeWidth="12" fill="transparent" strokeDasharray={440} strokeDashoffset={440 - (440 * prediction.stress_level) / 100} className={prediction.stress_level > 70 ? 'text-red-500' : 'text-amber-500'} />
                  </svg>
                  <div className="absolute flex flex-col items-center">
                    <span className="text-5xl font-black">{prediction.stress_level}%</span>
                  </div>
                </div>
                <div className="mt-8 text-center w-full">
                  <p className="text-xs text-slate-400 mb-2">Foco Crítico Detectado:</p>
                  <div className="py-2 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl text-sm font-bold uppercase tracking-widest">
                    {prediction.critical_department}
                  </div>
                </div>
              </div>
            </div>

            {/* Predictions List */}
            <div className="col-span-2 space-y-6">
              <h3 className="text-xs text-indigo-400 uppercase tracking-[0.2em] font-black mb-4">Alertas Tempranas (Próximos 30 días)</h3>
              
              {prediction.predictions.map((p: any, i: number) => (
                <div key={i} className="bg-slate-800/40 border border-slate-700/50 p-6 rounded-2xl flex gap-6 hover:bg-slate-800/60 transition-all group">
                  <div className="flex-shrink-0 pt-1">
                    {p.probability === 'Alta' ? (
                      <div className="w-4 h-4 bg-red-500 rounded-full shadow-[0_0_15px_rgba(239,68,68,0.6)] animate-pulse" />
                    ) : (
                      <div className="w-4 h-4 bg-amber-500 rounded-full shadow-[0_0_15px_rgba(245,158,11,0.6)]" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="text-lg font-bold text-slate-100">{p.risk_title}</h4>
                      <span className="px-3 py-1 bg-slate-900 text-slate-400 text-[9px] font-black uppercase tracking-widest rounded-lg">
                        Impacto: {p.time_to_impact}
                      </span>
                    </div>
                    <p className="text-sm text-slate-400 mb-6 leading-relaxed">{p.description}</p>
                    
                    <div className="p-4 bg-indigo-900/30 border border-indigo-500/30 rounded-xl flex justify-between items-center">
                      <div>
                        <p className="text-[10px] text-indigo-300 uppercase tracking-widest font-bold mb-1">Solución Preventiva IA</p>
                        <p className="text-sm text-indigo-100 font-medium">{p.suggested_action}</p>
                      </div>
                      <button className="px-6 py-2 bg-indigo-600 text-white text-xs font-bold rounded-lg shadow-lg hover:bg-indigo-500 transition-all opacity-0 group-hover:opacity-100 translate-x-4 group-hover:translate-x-0">
                        Activar Protocolo
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DigitalTwinDashboard;
