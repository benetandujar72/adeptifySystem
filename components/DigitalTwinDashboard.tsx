
import React, { useState, useEffect } from 'react';
import { useLanguage } from '../LanguageContext';

const DigitalTwinDashboard: React.FC = () => {
  const { t } = useLanguage();
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
      <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'linear-gradient(#334155 1px, transparent 1px), linear-gradient(90deg, #334155 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
      <div className="relative z-10">
        <header className="flex justify-between items-center mb-12">
          <div>
            <h2 className="text-3xl font-black uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-300">
              {t.twinTitle || 'Gemell Digital'}
            </h2>
            <p className="text-slate-400 text-sm mt-2">Motor Predictiu Adeptify AI</p>
          </div>
          <button onClick={runPrediction} disabled={isScanning} className="flex items-center gap-3 px-6 py-3 bg-indigo-600/20 text-indigo-400 border border-indigo-500/50 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all">
            {isScanning ? <span className="animate-pulse">Escanejant...</span> : "Actualitzar Model"}
          </button>
        </header>

        {isScanning || !prediction ? (
          <div className="h-96 flex flex-col items-center justify-center space-y-6">
            <div className="w-32 h-32 border-4 border-indigo-500/30 border-t-indigo-400 rounded-full animate-spin" />
            <p className="text-indigo-300 uppercase tracking-[0.3em] text-xs font-black animate-pulse">Sincronitzant...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="col-span-1 bg-slate-900/50 border border-slate-700/50 p-8 rounded-3xl backdrop-blur-sm">
              <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-8">{t.twinStressLevel || "Nivell d'Estrès"}</p>
              <div className="flex flex-col items-center justify-center">
                <div className="relative flex items-center justify-center">
                  <svg className="w-40 h-40 transform -rotate-90"><circle cx="80" cy="80" r="70" stroke="currentColor" strokeWidth="12" fill="transparent" className="text-slate-800" /><circle cx="80" cy="80" r="70" stroke="currentColor" strokeWidth="12" fill="transparent" strokeDasharray={440} strokeDashoffset={440 - (440 * (prediction.stress_level || 0)) / 100} className={(prediction.stress_level || 0) > 70 ? 'text-red-500' : 'text-amber-500'} /></svg>
                  <div className="absolute flex flex-col items-center"><span className="text-5xl font-black">{prediction.stress_level || 0}%</span></div>
                </div>
              </div>
            </div>
            <div className="col-span-2 space-y-6">
              <h3 className="text-xs text-indigo-400 uppercase tracking-[0.2em] font-black mb-4">{t.twinAlertsTitle || "Alertes"}</h3>
              {prediction.predictions?.map((p: any, i: number) => (
                <div key={i} className="bg-slate-800/40 border border-slate-700/50 p-6 rounded-2xl flex gap-6">
                  <div className="flex-1">
                    <h4 className="text-lg font-bold text-slate-100">{p.risk_title}</h4>
                    <p className="text-sm text-slate-400 mb-4">{p.description}</p>
                    <div className="p-4 bg-indigo-900/30 border border-indigo-500/30 rounded-xl">
                      <p className="text-[10px] text-indigo-300 uppercase font-bold mb-1">Acció Suggerida</p>
                      <p className="text-sm text-indigo-100">{p.suggested_action}</p>
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
