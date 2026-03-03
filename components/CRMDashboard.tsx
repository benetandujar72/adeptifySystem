import React, { useState, useEffect } from 'react';
import { useLanguage } from '../LanguageContext';
import { supabase } from '../services/supabaseClient';

const CRMDashboard: React.FC = () => {
  const { t } = useLanguage();
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState<any>(null);

  useEffect(() => {
    fetchLeads();
  }, []);

  const fetchLeads = async () => {
    setLoading(true);
    try {
      // 1. Fetch leads
      const { data: leadsData, error: leadsError } = await supabase
        .from('leads')
        .select('*')
        .order('updated_at', { ascending: false });

      if (leadsError) throw leadsError;

      // 2. Fetch interactions for all leads
      const { data: interactionsData, error: interError } = await supabase
        .from('lead_interactions')
        .select('*')
        .order('created_at', { ascending: false });

      if (interError) throw interError;

      // 3. Map interactions into leads
      const enrichedLeads = (leadsData || []).map(lead => {
        const leadInteractions = (interactionsData || [])
          .filter(i => i.lead_id === lead.id)
          .map(i => ({
            type: i.interaction_type,
            time: i.created_at,
            note: i.content_summary || i.interaction_type,
            opened: i.metadata_json?.opened_at ? true : false,
            payload: i.payload_json
          }));

        // Calculate open count from metadata
        const openCount = leadInteractions.filter(i => i.opened).length;
        const lastContact = leadInteractions.length > 0 ? leadInteractions[0].time : lead.updated_at;

        return {
          ...lead,
          open_count: openCount,
          last_contacted_at: lastContact,
          interactions: leadInteractions
        };
      });

      setLeads(enrichedLeads);
    } catch (err) {
      console.error("Error fetching CRM dat:", err);
    } finally {
      setLoading(false);
    }
  };

  const renderBadge = (status: string) => {
    switch (status) {
      case 'proposal_sent': return <span className="px-3 py-1 rounded-full text-[9px] font-black uppercase bg-indigo-100 text-indigo-700">Prop. Enviada</span>;
      case 'qualified': return <span className="px-3 py-1 rounded-full text-[9px] font-black uppercase bg-blue-100 text-blue-700">Qualificat</span>;
      case 'closed': return <span className="px-3 py-1 rounded-full text-[9px] font-black uppercase bg-green-100 text-green-700">Tancat</span>;
      default: return <span className="px-3 py-1 rounded-full text-[9px] font-black uppercase bg-slate-100 text-slate-500">Nou Lead</span>;
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-4 lg:p-8 bg-[#F8FAFC] min-h-screen fade-in">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter italic">CRM DE SEGUIMENT ADEPTIFY</h2>
          <p className="text-slate-500 text-sm">Control exhaustiu d'accions, propostes i pressupostos en temps real.</p>
        </div>
        <div className="flex gap-4">
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 text-center min-w-[120px]">
            <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Leads Totals</p>
            <p className="text-2xl font-black text-indigo-600">{loading ? '-' : leads.length}</p>
          </div>
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 text-center min-w-[120px]">
            <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Apertures</p>
            <p className="text-2xl font-black text-green-600">{loading ? '-' : leads.reduce((acc, l) => acc + l.open_count, 0)}</p>
          </div>
          <button onClick={fetchLeads} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 text-slate-400 hover:text-indigo-600 transition-colors flex items-center justify-center">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Llista de Leads */}
        <div className="lg:col-span-2 bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden flex flex-col h-[800px]">
          <div className="overflow-y-auto flex-1">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-100 sticky top-0 z-10">
                <tr>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase">Institució / Empresa</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase">Estat</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase text-center">Interaccions</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase text-right">Últim Contacte</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loading && <tr><td colSpan={4} className="p-8 text-center text-slate-400">Carregant dades de Supabase...</td></tr>}
                {!loading && leads.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-slate-400">No s'han trobat institucions al CRM. Captura un Lead primer.</td></tr>}

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
                      {renderBadge(lead.status)}
                    </td>
                    <td className="px-6 py-5 text-center">
                      <div className="flex justify-center items-center gap-1">
                        {lead.open_count > 0 && <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />}
                        <span className="font-bold text-slate-700">{lead.open_count} apertures</span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1">{lead.interactions.length} historials</p>
                    </td>
                    <td className="px-6 py-5 text-right text-xs text-slate-500 font-medium">
                      {lead.last_contacted_at ? new Date(lead.last_contacted_at).toLocaleDateString() : 'Mai'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Detall de l'Acció (Timeline & DAFO) */}
        <div className="lg:col-span-1 h-[800px] overflow-y-auto pr-2 custom-scrollbar">
          {selectedLead ? (
            <div className="bg-slate-900 rounded-3xl p-8 text-white shadow-2xl">
              <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
                <span className="w-2 h-8 bg-indigo-500 rounded-full" />
                {selectedLead.company_name}
              </h3>
              <p className="text-xs text-indigo-300 mb-6">{selectedLead.email} • ID: {selectedLead.id.split('-')[0]}...</p>

              {/* DAFO / AI Analisis Resumen */}
              {selectedLead.ai_needs_analysis && (
                <div className="bg-slate-800 rounded-2xl p-4 mb-8 border border-slate-700">
                  <p className="text-[10px] font-black text-slate-400 uppercase mb-3">Diagnòstic Intel·ligent Inicial (DAFO)</p>

                  <div className="mb-3">
                    <p className="text-xs font-bold text-indigo-400 mb-1">🔥 Coll d'Ampolla Principal:</p>
                    <p className="text-sm text-slate-200">{selectedLead.ai_needs_analysis.main_bottleneck}</p>
                  </div>

                  <div className="mb-3">
                    <p className="text-xs font-bold text-green-400 mb-1">💰 Fixació de Preus Estimada:</p>
                    <p className="text-sm font-black text-white">{selectedLead.ai_needs_analysis.estimated_budget_range}</p>
                  </div>

                  {selectedLead.ai_needs_analysis.proposal_data?.cronograma?.duracion_total && (
                    <div>
                      <p className="text-xs font-bold text-yellow-400 mb-1">⏱ Temps de Projecte Típic:</p>
                      <p className="text-sm text-slate-200">{selectedLead.ai_needs_analysis.proposal_data.cronograma.duracion_total}</p>
                    </div>
                  )}
                </div>
              )}

              <h4 className="text-sm font-black text-slate-500 uppercase tracking-widest mb-4">Línia de Temps d'Interaccions</h4>

              {selectedLead.interactions.length === 0 ? (
                <p className="text-slate-500 text-sm">Cap interacció registrada encara.</p>
              ) : (
                <div className="space-y-6 relative before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-800">
                  {selectedLead.interactions.map((inter: any, i: number) => (
                    <div key={i} className="relative pl-8">
                      <div className="absolute left-0 top-1.5 w-6 h-6 bg-slate-800 border-4 border-slate-900 rounded-full z-10 flex items-center justify-center">
                        <div className={`w-2 h-2 rounded-full ${inter.type === 'proposal_sent' ? 'bg-indigo-400' : inter.opened ? 'bg-green-400' : 'bg-slate-400'}`} />
                      </div>
                      <p className="text-[10px] font-black text-indigo-400 uppercase mb-1">
                        {new Date(inter.time).toLocaleDateString()} - {new Date(inter.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                      <p className="text-sm font-bold text-slate-100">{inter.note}</p>
                      <p className="text-[10px] font-mono text-slate-500 mt-1 uppercase">{inter.type}</p>
                      {inter.opened && (
                        <p className="text-xs text-green-400 mt-1 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 bg-green-500 rounded-full inline-block"></span> LLEGIT PEL CLIENT
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-10 pt-10 border-t border-slate-800 space-y-3">
                <button className="w-full py-4 bg-indigo-600 rounded-xl font-bold text-sm hover:bg-indigo-500 transition-all flex items-center justify-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                  Reenviar Proposta
                </button>
                <button className="w-full py-3 bg-transparent border border-slate-700 text-slate-300 rounded-xl font-bold text-xs hover:bg-slate-800 transition-all">
                  Marcar com Qualificat
                </button>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center bg-white border-2 border-dashed border-slate-200 rounded-3xl p-12 text-center shadow-sm">
              <svg className="w-16 h-16 text-slate-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              <h3 className="text-lg font-bold text-slate-700 mb-2">Capta i Analitza</h3>
              <p className="text-slate-500 text-sm">Selecciona una institució de l'esquerra per veure el diagnòstic (DAFO), pressupostos estimats i el seguiment de les accions realitzades automàticament.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CRMDashboard;
