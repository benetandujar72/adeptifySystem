import React, { useState, useEffect } from 'react';
import { useLanguage } from '../LanguageContext';

const CRMDashboard: React.FC = () => {
  const { t } = useLanguage();
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState<any>(null);

  // En una app real, esto vendría de Supabase. Simulamos datos para la arquitectura.
  useEffect(() => {
    // Simulación de carga de leads con métricas de CRM
    setLeads([
      { 
        id: '1', 
        company_name: 'Escola Pia Sarrià', 
        email: 'direccio@escolapia.cat', 
        status: 'proposal_sent', 
        open_count: 3, 
        last_contacted_at: '2024-03-01T10:00:00Z',
        interactions: [
          { type: 'automated_scrape', time: '2024-03-01T09:55:00Z', note: 'Capturado de la web' },
          { type: 'proposal_sent', time: '2024-03-01T10:00:00Z', note: 'PDF Proposta v2024 enviado' },
          { type: 'email_opened', time: '2024-03-01T11:20:00Z', note: 'Abierto desde Barcelona (iPhone)' }
        ]
      },
      { 
        id: '2', 
        company_name: 'Institut Bitàcola', 
        email: 'a8064321@xtec.cat', 
        status: 'new', 
        open_count: 0, 
        last_contacted_at: null,
        interactions: [
          { type: 'automated_scrape', time: '2024-03-01T15:30:00Z', note: 'Capturado de la web' }
        ]
      }
    ]);
    setLoading(false);
  }, []);

  return (
    <div className="max-w-7xl mx-auto p-8 bg-[#F8FAFC] min-h-screen fade-in">
      <header className="flex justify-between items-center mb-10">
        <div>
          <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter italic">CRM DE SEGUIMENT ADEPTIFY</h2>
          <p className="text-slate-500 text-sm">Control exhaustiu d'accions i conversió en temps real.</p>
        </div>
        <div className="flex gap-4">
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 text-center min-w-[120px]">
            <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Leads Totals</p>
            <p className="text-2xl font-black text-indigo-600">{leads.length}</p>
          </div>
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 text-center min-w-[120px]">
            <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Apertures</p>
            <p className="text-2xl font-black text-green-600">{leads.reduce((acc, l) => acc + l.open_count, 0)}</p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Llista de Leads */}
        <div className="lg:col-span-2 bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase">Institució</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase">Estat</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase text-center">Interaccions</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase text-right">Últim Contacte</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {leads.map(lead => (
                <tr 
                  key={lead.id} 
                  onClick={() => setSelectedLead(lead)}
                  className={`hover:bg-indigo-50/30 cursor-pointer transition-all ${selectedLead?.id === lead.id ? 'bg-indigo-50 border-l-4 border-indigo-600' : ''}`}
                >
                  <td className="px-6 py-5">
                    <p className="font-bold text-slate-800">{lead.company_name}</p>
                    <p className="text-xs text-slate-400">{lead.email}</p>
                  </td>
                  <td className="px-6 py-5">
                    <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase ${
                      lead.status === 'proposal_sent' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {lead.status}
                    </span>
                  </td>
                  <td className="px-6 py-5 text-center">
                    <div className="flex justify-center items-center gap-1">
                      <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                      <span className="font-bold text-slate-700">{lead.open_count} apertures</span>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-right text-xs text-slate-500 font-medium">
                    {lead.last_contacted_at ? new Date(lead.last_contacted_at).toLocaleDateString() : 'Mai'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Detall de l'Acció (Timeline) */}
        <div className="lg:col-span-1">
          {selectedLead ? (
            <div className="bg-slate-900 rounded-3xl p-8 text-white shadow-2xl sticky top-8">
              <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                <span className="w-2 h-8 bg-indigo-500 rounded-full" />
                Línia de Temps: {selectedLead.company_name}
              </h3>
              
              <div className="space-y-8 relative before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-800">
                {selectedLead.interactions.map((inter: any, i: number) => (
                  <div key={i} className="relative pl-10">
                    <div className="absolute left-0 top-1.5 w-6 h-6 bg-slate-800 border-4 border-slate-900 rounded-full z-10 flex items-center justify-center">
                      <div className={`w-2 h-2 rounded-full ${inter.type === 'email_opened' ? 'bg-green-400' : 'bg-indigo-400'}`} />
                    </div>
                    <p className="text-[10px] font-black text-indigo-400 uppercase mb-1">
                      {new Date(inter.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                    <p className="text-sm font-bold text-slate-100">{inter.note}</p>
                    <p className="text-xs text-slate-500 mt-1">{inter.type}</p>
                  </div>
                ))}
              </div>

              <div className="mt-10 pt-10 border-t border-slate-800">
                <button className="w-full py-4 bg-indigo-600 rounded-xl font-bold text-sm hover:bg-indigo-500 transition-all flex items-center justify-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                  Reenviar Proposta
                </button>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl p-12 text-center">
              <p className="text-slate-400 text-sm">Selecciona una institució per veure el seguiment detallat de les accions realitzades.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CRMDashboard;
