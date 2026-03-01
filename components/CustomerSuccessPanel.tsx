import React, { useState, useEffect } from 'react';
import { useLanguage } from '../LanguageContext';

const CustomerSuccessPanel: React.FC = () => {
  const [centers, setCenters] = useState<any[]>([
    { id: 1, name: 'Colegio Internacional Nord', usage: { last_login_days: 1, docs_generated: 450, active_users: 25 }, email: 'director@nord.com' },
    { id: 2, name: 'Escola El Bosc', usage: { last_login_days: 12, docs_generated: 10, active_users: 2 }, email: 'info@elbosc.cat' },
    { id: 3, name: 'Institut Tecnològic Delta', usage: { last_login_days: 2, docs_generated: 800, active_users: 40 }, email: 'admin@delta.edu' }
  ]);
  const [analysisResults, setAnalysisResult] = useState<any>({});
  const [loadingId, setLoadingId] = useState<number | null>(null);

  const analyzeCenter = async (id: number, metrics: any, email: string) => {
    setLoadingId(id);
    try {
      const resp = await fetch('/api/automation/usage-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantSlug: 'admin', usageMetrics: { ...metrics, contact_email: email } })
      });
      const data = await resp.json();
      setAnalysisResult((prev: any) => ({ ...prev, [id]: data }));
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="bg-white rounded-[32px] p-8 shadow-xl border border-slate-100 fade-in">
      <div className="flex justify-between items-center mb-10">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Panel de Customer Success</h2>
          <p className="text-sm text-slate-500">IA analizando el uso para prevenir fugas y maximizar ingresos.</p>
        </div>
        <div className="flex gap-2">
          <span className="flex items-center gap-1.5 px-3 py-1 bg-green-50 text-green-600 rounded-full text-[10px] font-bold uppercase tracking-wider border border-green-100">Healthy</span>
          <span className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-600 rounded-full text-[10px] font-bold uppercase tracking-wider border border-amber-100">At Risk</span>
          <span className="flex items-center gap-1.5 px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-bold uppercase tracking-wider border border-indigo-100">Upsell</span>
        </div>
      </div>

      <div className="space-y-4">
        {centers?.map(center => {
          const res = analysisResults[center.id];
          return (
            <div key={center.id} className="p-6 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between group hover:bg-white hover:shadow-lg transition-all">
              <div className="flex items-center gap-6">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-white shadow-md \${
                  res?.status === 'Healthy' ? 'bg-green-500' : 
                  res?.status === 'At Risk' ? 'bg-amber-500' : 
                  res?.status === 'Upsell Target' ? 'bg-indigo-600' : 'bg-slate-300'
                }`}>
                  {center?.name?.charAt(0)}
                </div>
                <div>
                  <h4 className="font-bold text-slate-800">{center.name}</h4>
                  <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">
                    {center?.usage?.docs_generated} Docs · {center?.usage?.active_users} Users · Último acceso: {center?.usage?.last_login_days}d
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                {res ? (
                  <div className="text-right">
                    <div className="flex items-center justify-end gap-2 mb-1">
                      <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                        res.status === 'Healthy' ? 'bg-green-100 text-green-700' : 
                        res.status === 'At Risk' ? 'bg-red-100 text-red-700' : 'bg-indigo-100 text-indigo-700'
                      }`}>
                        {res.status} ({res.health_score}%)
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 max-w-[200px] truncate">{res.analysis_summary}</p>
                  </div>
                ) : (
                  <button 
                    onClick={() => analyzeCenter(center.id, center.usage, center.email)}
                    disabled={loadingId === center.id}
                    className="px-4 py-2 bg-white border border-slate-200 text-[10px] font-black uppercase rounded-lg hover:border-indigo-500 hover:text-indigo-600 transition-all disabled:opacity-50"
                  >
                    {loadingId === center.id ? 'Analizando...' : 'Analizar con IA'}
                  </button>
                )}
                
                {res?.automated_email?.send_now && (
                  <div className="w-8 h-8 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center animate-bounce" title="Email de Upsell Enviado">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" /><path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" /></svg>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CustomerSuccessPanel;
