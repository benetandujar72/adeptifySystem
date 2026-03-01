import React, { useState } from 'react';
import { useLanguage } from '../LanguageContext';

const AutoOnboarding: React.FC = () => {
  const { t } = useLanguage();
  const [rawData, setRawData] = useState('');
  const [migrationResult, setMigrationResult] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState('');

  // ... (logic)

  return (
    <div className="max-w-5xl mx-auto p-10 bg-white rounded-[40px] shadow-2xl border border-slate-100 mt-10 fade-in">
      <div className="flex items-center gap-4 mb-10">
        <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
        </div>
        <div>
          <h2 className="text-3xl font-bold text-slate-900">{t.onboardingTitle}</h2>
          <p className="text-slate-500 text-sm">{t.onboardingDesc}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* Entrada de datos */}
        <div className="space-y-6">
          <div className="relative">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 block">Datos Brutos del Centro</label>
            <textarea 
              className="w-full h-80 p-6 bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl focus:ring-4 focus:ring-indigo-50 focus:border-indigo-500 outline-none transition-all font-mono text-xs"
              placeholder="..."
              value={rawData}
              onChange={(e) => setRawData(e.target.value)}
            />
          </div>
          <button 
            onClick={handleMigrate}
            disabled={isProcessing || !rawData}
            className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-slate-800 transition-all disabled:opacity-50 shadow-xl"
          >
            {isProcessing ? '...' : t.onboardingProcessBtn}
          </button>
          {status && <p className="text-center text-sm font-bold text-indigo-600 animate-pulse">{status}</p>}
        </div>

        {/* Previsualización IA */}
        <div className="bg-slate-900 rounded-[32px] p-8 text-white shadow-inner min-h-[400px] flex flex-col">
          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-indigo-400 mb-6">Previsualización de Estructura IA</h3>
          
          {migrationResult ? (
            <div className="flex-1 overflow-auto space-y-6">
              <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                <p className="text-[10px] text-slate-500 uppercase font-bold mb-2">Resumen de Migración</p>
                <p className="text-sm text-indigo-100">{migrationResult.migration_summary}</p>
              </div>

              <div>
                <p className="text-[10px] text-slate-500 uppercase font-bold mb-4">Personal Detectado ({migrationResult.mapped_staff?.length})</p>
                <div className="space-y-2">
                  {migrationResult.mapped_staff?.map((s: any, i: number) => (
                    <div key={i} className="flex justify-between items-center p-3 bg-white/5 rounded-lg text-xs border border-white/5">
                      <span className="font-bold">{s.full_name}</span>
                      <span className="text-indigo-300 opacity-70">{s.department || 'General'}</span>
                    </div>
                  ))}
                </div>
              </div>

              <button className="w-full py-4 bg-indigo-600 rounded-xl font-bold text-sm mt-auto hover:bg-indigo-500 transition-all">
                Confirmar e Importar al Sistema
              </button>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4 opacity-30">
              <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.364-6.364l-.707-.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M12 13a3 3 0 100-6 3 3 0 000 6z" /></svg>
              <p className="text-xs uppercase font-black tracking-widest leading-loose">Esperando datos<br/>para procesar...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AutoOnboarding;
