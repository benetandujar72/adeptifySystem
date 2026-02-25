
import React, { useState, useEffect } from 'react';
import { consultationService } from '../services/consultationService';
import { supabase } from '../services/supabaseClient';
import { Consultation, ChatMessage, ProposalData } from '../types';
import { useLanguage } from '../LanguageContext';
import { generateCenterDAFO, generateCenterCustomProposal, DafoResult } from '../services/geminiService';
import { centerInsightsService, normalizeCenterKey } from '../services/centerInsightsService';
import { aiUsageService } from '../services/aiUsageService';
import ReportCenter from './ReportCenter';
import AdminClientProfile from './AdminClientProfile';
import KnowledgeBase from './KnowledgeBase';

type AdminTab = 'overview' | 'clients' | 'proposals' | 'chats' | 'reports' | 'knowledge';

type AdminRegistryProps = {
  tenantSlug?: string;
  adminScope?: 'tenant' | 'all';
};

const AdminRegistry: React.FC<AdminRegistryProps> = ({ tenantSlug, adminScope = 'tenant' }) => {
  const { t, language } = useLanguage();
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [selectedClient, setSelectedClient] = useState<Consultation | null>(null);
  const [clientChats, setClientChats] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dbMode, setDbMode] = useState<'cloud' | 'local'>('local');
  const [expandedBudgetId, setExpandedBudgetId] = useState<string | null>(null);
  const [showExtendedBudget, setShowExtendedBudget] = useState(false);
  const [dafoCache, setDafoCache] = useState<Record<string, DafoResult>>({});
  const [customProposalCache, setCustomProposalCache] = useState<Record<string, ProposalData>>({});
  const [dafoLoadingKey, setDafoLoadingKey] = useState<string | null>(null);
  const [customLoadingKey, setCustomLoadingKey] = useState<string | null>(null);
  const [centerInsightError, setCenterInsightError] = useState<string | null>(null);
  const [, setAiTotalsVersion] = useState(0);

  const navigateAdmin = (adminPath: string) => {
    const basePath = tenantSlug ? `/t/${encodeURIComponent(tenantSlug)}` : '';
    window.history.pushState({}, '', `${basePath}${adminPath}`);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  const getTenantForConsultation = (c: Consultation) => (c.tenantSlug || tenantSlug || 'global');
  const getClientKey = (c: Consultation) => {
    const centerKey = normalizeCenterKey(c.centerName);
    if (adminScope === 'all') return `${getTenantForConsultation(c)}::${centerKey}`;
    return centerKey;
  };

  const getAdminClientKeyFromPath = (pathname: string): string | null => {
    let path = pathname;
    if (tenantSlug) {
      const rawPrefix = `/t/${tenantSlug}`;
      const encodedPrefix = `/t/${encodeURIComponent(tenantSlug)}`;
      if (path.startsWith(rawPrefix)) path = path.slice(rawPrefix.length) || '/';
      else if (path.startsWith(encodedPrefix)) path = path.slice(encodedPrefix.length) || '/';
    }
    const match = path.match(/^\/admin\/clients\/([^/?#]+)/);
    return match ? decodeURIComponent(match[1]) : null;
  };

  useEffect(() => {
    loadAllData();
  }, [tenantSlug, adminScope]);

  useEffect(() => {
    const syncSelectionFromUrl = () => {
      const keyFromUrl = getAdminClientKeyFromPath(window.location.pathname);
      if (!keyFromUrl) return;
      setActiveTab('clients');
      const wantedKey = adminScope === 'all' ? keyFromUrl : normalizeCenterKey(keyFromUrl);
      const match = consultations.find(c => getClientKey(c) === wantedKey);
      if (match) setSelectedClient(match);
    };

    syncSelectionFromUrl();
    window.addEventListener('popstate', syncSelectionFromUrl);
    return () => window.removeEventListener('popstate', syncSelectionFromUrl);
  }, [consultations, tenantSlug, adminScope]);


  const loadAllData = async () => {
    setIsLoading(true);
    try {
      setDbMode(supabase ? 'cloud' : 'local');
      const scopeTenant = adminScope === 'all' ? undefined : tenantSlug;
      const data = await consultationService.getAll(scopeTenant);
      setConsultations(data);
      if (data.length > 0 && !selectedClient) {
        setSelectedClient(data[0]);
      }
    } catch (e) {
      console.error("Error carregant dades d'administració");
    } finally {
      setIsLoading(false);
    }
  };

  const loadClientChats = async (centerId: string) => {
    const history = await consultationService.getChatHistory(centerId);
    setClientChats(history);
  };

  const persistDafoCache = (next: Record<string, DafoResult>) => setDafoCache(next);
  const persistCustomProposalCache = (next: Record<string, ProposalData>) => setCustomProposalCache(next);

  const getCenterHistories = (c: Consultation) => {
    const wanted = getClientKey(c);
    return consultations
      .filter(x => getClientKey(x) === wanted)
      .map(x => x.consultationHistory || []);
  };

  const onGenerateDafo = async (c: Consultation) => {
    const key = getClientKey(c);
    const centerName = c.centerName;
    const scopeTenant = adminScope === 'all' ? c.tenantSlug : tenantSlug;
    setCenterInsightError(null);
    setDafoLoadingKey(key);
    try {
      const histories = getCenterHistories(c);
      const dafo = await generateCenterDAFO(centerName, histories, language);
      await centerInsightsService.upsertDafo(centerName, dafo, scopeTenant);
      persistDafoCache({ ...dafoCache, [key]: dafo });
    } catch (e: any) {
      setCenterInsightError(typeof e?.message === 'string' ? e.message : String(e));
    } finally {
      setDafoLoadingKey(null);
    }
  };

  const onGenerateCustomProposal = async (c: Consultation) => {
    const key = getClientKey(c);
    const centerName = c.centerName;
    const scopeTenant = adminScope === 'all' ? c.tenantSlug : tenantSlug;
    setCenterInsightError(null);
    setCustomLoadingKey(key);
    try {
      const histories = getCenterHistories(c);
      let dafo = dafoCache[key];
      if (!dafo) {
        const existing = await centerInsightsService.get(centerName, scopeTenant);
        if (existing?.dafo) {
          dafo = existing.dafo;
          persistDafoCache({ ...dafoCache, [key]: dafo });
        }
      }
      if (!dafo) {
        dafo = await generateCenterDAFO(centerName, histories, language);
        await centerInsightsService.upsertDafo(centerName, dafo, scopeTenant);
        persistDafoCache({ ...dafoCache, [key]: dafo });
      }
      const proposal = await generateCenterCustomProposal(centerName, histories, dafo, language);
      await centerInsightsService.upsertCustomProposal(centerName, proposal, scopeTenant);
      persistCustomProposalCache({ ...customProposalCache, [key]: proposal });
    } catch (e: any) {
      setCenterInsightError(typeof e?.message === 'string' ? e.message : String(e));
    } finally {
      setCustomLoadingKey(null);
    }
  };

  useEffect(() => {
    if (selectedClient && activeTab === 'chats') {
      const centerId = selectedClient.tenantSlug
        ? `${selectedClient.tenantSlug}::${selectedClient.centerName}`
        : (tenantSlug ? `${tenantSlug}::${selectedClient.centerName}` : selectedClient.centerName);
      loadClientChats(centerId);
    }
  }, [selectedClient, activeTab]);

  const totalInvestment = consultations.reduce((acc, c) => acc + (c.proposal?.totalInitial || 0), 0);
  const aiTotals = aiUsageService.totals();

  return (
    <div className="flex flex-col lg:flex-row gap-8 min-h-[80vh] animate-in fade-in duration-700">

      {/* SIDEBAR NAVIGATION */}
      <aside className="lg:w-64 flex flex-col gap-2 shrink-0">
        <div className="bg-slate-900 rounded-[2rem] p-6 mb-4 shadow-xl border border-white/5">
          <p className="text-[8px] font-black text-indigo-400 uppercase tracking-[0.3em] mb-1">{t.adminStatus}</p>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${dbMode === 'cloud' ? 'bg-green-500 animate-pulse' : 'bg-amber-500'}`} />
            <span className="text-[9px] font-black text-white uppercase tracking-widest">{dbMode === 'cloud' ? t.adminDbCloud : t.adminDbLocal} {t.adminOnline}</span>
          </div>
        </div>

        {[
          { id: 'overview', label: t.adminTabDashboard, icon: 'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z' },
          { id: 'clients', label: t.adminTabClients, icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z' },
          { id: 'proposals', label: t.adminTabProposals, icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
          { id: 'chats', label: t.adminTabChats, icon: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z' },
          { id: 'knowledge', label: language === 'ca' ? 'Base de Coneixement' : 'Base de Conocimiento', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
          { id: 'reports', label: t.adminTabReports, icon: 'M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as AdminTab)}
            className={`flex items-center gap-4 p-5 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${activeTab === tab.id
                ? 'bg-slate-900 text-white shadow-lg border border-white/10'
                : 'bg-white text-slate-400 hover:bg-slate-50 border border-slate-100'
              }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={tab.icon} />
            </svg>
            {tab.label}
          </button>
        ))}
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 space-y-8">

        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col justify-between h-48">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t.adminCentersInAudit}</p>
              <h4 className="text-5xl font-serif italic text-slate-900">{consultations.length}</h4>
              <p className="text-[9px] text-green-600 font-bold">{t.adminVsPrevMonth}</p>
            </div>
            <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white shadow-2xl flex flex-col justify-between h-48 border border-white/5">
              <p className="text-[10px] font-black text-indigo-300 uppercase tracking-widest">{t.adminBudgetVolume}</p>
              <h4 className="text-4xl font-serif italic">{totalInvestment.toLocaleString()}€</h4>
              <p className="text-[9px] text-white/40 font-bold uppercase tracking-widest italic">{t.adminActiveLabel}</p>
            </div>
            <div className="bg-indigo-600 p-8 rounded-[2.5rem] text-white shadow-xl flex flex-col justify-between h-48">
              <p className="text-[10px] font-black text-white/70 uppercase tracking-widest">{t.adminAutomationAvg}</p>
              <h4 className="text-5xl font-serif italic">4.2<span className="text-xl ml-1 font-sans font-bold">{t.adminDays}</span></h4>
              <div className="h-1.5 w-full bg-white/20 rounded-full overflow-hidden">
                <div className="h-full bg-white w-3/4" />
              </div>
            </div>

            <div className="md:col-span-3 bg-white p-10 rounded-[2.5rem] border border-slate-100">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                <div>
                  <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">{t.adminAiUsageTitle}</h3>
                  <p className="mt-2 text-sm text-slate-500 font-medium">
                    {t.adminAiUsageTotalTokens}: <span className="font-black text-slate-900">{aiTotals.totalTokens.toLocaleString()}</span>
                    {' • '}
                    {t.adminAiUsageEstimatedCost}: <span className="font-black text-slate-900">{aiTotals.costEur.toLocaleString()}€</span>
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    onClick={() => aiUsageService.exportJson()}
                    className="bg-slate-900 text-white px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-[0.22em] hover:bg-indigo-600 transition-all shadow-lg"
                  >
                    {t.adminAiUsageExport}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const ok = window.confirm(language === 'ca'
                        ? "Vols esborrar el registre d'ús d'IA d'aquest navegador?"
                        : language === 'eu'
                          ? "Nabigatzaile honetako IA erabilera erregistroa ezabatu nahi duzu?"
                          : '¿Quieres borrar el registro de uso de IA de este navegador?');
                      if (!ok) return;
                      aiUsageService.clear();
                      setAiTotalsVersion(v => v + 1);
                    }}
                    className="bg-white text-slate-900 px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-[0.22em] border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50 transition-all"
                  >
                    {t.adminAiUsageClear}
                  </button>
                </div>
              </div>
            </div>

            <div className="md:col-span-3 bg-white p-10 rounded-[2.5rem] border border-slate-100">
              <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-8">{t.adminLatestConsultations}</h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-50">
                      <th className="text-left pb-4">{t.adminTableCenter}</th>
                      <th className="text-left pb-4">{t.adminTableProduct}</th>
                      <th className="text-left pb-4">{t.adminTableDate}</th>
                      <th className="text-right pb-4">{t.adminTableStatus}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {consultations.slice(0, 5).map(c => (
                      <tr key={c.id} className="group hover:bg-slate-50/50 transition-colors">
                        <td className="py-4 font-bold text-slate-800 text-sm">
                          {c.centerName}
                          {adminScope === 'all' && c.tenantSlug && (
                            <div className="text-[9px] font-black uppercase tracking-widest text-slate-400 mt-1">{c.tenantSlug}</div>
                          )}
                        </td>
                        <td className="py-4 text-[10px] font-black text-indigo-600 uppercase tracking-widest">{c.selectedProduct}</td>
                        <td className="py-4 text-xs text-slate-400 font-medium">{new Date(c.date).toLocaleDateString()}</td>
                        <td className="py-4 text-right">
                          <span className="inline-block px-3 py-1 bg-green-50 text-green-700 text-[9px] font-black uppercase rounded-lg">{t.adminValidated}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: CLIENTS */}
        {activeTab === 'clients' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-4 space-y-3 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
              {consultations.map(c => (
                <button
                  key={c.id}
                  onClick={() => {
                    setSelectedClient(c);
                    navigateAdmin(`/admin/clients/${encodeURIComponent(getClientKey(c))}`);
                  }}
                  className={`w-full text-left p-6 rounded-3xl border-2 transition-all ${selectedClient?.id === c.id
                      ? 'bg-slate-900 border-slate-900 text-white shadow-xl scale-[1.02]'
                      : 'bg-white border-slate-100 hover:border-indigo-200 text-slate-800'
                    }`}
                >
                  <h4 className="font-black text-sm uppercase truncate mb-1">{c.centerName}</h4>
                  <p className="text-[10px] text-slate-400 font-medium truncate">{c.contactEmail}</p>
                </button>
              ))}
            </div>

            <div className="lg:col-span-8">
              {selectedClient ? (
                <AdminClientProfile tenantSlug={tenantSlug} centerName={selectedClient.centerName} consultations={consultations} />
              ) : (
                <div className="h-64 flex items-center justify-center bg-slate-50 rounded-[2.5rem] border-2 border-dashed border-slate-100 text-slate-300 italic text-sm">
                  {t.adminSelectClient}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: CHATS */}
        {activeTab === 'chats' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-4 space-y-3 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-4 mb-4">{t.adminRecentConversations}</p>
              {consultations.map(c => (
                <button
                  key={c.id}
                  onClick={() => setSelectedClient(c)}
                  className={`w-full text-left p-6 rounded-3xl border-2 transition-all flex items-center gap-4 ${selectedClient?.id === c.id
                      ? 'bg-indigo-600 border-indigo-600 text-white shadow-xl scale-[1.02]'
                      : 'bg-white border-slate-100 hover:border-indigo-200 text-slate-800 shadow-sm'
                    }`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${selectedClient?.id === c.id ? 'bg-white/20' : 'bg-slate-50 text-indigo-600'}`}>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                  </div>
                  <div className="truncate">
                    <h4 className="font-black text-xs uppercase truncate">{c.centerName}</h4>
                    <p className={`text-[9px] font-bold ${selectedClient?.id === c.id ? 'text-white/60' : 'text-slate-400'}`}>{t.adminActiveAiConsulting}</p>
                  </div>
                </button>
              ))}
            </div>

            <div className="lg:col-span-8">
              <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-2xl h-[70vh] flex flex-col overflow-hidden">
                <div className="pb-6 border-b border-slate-50 flex justify-between items-center shrink-0">
                  <div>
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">{t.adminTranscriptHistory.replace('{center}', selectedClient?.centerName ?? '')}</h3>
                    <p className="text-[9px] text-slate-400 font-bold uppercase mt-1 tracking-widest">{t.adminSecurityTagline}</p>
                  </div>
                  <button
                    type="button"
                    className="p-3 bg-slate-50 rounded-xl text-slate-400 hover:text-indigo-600 transition-colors"
                    aria-label={t.adminDownloadTranscript}
                    title={t.adminDownloadTranscript}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-slate-50/20">
                  {clientChats.length > 0 ? (
                    clientChats.map((m, i) => (
                      <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] p-5 rounded-[1.5rem] text-[12px] shadow-sm ${m.role === 'user' ? 'bg-slate-900 text-white font-bold rounded-tr-none' : 'bg-white text-slate-600 border border-slate-100 rounded-tl-none font-medium leading-relaxed'
                          }`}>
                          <p className="mb-1 opacity-40 text-[8px] uppercase tracking-widest font-black">{m.role === 'user' ? t.adminRoleExecutive : t.adminRoleAi}</p>
                          {m.text}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center opacity-20 text-center">
                      <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                      <p className="text-xs font-black uppercase tracking-[0.4em]">{t.adminNoChatsForClient}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: PROPOSALS */}
        {activeTab === 'proposals' && (
          <div className="bg-white rounded-[2.5rem] p-10 border border-slate-100 shadow-2xl">
            <div className="flex justify-between items-center mb-10">
              <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">{t.adminGlobalBudgetRegistry}</h3>
              <div className="flex bg-slate-50 p-1 rounded-xl">
                <button className="px-4 py-2 bg-white rounded-lg text-[9px] font-black uppercase shadow-sm">{t.adminFilterAll}</button>
                <button className="px-4 py-2 text-[9px] font-black uppercase text-slate-400">{t.adminFilterPending}</button>
                <button className="px-4 py-2 text-[9px] font-black uppercase text-slate-400">{t.adminFilterAccepted}</button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {consultations.map(c => (
                <div
                  key={c.id}
                  className={`bg-slate-50 p-8 rounded-[2rem] border border-slate-100 hover:border-indigo-200 transition-all group flex flex-col ${expandedBudgetId === c.id ? 'h-[70vh] overflow-hidden' : 'min-h-72'
                    }`}
                >
                  <div className="shrink-0">
                    <div className="flex justify-between items-start mb-4">
                      <span className="text-[8px] font-black px-2 py-0.5 bg-indigo-100 text-indigo-600 rounded uppercase tracking-widest">{c.selectedProduct}</span>
                      <span className="text-[9px] font-bold text-slate-400">{new Date(c.date).toLocaleDateString()}</span>
                    </div>
                    <h4 className="font-black text-sm text-slate-900 uppercase mb-2 truncate">{c.centerName}</h4>
                    <p className="text-[10px] text-slate-400 font-medium italic line-clamp-3">"{c.proposal?.diagnosis}"</p>
                  </div>
                  <div className="pt-6 border-t border-slate-200/50 flex justify-between items-end shrink-0">
                    <div>
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">{t.adminTotalInvestment}</p>
                      <p className="text-2xl font-serif italic font-bold text-slate-900">{(c.proposal?.totalInitial || 0).toLocaleString()}€</p>
                    </div>
                    <button
                      type="button"
                      className="p-3 bg-slate-900 text-white rounded-2xl hover:bg-indigo-600 transition-all"
                      aria-label={t.adminViewBudgetDetails}
                      title={t.adminViewBudgetDetails}
                      onClick={() => {
                        setExpandedBudgetId(prev => {
                          const next = prev === c.id ? null : c.id;
                          if (next !== prev) setShowExtendedBudget(false);
                          return next;
                        });
                      }}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" /></svg>
                    </button>
                  </div>


                  {expandedBudgetId === c.id && (
                    <div className="mt-6 pt-6 border-t border-slate-200/50 space-y-5 flex-1 overflow-y-auto pr-2 custom-scrollbar">
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{t.adminBudgetItemsTitle}</p>
                        <button
                          type="button"
                          onClick={() => setShowExtendedBudget(v => !v)}
                          className="text-[9px] font-black uppercase tracking-widest px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:border-indigo-200 hover:text-indigo-700 transition-all"
                        >
                          {showExtendedBudget ? t.adminHideBudgetExtended : t.adminViewBudgetExtended}
                        </button>
                      </div>

                      <div className="space-y-2">
                        {(c.proposal?.items || []).slice(0, showExtendedBudget ? 999 : 4).map((item, idx) => (
                          <div key={idx} className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                              <p className="text-[10px] font-black text-slate-800 uppercase truncate">{item.concept}</p>
                              <p className="text-[10px] text-slate-500 font-medium truncate">{item.description}</p>
                              {typeof (item as any)?.hours === 'number' && typeof (item as any)?.hourlyRate === 'number' && (
                                <p className="text-[10px] text-slate-500 font-black">
                                  {t.proposalHoursBreakdown
                                    .replace('{hours}', String((item as any).hours))
                                    .replace('{rate}', String((item as any).hourlyRate))}
                                </p>
                              )}
                            </div>
                            <p className="text-[10px] font-black text-slate-900 whitespace-nowrap">{(item.price || 0).toLocaleString()}€</p>
                          </div>
                        ))}
                      </div>

                      {showExtendedBudget && (
                        <div className="pt-4 border-t border-slate-200/50 space-y-3">
                          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{t.adminBudgetPhasesTitle}</p>
                          <div className="space-y-3">
                            {(c.proposal?.phases || []).map((phase, idx) => (
                              <div key={idx} className="bg-white border border-slate-100 rounded-2xl p-4">
                                <div className="flex items-start justify-between gap-4">
                                  <div className="min-w-0">
                                    <p className="text-[10px] font-black text-slate-900 uppercase truncate">{phase.name}</p>
                                    <p className="text-[10px] text-slate-500 font-medium line-clamp-2">{phase.description}</p>
                                  </div>
                                  {typeof (phase as any)?.cost === 'number' && (
                                    <p className="text-[10px] font-black text-slate-900 whitespace-nowrap">{(phase as any).cost.toLocaleString()}€</p>
                                  )}
                                </div>
                                {Array.isArray((phase as any)?.deliverables) && (phase as any).deliverables.length > 0 && (
                                  <ul className="mt-2 text-[10px] text-slate-600 list-disc pl-4 space-y-1">
                                    {(phase as any).deliverables.slice(0, 6).map((d: string, j: number) => (
                                      <li key={j}>{d}</li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="pt-4 border-t border-slate-200/50 space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{t.adminDafoTitle}</p>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => onGenerateDafo(c)}
                              disabled={dafoLoadingKey === getClientKey(c)}
                              className="text-[9px] font-black uppercase tracking-widest px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:border-indigo-200 hover:text-indigo-700 transition-all disabled:opacity-60"
                            >
                              {dafoLoadingKey === getClientKey(c) ? t.adminGeneratingDafo : t.adminGenerateDafo}
                            </button>
                            <button
                              type="button"
                              onClick={() => onGenerateCustomProposal(c)}
                              disabled={customLoadingKey === getClientKey(c)}
                              className="text-[9px] font-black uppercase tracking-widest px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:border-indigo-200 hover:text-indigo-700 transition-all disabled:opacity-60"
                            >
                              {customLoadingKey === getClientKey(c) ? t.adminGeneratingCustomProposal : t.adminGenerateCustomProposal}
                            </button>
                          </div>
                        </div>

                        {centerInsightError && (
                          <p className="text-[10px] text-red-600 font-bold">{centerInsightError}</p>
                        )}

                        {dafoCache[getClientKey(c)] && (
                          <div className="bg-white border border-slate-100 rounded-2xl p-4 space-y-3">
                            <p className="text-[10px] text-slate-600 font-medium break-words">{dafoCache[getClientKey(c)].summary}</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div>
                                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">{language === 'ca' ? 'Fortaleses' : 'Fortalezas'}</p>
                                <ul className="text-[10px] text-slate-600 list-disc pl-4 space-y-1">
                                  {dafoCache[getClientKey(c)].strengths.slice(0, 5).map((s, i) => <li key={i} className="break-words">{s}</li>)}
                                </ul>
                              </div>
                              <div>
                                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">{language === 'ca' ? 'Debilitats' : 'Debilidades'}</p>
                                <ul className="text-[10px] text-slate-600 list-disc pl-4 space-y-1">
                                  {dafoCache[getClientKey(c)].weaknesses.slice(0, 5).map((s, i) => <li key={i} className="break-words">{s}</li>)}
                                </ul>
                              </div>
                              <div>
                                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">{language === 'ca' ? 'Oportunitats' : 'Oportunidades'}</p>
                                <ul className="text-[10px] text-slate-600 list-disc pl-4 space-y-1">
                                  {dafoCache[getClientKey(c)].opportunities.slice(0, 5).map((s, i) => <li key={i} className="break-words">{s}</li>)}
                                </ul>
                              </div>
                              <div>
                                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">{language === 'ca' ? 'Amenaces' : 'Amenazas'}</p>
                                <ul className="text-[10px] text-slate-600 list-disc pl-4 space-y-1">
                                  {dafoCache[getClientKey(c)].threats.slice(0, 5).map((s, i) => <li key={i} className="break-words">{s}</li>)}
                                </ul>
                              </div>
                            </div>

                            {dafoCache[getClientKey(c)].automationIdeas?.length > 0 && (
                              <div className="pt-3 border-t border-slate-100">
                                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">{language === 'ca' ? 'Automatitzacions suggerides' : 'Automatizaciones sugeridas'}</p>
                                <div className="space-y-2">
                                  {dafoCache[getClientKey(c)].automationIdeas.slice(0, 4).map((idea, i) => (
                                    <div key={i} className="flex items-start justify-between gap-4">
                                      <div className="min-w-0">
                                        <p className="text-[10px] font-black text-slate-800 uppercase line-clamp-2 break-words">{idea.title}</p>
                                        <p className="text-[10px] text-slate-500 font-medium line-clamp-3 break-words">{idea.description}</p>
                                      </div>
                                      <p className="text-[9px] font-black text-slate-600 whitespace-nowrap">{idea.impact}/{idea.effort}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {customProposalCache[getClientKey(c)] && (
                          <div className="bg-white border border-slate-100 rounded-2xl p-4">
                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">{language === 'ca' ? 'Proposta a mida' : 'Propuesta a medida'}</p>
                            <div className="flex items-start justify-between gap-4">
                              <div className="min-w-0">
                                <p className="text-[10px] text-slate-600 font-medium line-clamp-3 break-words">{customProposalCache[getClientKey(c)]?.diagnosis}</p>
                              </div>
                              <p className="text-[10px] font-black text-slate-900 whitespace-nowrap">{(customProposalCache[getClientKey(c)]?.totalInitial || 0).toLocaleString()}€</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 5: REPORTS */}
        {activeTab === 'reports' && (
          <div className="space-y-6">
            <div className="bg-white rounded-[2.5rem] p-10 border border-slate-100 shadow-2xl">
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">{t.adminTabReports}</h3>
              </div>
              <div className="max-h-[70vh] overflow-y-auto custom-scrollbar pr-2">
                <ReportCenter />
              </div>
            </div>
          </div>
        )}

        {/* TAB 6: KNOWLEDGE BASE */}
        {activeTab === 'knowledge' && (
          <KnowledgeBase tenantSlug={tenantSlug} />
        )}

      </main>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
      `}</style>
    </div>
  );
};

export default AdminRegistry;
