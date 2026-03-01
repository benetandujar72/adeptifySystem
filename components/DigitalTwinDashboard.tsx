import React, { useState, useEffect } from 'react';
import { useLanguage } from '../LanguageContext';

const DigitalTwinDashboard: React.FC = () => {
  const { t } = useLanguage();
  const [prediction, setPrediction] = useState<any>(null);
  const [isScanning, setIsScanning] = useState(false);

  // ... logic

  return (
    <div className="max-w-6xl mx-auto p-10 bg-[#0f172a] rounded-[40px] shadow-2xl border border-slate-800 mt-10 fade-in text-white overflow-hidden relative">
      {/* Background Cyber-grid */}
      <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'linear-gradient(#334155 1px, transparent 1px), linear-gradient(90deg, #334155 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

      <div className="relative z-10">
        <header className="flex justify-between items-center mb-12">
          <div>
            <h2 className="text-3xl font-black uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-300">
              {t.twinTitle}
            </h2>
            <p className="text-slate-400 text-sm mt-2">Motor Predictivo Adeptify AI</p>
          </div>
          {/* ... */}
        </header>

        {isScanning || !prediction ? (
          <div className="h-96 flex flex-col items-center justify-center space-y-6">
            <div className="w-32 h-32 border-4 border-indigo-500/30 border-t-indigo-400 rounded-full animate-spin" />
            <p className="text-indigo-300 uppercase tracking-[0.3em] text-xs font-black animate-pulse">Sincronitzant...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Status */}
            <div className="col-span-1 bg-slate-900/50 border border-slate-700/50 p-8 rounded-3xl backdrop-blur-sm">
              <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-8">{t.twinStressLevel}</p>
              {/* ... SVG chart */}
            </div>

            {/* Predictions List */}
            <div className="col-span-2 space-y-6">
              <h3 className="text-xs text-indigo-400 uppercase tracking-[0.2em] font-black mb-4">{t.twinAlertsTitle}</h3>
              
              {prediction?.predictions?.map((p: any, i: number) => (
                <div key={i} className="bg-slate-800/40 border border-slate-700/50 p-6 rounded-2xl flex gap-6 hover:bg-slate-800/60 transition-all group">
                  {/* ... */}
                  <div className="flex-1">
                    {/* ... */}
                    <div className="p-4 bg-indigo-900/30 border border-indigo-500/30 rounded-xl flex justify-between items-center">
                      <div>
                        <p className="text-[10px] text-indigo-300 uppercase tracking-widest font-bold mb-1">Solución Preventiva IA</p>
                        <p className="text-sm text-indigo-100 font-medium">{p.suggested_action}</p>
                      </div>
                      <button className="px-6 py-2 bg-indigo-600 text-white text-xs font-bold rounded-lg shadow-lg hover:bg-indigo-500 transition-all opacity-0 group-hover:opacity-100 translate-x-4 group-hover:translate-x-0">
                        {t.twinActionBtn}
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
