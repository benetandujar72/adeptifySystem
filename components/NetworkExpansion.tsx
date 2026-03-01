
import React, { useState } from 'react';
import { useLanguage } from '../LanguageContext';

const NetworkExpansion: React.FC = () => {
  const { t } = useLanguage();
  const [reference, setReference] = useState('');
  const [location, setLocation] = useState('');
  const [expansionData, setExpansionData] = useState<any>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleExpansion = async () => {
    if (!reference) return;
    setIsAnalyzing(true);
    try {
      const resp = await fetch('/api/automation/network-prospecting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ referenceCenterName: reference, location })
      });
      const data = await resp.json();
      setExpansionData(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-10 bg-white rounded-[40px] shadow-2xl border border-slate-100 mt-10 fade-in">
      <div className="flex items-center gap-4 mb-10">
        <div className="w-12 h-12 bg-cyan-500 rounded-2xl flex items-center justify-center text-white shadow-lg">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
        </div>
        <div>
          <h2 className="text-3xl font-bold text-slate-900">{t.expansionTitle || "Expansió"}</h2>
          <p className="text-slate-500 text-sm">{t.expansionDesc || "Captació per proximitat"}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-1 space-y-6">
          <input type="text" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl" placeholder="Centre de Referència" value={reference} onChange={(e) => setReference(e.target.value)} />
          <input type="text" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl" placeholder="Zona" value={location} onChange={(e) => setLocation(e.target.value)} />
          <button onClick={handleExpansion} disabled={isAnalyzing} className="w-full py-4 bg-cyan-600 text-white rounded-xl font-bold uppercase">{isAnalyzing ? 'Processant...' : (t.expansionProjectBtn || "Projectar Nodes")}</button>
        </div>
        <div className="lg:col-span-2">
          {expansionData?.expansion_nodes?.map((node: any, i: number) => (
            <div key={i} className="p-6 mb-4 bg-slate-900 text-white rounded-3xl">
              <h4 className="text-lg font-bold text-cyan-400">{node.target_name}</h4>
              <p className="text-xs text-slate-400 mb-4">{node.reason_for_similarity}</p>
              <p className="text-sm italic opacity-80">"{node.custom_referral_pitch}"</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default NetworkExpansion;
