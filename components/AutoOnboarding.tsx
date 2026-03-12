
import React, { useState } from 'react';
import { useLanguage } from '../LanguageContext';

const AutoOnboarding: React.FC = () => {
  const { t } = useLanguage();
  const [rawData, setRawData] = useState('');
  const [migrationResult, setMigrationResult] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState('');

  const handleMigrate = async () => {
    if (!rawData) return;
    setIsProcessing(true);
    setStatus('Processing data...');
    try {
      const resp = await fetch('/api/automation/migrate-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawData })
      });
      const data = await resp.json();
      setMigrationResult(data);
      setStatus('Migration completed.');
    } catch (err) {
      setStatus('Migration error.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-10 bg-white rounded-[40px] shadow-2xl border border-slate-100 mt-10 fade-in">
      <div className="flex items-center gap-4 mb-10">
        <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
        </div>
        <div>
          <h2 className="text-3xl font-bold text-slate-900">{t.onboardingTitle || "Auto-Onboarding"}</h2>
          <p className="text-slate-500 text-sm">{t.onboardingDesc || "Automatic data organisation"}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        <div className="space-y-6">
          <textarea className="w-full h-80 p-6 bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl outline-none" placeholder="Paste data here..." value={rawData} onChange={(e) => setRawData(e.target.value)} />
          <button onClick={handleMigrate} disabled={isProcessing} className="w-full py-5 bg-slate-900 text-white rounded-2xl font-bold uppercase tracking-widest">{isProcessing ? 'Processing...' : (t.onboardingProcessBtn || "Structure Data")}</button>
          <p className="text-center text-xs font-bold text-indigo-600">{status}</p>
        </div>
        <div className="bg-slate-900 rounded-[32px] p-8 text-white shadow-inner overflow-auto min-h-[400px]">
          <h3 className="text-xs font-black uppercase text-indigo-400 mb-6">AI Preview</h3>
          {migrationResult?.mapped_staff?.map((s: any, i: number) => (
            <div key={i} className="p-3 mb-2 bg-white/5 rounded-lg text-xs border border-white/5 flex justify-between">
              <span className="font-bold">{s.full_name}</span>
              <span className="text-indigo-300">{s.department}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AutoOnboarding;
