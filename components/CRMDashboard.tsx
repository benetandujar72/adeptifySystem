import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';

// ── Types ────────────────────────────────────────────────────────────────────
interface Campaign {
  id: string; name: string; description?: string; status: string;
  created_at: string; lead_count: number; open_count: number; sent_count: number;
}
interface Lead {
  id: string; email: string; company_name: string; status: string; source: string;
  region?: string; pais?: string; campaign_id?: string; codi_centre_ref?: string;
  open_count: number; last_contacted_at?: string; ai_needs_analysis?: any;
  created_at: string; updated_at: string;
}
interface Interaction {
  id: string; lead_id: string; interaction_type: string; content_summary?: string;
  payload_json?: any; metadata_json?: any; created_at: string;
}
interface CrmNote {
  id: string; lead_id: string; content: string; created_by: string; created_at: string;
}
interface LeadDetail {
  lead: Lead; interactions: Interaction[]; notes: CrmNote[];
  centerData?: any; mongoProfile?: any;
}
interface ImportResult { imported: number; total?: number; skipped?: number; errors?: string[]; debug?: { rowsParsed?: number; rowsWithName?: number; withCoords?: number; delimiter?: string; sampleKeys?: string }; }
interface GeocodeResult { geocoded_municipalities: number; updated_centers: number; remaining_municipalities: number; total_municipalities: number; }

// ── Constants ────────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  new:           { label: 'New Lead',         cls: 'bg-slate-100 text-slate-600' },
  qualified:     { label: 'Qualified',         cls: 'bg-blue-100 text-blue-700' },
  proposal_sent: { label: 'Proposal Sent',     cls: 'bg-indigo-100 text-indigo-700' },
  closed:        { label: 'Closed',            cls: 'bg-green-100 text-green-700' },
  lost:          { label: 'Lost',              cls: 'bg-red-100 text-red-600' },
};
const SOURCE_LABELS: Record<string, string> = {
  bulk_email_map: 'Map', manual: 'Manual', web: 'Web',
  csv_import: 'CSV', euskadi_open_data: 'Basque Country',
  navarra_open_data: 'Navarra', madrid_open_data: 'Madrid',
  url_scraping: 'URL',
};
const CAMPAIGN_COLORS = [
  'bg-indigo-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500',
  'bg-cyan-500', 'bg-violet-500', 'bg-orange-500', 'bg-teal-500',
];
const TIMELINE_COLORS: Record<string, string> = {
  bulk_email: 'bg-indigo-500', proposal_sent: 'bg-violet-500',
  note: 'bg-amber-500', meeting: 'bg-blue-500', ai_analysis: 'bg-purple-500',
};
const PAGE_SIZE = 50;
const CSV_FIELDS = ['name', 'email', 'phone', 'address', 'municipality', 'type', 'region'];
const CSV_FIELD_LABELS: Record<string, string> = {
  name: 'Name *', email: 'Email', phone: 'Phone', address: 'Address',
  municipality: 'Municipality', type: 'Type', region: 'Region',
};

// ── Helpers ──────────────────────────────────────────────────────────────────
const fmtDate = (d?: string) => d ? new Date(d).toLocaleDateString('en-GB') : '—';
const fmtDateTime = (d: string) =>
  new Date(d).toLocaleDateString('en-GB') + ' ' + new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const c = STATUS_CONFIG[status] || STATUS_CONFIG.new;
  return <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${c.cls}`}>{c.label}</span>;
};

const SourceBadge: React.FC<{ source: string }> = ({ source }) => (
  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-100 text-slate-500">
    {SOURCE_LABELS[source] || source}
  </span>
);

const KpiCard: React.FC<{ label: string; value: string | number; color?: string }> = ({ label, value, color = 'text-indigo-600' }) => (
  <div className="bg-white rounded-2xl px-4 py-3 border border-slate-100 min-w-[100px] flex-1">
    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{label}</p>
    <p className={`text-2xl font-black ${color}`}>{value}</p>
  </div>
);

// ── Main Component ───────────────────────────────────────────────────────────
const CRMDashboard: React.FC = () => {
  // State
  const [view, setView] = useState<string>('all');
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<LeadDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [activeTab, setActiveTab] = useState<'perfil' | 'historial' | 'gestio'>('perfil');
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterSource, setFilterSource] = useState('');
  const [page, setPage] = useState(0);
  const [noteContent, setNoteContent] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importTab, setImportTab] = useState<'csv' | 'pais-vasco' | 'navarra' | 'madrid' | 'valencia' | 'andalucia'>('csv');
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [geocoding, setGeocoding] = useState(false);
  const [geocodingResult, setGeocodingResult] = useState<GeocodeResult | null>(null);
  const [csvText, setCsvText] = useState('');
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvColumnMap, setCsvColumnMap] = useState<Record<string, string>>({});
  const [csvRegion, setCsvRegion] = useState('');
  const [csvPais, setCsvPais] = useState('ES');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load data
  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [leadsResp, campsResp] = await Promise.all([
        fetch('/api/crm/leads'),
        fetch('/api/crm/campaigns'),
      ]);
      const { leads: ld = [], interactions: ia = [] } = await leadsResp.json();
      const { campaigns: camps = [] } = campsResp.ok ? await campsResp.json() : { campaigns: [] };
      // Enrich leads with open_count from interactions
      const enriched: Lead[] = ld.map((l: any) => {
        const lInteractions = ia.filter((i: any) => i.lead_id === l.id);
        return {
          ...l,
          open_count: lInteractions.filter((i: any) => i.metadata_json?.opened_at).length,
        };
      });
      setLeads(enriched);
      setCampaigns(camps);
    } catch (e) { console.error('[CRM] Load failed:', e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Filtered leads
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return leads.filter(l => {
      if (view !== 'all' && l.campaign_id !== view) return false;
      if (filterStatus && l.status !== filterStatus) return false;
      if (filterSource && l.source !== filterSource) return false;
      if (q && ![(l.company_name || ''), (l.email || ''), (l.region || '')].some(f => f.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [leads, view, filterStatus, filterSource, search]);

  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  // KPI stats
  const stats = useMemo(() => {
    const src = view === 'all' ? leads : leads.filter(l => l.campaign_id === view);
    const opened = src.filter(l => l.open_count > 0).length;
    const qualified = src.filter(l => ['qualified', 'closed'].includes(l.status)).length;
    return {
      total: src.length,
      sent: src.filter(l => l.source === 'bulk_email_map').length,
      openPct: src.length ? Math.round((opened / src.length) * 100) : 0,
      qualified,
    };
  }, [leads, view]);

  // Select lead → load detail
  const selectLead = useCallback(async (lead: Lead) => {
    setDetail({ lead, interactions: [], notes: [] });
    setActiveTab('perfil');
    setLoadingDetail(true);
    try {
      const resp = await fetch(`/api/crm/lead/${lead.id}`);
      if (resp.ok) {
        const data = await resp.json();
        setDetail(data);
      }
    } catch (e) { console.warn('[CRM] Detail load failed:', e); }
    finally { setLoadingDetail(false); }
  }, []);

  // Update status
  const handleStatusChange = useCallback(async (status: string) => {
    if (!detail) return;
    setUpdatingStatus(true);
    try {
      const resp = await fetch(`/api/crm/lead/${detail.lead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (resp.ok) {
        const { lead } = await resp.json();
        setDetail(d => d ? { ...d, lead } : null);
        setLeads(ls => ls.map(l => l.id === lead.id ? { ...l, status: lead.status } : l));
      }
    } catch (e) { console.warn('[CRM] Status update failed:', e); }
    finally { setUpdatingStatus(false); }
  }, [detail]);

  // Add note
  const handleAddNote = useCallback(async () => {
    if (!detail || !noteContent.trim()) return;
    setSavingNote(true);
    try {
      const resp = await fetch(`/api/crm/lead/${detail.lead.id}/note`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: noteContent.trim() }),
      });
      if (resp.ok) {
        const { note } = await resp.json();
        setDetail(d => d ? { ...d, notes: [note, ...d.notes] } : null);
        setNoteContent('');
      }
    } catch (e) { console.warn('[CRM] Note save failed:', e); }
    finally { setSavingNote(false); }
  }, [detail, noteContent]);

  // Timeline merge
  const timeline = useMemo(() => {
    if (!detail) return [];
    return [
      ...(detail.interactions || []).map(i => ({ ...i, _type: 'interaction' as const, ts: i.created_at })),
      ...(detail.notes || []).map(n => ({
        id: n.id, lead_id: n.lead_id, interaction_type: 'note', content_summary: n.content,
        metadata_json: null, payload_json: null, _type: 'note' as const, ts: n.created_at,
      })),
    ].sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
  }, [detail]);

  // CSV import helpers
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setCsvText(text);
      const firstLine = text.split('\n')[0];
      const sep = firstLine.includes(';') ? ';' : ',';
      const headers = firstLine.split(sep).map(h => h.trim().replace(/^"|"$/g, ''));
      setCsvHeaders(headers);
      // Auto-map by name similarity
      const autoMap: Record<string, string> = {};
      for (const field of CSV_FIELDS) {
        const match = headers.find(h => h.toLowerCase().includes(field.toLowerCase().replace('municipality', 'munici').replace('address', 'adreca').replace('address', 'direc')));
        if (match) autoMap[field] = match;
      }
      setCsvColumnMap(autoMap);
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleCsvImport = async () => {
    if (!csvText || !csvColumnMap.name) return;
    setImportLoading(true); setImportResult(null);
    try {
      const resp = await fetch('/api/centers/import/csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvData: csvText, columnMap: csvColumnMap, region: csvRegion || 'Desconegut', pais: csvPais }),
      });
      setImportResult(await resp.json());
    } catch (e: any) { setImportResult({ imported: 0, errors: [e.message] }); }
    finally { setImportLoading(false); }
  };

  const handleApiImport = async (endpoint: string) => {
    setImportLoading(true); setImportResult(null); setGeocodingResult(null);
    try {
      const resp = await fetch(`/api/centers/import/${endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
      setImportResult(await resp.json());
    } catch (e: any) { setImportResult({ imported: 0, errors: [e.message] }); }
    finally { setImportLoading(false); }
  };

  const IMPORT_TAB_TO_PAIS: Record<string, string> = {
    'pais-vasco': 'ES-PV', 'navarra': 'ES-NC', 'madrid': 'ES-MD', 'valencia': 'ES-VC', 'andalucia': 'ES-AN',
  };
  const handleGeocode = async () => {
    const pais = IMPORT_TAB_TO_PAIS[importTab];
    if (!pais) return;
    setGeocoding(true);
    try {
      const resp = await fetch('/api/centers/geocode-region', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pais, batch_size: 50 }),
      });
      setGeocodingResult(await resp.json());
    } catch (e: any) { setGeocodingResult(null); }
    finally { setGeocoding(false); }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen overflow-hidden bg-slate-50" style={{ paddingTop: '80px' }}>

      {/* ── LEFT SIDEBAR ─────────────────────────────────────────────────── */}
      <div className="w-64 flex-shrink-0 bg-white border-r border-slate-100 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-slate-100">
          <h2 className="text-xs font-black text-slate-900 uppercase tracking-widest">CRM</h2>
          <p className="text-[10px] text-slate-400 mt-0.5">Seguiment d'institucions</p>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* All leads */}
          <div className="p-2 pt-3">
            <button
              onClick={() => { setView('all'); setPage(0); }}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left text-xs transition-all font-bold
                ${view === 'all' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              <span className="w-2 h-2 rounded-full bg-indigo-400 flex-shrink-0" />
              <span className="flex-1">Tots els leads</span>
              <span className="text-[10px] text-slate-400 font-normal">{leads.length}</span>
            </button>
          </div>

          {/* Campaigns */}
          {campaigns.length > 0 && (
            <div className="px-2 pb-2">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2 py-2">Campanyes</p>
              {campaigns.map((c, idx) => (
                <button
                  key={c.id}
                  onClick={() => { setView(c.id); setPage(0); }}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left text-xs transition-all mb-0.5
                    ${view === c.id ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-slate-500 hover:bg-slate-50'}`}
                >
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${CAMPAIGN_COLORS[idx % CAMPAIGN_COLORS.length]}`} />
                  <span className="flex-1 truncate">{c.name}</span>
                  <span className="text-[10px] text-slate-400">{c.lead_count}</span>
                </button>
              ))}
            </div>
          )}

          {/* Status filters */}
          <div className="px-2 py-2 border-t border-slate-100">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2 py-2">Per Estat</p>
            {Object.entries(STATUS_CONFIG).map(([val, { label }]) => (
              <button
                key={val}
                onClick={() => { setFilterStatus(filterStatus === val ? '' : val); setPage(0); }}
                className={`w-full text-left text-xs px-3 py-1.5 rounded-xl mb-0.5 transition-all
                  ${filterStatus === val ? 'bg-slate-100 font-bold text-slate-800' : 'text-slate-500 hover:bg-slate-50'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Import button */}
        <div className="p-3 border-t border-slate-100">
          <button
            onClick={() => { setShowImport(true); setImportResult(null); }}
            className="w-full py-2.5 bg-slate-900 text-white text-xs font-black rounded-xl hover:bg-indigo-600 transition-all"
          >
            + Importar Centres
          </button>
          <button onClick={loadAll} className="w-full py-2 text-slate-400 text-xs hover:text-indigo-600 transition-all mt-1">
            ↻ Actualitzar
          </button>
        </div>
      </div>

      {/* ── CENTER PANEL ──────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Stats + search */}
        <div className="bg-white border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-3 mb-3 flex-wrap">
            <KpiCard label="Total leads" value={stats.total} />
            <KpiCard label="Del mapa" value={stats.sent} color="text-indigo-600" />
            <KpiCard label="% Obertures" value={`${stats.openPct}%`} color="text-green-600" />
            <KpiCard label="Qualificats" value={stats.qualified} color="text-blue-600" />
          </div>
          <div className="flex gap-2">
            <input
              value={search} onChange={e => { setSearch(e.target.value); setPage(0); }}
              placeholder="Cercar per nom, email o regió..."
              className="flex-1 px-3 py-2 bg-slate-50 rounded-xl text-sm border border-slate-200 focus:outline-none focus:border-indigo-400"
            />
            <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(0); }}
              className="px-3 py-2 bg-slate-50 rounded-xl text-xs border border-slate-200 text-slate-600">
              <option value="">Tots els estats</option>
              {Object.entries(STATUS_CONFIG).map(([v, { label }]) => <option key={v} value={v}>{label}</option>)}
            </select>
            <select value={filterSource} onChange={e => { setFilterSource(e.target.value); setPage(0); }}
              className="px-3 py-2 bg-slate-50 rounded-xl text-xs border border-slate-200 text-slate-600">
              <option value="">Totes les fonts</option>
              {Object.entries(SOURCE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-100 sticky top-0 z-10">
              <tr>
                <th className="px-5 py-3 text-[10px] font-black text-slate-400 uppercase">Institució</th>
                <th className="px-5 py-3 text-[10px] font-black text-slate-400 uppercase">Ubicació</th>
                <th className="px-5 py-3 text-[10px] font-black text-slate-400 uppercase">Estat</th>
                <th className="px-5 py-3 text-[10px] font-black text-slate-400 uppercase">Font</th>
                <th className="px-5 py-3 text-[10px] font-black text-slate-400 uppercase">Contacte</th>
                <th className="px-5 py-3 text-[10px] font-black text-slate-400 uppercase text-center">Obre</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading && (
                <tr><td colSpan={6} className="px-5 py-12 text-center text-slate-400 text-sm">Carregant leads...</td></tr>
              )}
              {!loading && paged.length === 0 && (
                <tr><td colSpan={6} className="px-5 py-12 text-center text-slate-400 text-sm">No s'han trobat leads amb aquests filtres</td></tr>
              )}
              {paged.map(lead => (
                <tr
                  key={lead.id}
                  onClick={() => selectLead(lead)}
                  className={`cursor-pointer hover:bg-indigo-50/40 transition-all
                    ${detail?.lead.id === lead.id ? 'bg-indigo-50 border-l-2 border-l-indigo-600' : ''}`}
                >
                  <td className="px-5 py-3">
                    <p className="font-bold text-slate-800 text-sm truncate max-w-[200px]">{lead.company_name}</p>
                    <p className="text-[10px] text-slate-400 truncate max-w-[200px]">{lead.email}</p>
                  </td>
                  <td className="px-5 py-3">
                    <p className="text-xs text-slate-600">{lead.region || '—'}</p>
                  </td>
                  <td className="px-5 py-3"><StatusBadge status={lead.status} /></td>
                  <td className="px-5 py-3"><SourceBadge source={lead.source} /></td>
                  <td className="px-5 py-3 text-xs text-slate-500">{fmtDate(lead.last_contacted_at)}</td>
                  <td className="px-5 py-3 text-center">
                    {lead.open_count > 0
                      ? <span className="w-2 h-2 bg-green-500 rounded-full inline-block animate-pulse" />
                      : <span className="w-2 h-2 bg-slate-200 rounded-full inline-block" />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="bg-white border-t border-slate-100 px-6 py-3 flex items-center justify-between text-xs text-slate-500">
            <span>{filtered.length} leads · pàgina {page + 1}/{totalPages}</span>
            <div className="flex gap-2">
              <button disabled={page === 0} onClick={() => setPage(p => p - 1)}
                className="px-3 py-1 rounded-lg bg-slate-100 disabled:opacity-30 hover:bg-slate-200">← Anterior</button>
              <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}
                className="px-3 py-1 rounded-lg bg-slate-100 disabled:opacity-30 hover:bg-slate-200">Següent →</button>
            </div>
          </div>
        )}
      </div>

      {/* ── RIGHT DETAIL PANEL ────────────────────────────────────────────── */}
      {detail && (
        <div className="w-96 flex-shrink-0 bg-white border-l border-slate-100 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="font-black text-slate-800 text-sm truncate">{detail.lead.company_name}</p>
              <p className="text-[10px] text-slate-400 truncate">{detail.lead.email}</p>
            </div>
            <button onClick={() => setDetail(null)} className="text-slate-300 hover:text-slate-600 text-lg leading-none flex-shrink-0">×</button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-slate-100">
            {(['perfil', 'historial', 'gestio'] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2.5 text-[10px] font-black uppercase tracking-wider transition-all
                  ${activeTab === tab ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}>
                {tab === 'perfil' ? 'Perfil' : tab === 'historial' ? 'Historial' : 'Gestió'}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto">
            {loadingDetail && (
              <div className="p-6 text-center text-xs text-slate-400">Carregant dades completes...</div>
            )}

            {/* ── PERFIL TAB ───────────────────────────────────────────── */}
            {activeTab === 'perfil' && !loadingDetail && (
              <div className="p-5 space-y-4">
                {/* Contact info */}
                <div className="space-y-2">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Contacte</p>
                  {detail.centerData?.telefon && (
                    <p className="text-xs text-slate-600 flex gap-2"><span className="text-slate-300">☎</span>{detail.centerData.telefon}</p>
                  )}
                  {(detail.centerData?.adreca || detail.centerData?.nom_municipi) && (
                    <p className="text-xs text-slate-600 flex gap-2">
                      <span className="text-slate-300">📍</span>
                      {[detail.centerData.adreca, detail.centerData.nom_municipi].filter(Boolean).join(', ')}
                    </p>
                  )}
                  {detail.centerData?.nom_naturalesa && (
                    <p className="text-xs text-slate-600 flex gap-2"><span className="text-slate-300">🏫</span>{detail.centerData.nom_naturalesa}</p>
                  )}
                  <div className="flex gap-2 flex-wrap mt-1">
                    <StatusBadge status={detail.lead.status} />
                    <SourceBadge source={detail.lead.source} />
                    {detail.lead.region && <span className="px-2 py-0.5 rounded-full text-[9px] bg-slate-100 text-slate-500">{detail.lead.region}</span>}
                  </div>
                </div>

                {/* AI Score */}
                {detail.centerData?.ai_opportunity_score && (
                  <div className="bg-indigo-50 rounded-xl p-3 border border-indigo-100">
                    <p className="text-[9px] font-black text-indigo-400 uppercase mb-1">Score IA Adeptify</p>
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-black text-indigo-700">{detail.centerData.ai_opportunity_score}</span>
                      <span className="text-xs text-slate-400">/10</span>
                    </div>
                    {detail.centerData.ai_reason_similarity && (
                      <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">{detail.centerData.ai_reason_similarity}</p>
                    )}
                    {detail.centerData.ai_custom_pitch && (
                      <p className="text-[11px] text-indigo-600 mt-1 italic border-l-2 border-indigo-300 pl-2">{detail.centerData.ai_custom_pitch}</p>
                    )}
                  </div>
                )}

                {/* MongoDB profile */}
                {detail.mongoProfile?.needs && (
                  <div className="bg-amber-50 rounded-xl p-3 border border-amber-100">
                    <p className="text-[9px] font-black text-amber-600 uppercase mb-2">Anàlisi de Necessitats</p>
                    {detail.mongoProfile.needs.dolor_principal && (
                      <div className="mb-2">
                        <p className="text-[9px] font-black text-slate-500 uppercase mb-0.5">Dolor principal</p>
                        <p className="text-[11px] text-slate-700 leading-relaxed">{detail.mongoProfile.needs.dolor_principal}</p>
                      </div>
                    )}
                    {detail.mongoProfile.needs.urgencia && (
                      <div className="mb-2">
                        <span className="text-[9px] font-black text-slate-500 uppercase">Urgència: </span>
                        <span className={`text-[9px] font-black uppercase ${detail.mongoProfile.needs.urgencia === 'alta' ? 'text-red-600' : detail.mongoProfile.needs.urgencia === 'media' ? 'text-amber-600' : 'text-green-600'}`}>
                          {detail.mongoProfile.needs.urgencia}
                        </span>
                      </div>
                    )}
                    {detail.mongoProfile.needs.necesidades_principales?.slice(0, 3).map((n: string, i: number) => (
                      <p key={i} className="text-[11px] text-slate-600 flex gap-1.5 mb-1">
                        <span className="text-amber-500 flex-shrink-0">•</span>{n}
                      </p>
                    ))}
                    {detail.mongoProfile.needs.decision_maker_probable && (
                      <p className="text-[10px] text-slate-500 mt-2">
                        <strong>Decisor probable:</strong> {detail.mongoProfile.needs.decision_maker_probable}
                      </p>
                    )}
                  </div>
                )}

                {/* DAFO from lead */}
                {detail.lead.ai_needs_analysis?.main_bottleneck && (
                  <div className="bg-slate-800 rounded-xl p-3 text-white">
                    <p className="text-[9px] font-black text-indigo-400 uppercase mb-2">Diagnòstic DAFO</p>
                    <p className="text-[11px] text-slate-200 leading-relaxed">{detail.lead.ai_needs_analysis.main_bottleneck}</p>
                    {detail.lead.ai_needs_analysis.estimated_budget_range && (
                      <p className="text-[11px] text-green-400 font-bold mt-2">{detail.lead.ai_needs_analysis.estimated_budget_range}</p>
                    )}
                  </div>
                )}

                <p className="text-[10px] text-slate-300 text-center">Lead creat {fmtDate(detail.lead.created_at)}</p>
              </div>
            )}

            {/* ── HISTORIAL TAB ─────────────────────────────────────────── */}
            {activeTab === 'historial' && !loadingDetail && (
              <div className="p-5">
                {timeline.length === 0 && (
                  <p className="text-xs text-slate-400 text-center py-8">Cap interacció registrada</p>
                )}
                <div className="space-y-4 relative before:absolute before:left-[13px] before:top-2 before:bottom-2 before:w-px before:bg-slate-100">
                  {timeline.map((item) => {
                    const dotColor = item.metadata_json?.opened_at
                      ? 'bg-green-500'
                      : TIMELINE_COLORS[item.interaction_type] || 'bg-slate-400';
                    return (
                      <div key={item.id} className="relative pl-8">
                        <div className={`absolute left-0 top-1.5 w-6 h-6 rounded-full ${dotColor} flex items-center justify-center`}>
                          <span className="w-2 h-2 bg-white rounded-full" />
                        </div>
                        <p className="text-[9px] font-black text-slate-400 uppercase mb-0.5">{fmtDateTime(item.ts)}</p>
                        <p className="text-xs font-bold text-slate-700">{item.content_summary || item.interaction_type}</p>
                        <p className="text-[9px] text-slate-400 uppercase">{item.interaction_type}</p>
                        {item.metadata_json?.opened_at && (
                          <p className="text-[10px] text-green-600 font-bold mt-0.5">✓ Obert pel destinatari</p>
                        )}
                        {item._type === 'note' && (
                          <p className="text-[10px] text-amber-600 mt-0.5">📝 Nota manual</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── GESTIÓ TAB ────────────────────────────────────────────── */}
            {activeTab === 'gestio' && !loadingDetail && (
              <div className="p-5 space-y-5">
                {/* Status */}
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Canviar Estat</p>
                  <select
                    value={detail.lead.status}
                    onChange={e => handleStatusChange(e.target.value)}
                    disabled={updatingStatus}
                    className="w-full px-3 py-2.5 bg-slate-50 rounded-xl text-sm font-bold text-slate-800 border border-slate-200 focus:outline-none focus:border-indigo-400"
                  >
                    {Object.entries(STATUS_CONFIG).map(([v, { label }]) => (
                      <option key={v} value={v}>{label}</option>
                    ))}
                  </select>
                  {updatingStatus && <p className="text-[10px] text-slate-400 mt-1">Guardant...</p>}
                </div>

                {/* Add note */}
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Afegir Nota</p>
                  <textarea
                    value={noteContent}
                    onChange={e => setNoteContent(e.target.value)}
                    rows={4}
                    placeholder="Pren nota d'un contacte, reunió, acord o propera acció..."
                    className="w-full px-3 py-2 bg-slate-50 rounded-xl text-xs border border-slate-200 resize-none focus:outline-none focus:border-indigo-400"
                  />
                  <button
                    onClick={handleAddNote}
                    disabled={savingNote || !noteContent.trim()}
                    className="mt-2 w-full py-2.5 bg-indigo-600 text-white text-xs font-black rounded-xl hover:bg-indigo-700 disabled:opacity-40 transition-all"
                  >
                    {savingNote ? 'Guardant...' : 'Afegir Nota'}
                  </button>
                </div>

                {/* Quick actions */}
                <div className="border-t border-slate-100 pt-4 space-y-2">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Accions Ràpides</p>
                  <button
                    onClick={() => handleStatusChange('qualified')}
                    className="w-full py-2.5 bg-blue-50 text-blue-700 text-xs font-bold rounded-xl hover:bg-blue-100 transition-all border border-blue-100"
                  >
                    ✓ Marcar com Qualificat
                  </button>
                  <button
                    onClick={() => handleStatusChange('lost')}
                    className="w-full py-2 bg-slate-50 text-slate-500 text-xs font-bold rounded-xl hover:bg-slate-100 transition-all border border-slate-200"
                  >
                    × Marcar com Perdut
                  </button>
                </div>

                {/* Meta */}
                <div className="border-t border-slate-100 pt-4 text-[10px] text-slate-400 space-y-1">
                  <p>ID: {detail.lead.id.slice(0, 8)}...</p>
                  <p>Creat: {fmtDate(detail.lead.created_at)}</p>
                  {detail.lead.campaign_id && (
                    <p>Campanya: {campaigns.find(c => c.id === detail.lead.campaign_id)?.name || detail.lead.campaign_id.slice(0, 8)}</p>
                  )}
                  {detail.lead.codi_centre_ref && (
                    <p>
                      Codi centre: {detail.lead.codi_centre_ref}
                      {' · '}
                      <button
                        onClick={() => {
                          window.history.pushState({}, '', `/admin/clients/${encodeURIComponent(detail.lead.id)}`);
                          window.dispatchEvent(new PopStateEvent('popstate'));
                        }}
                        className="text-indigo-500 hover:text-indigo-700 underline font-bold"
                      >
                        Veure perfil client
                      </button>
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── IMPORT MODAL ──────────────────────────────────────────────────── */}
      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={e => { if (e.target === e.currentTarget) setShowImport(false); }}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col">
            {/* Modal header */}
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-black text-slate-900 text-lg uppercase tracking-tight italic">Importar Centres Educatius</h3>
                <p className="text-xs text-slate-400 mt-0.5">Afegeix centres de qualsevol regió al CRM</p>
              </div>
              <button onClick={() => setShowImport(false)} className="text-slate-300 hover:text-slate-600 text-2xl leading-none">×</button>
            </div>

            {/* Tab bar */}
            <div className="flex flex-wrap border-b border-slate-100 px-2">
              {(['csv', 'pais-vasco', 'navarra', 'madrid', 'valencia', 'andalucia'] as const).map(t => (
                <button key={t} onClick={() => { setImportTab(t); setImportResult(null); }}
                  className={`px-3 py-3 text-[10px] font-black uppercase tracking-wider transition-all
                    ${importTab === t ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}>
                  {t === 'csv' ? 'CSV' : t === 'pais-vasco' ? 'Euskadi' : t === 'navarra' ? 'Navarra' : t === 'madrid' ? 'Madrid' : t === 'valencia' ? 'Valencia' : 'Andalucía'}
                </button>
              ))}
            </div>

            {/* Modal content */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* Result */}
              {importResult && (
                <div className="mb-4 space-y-2">
                  <div className={`p-4 rounded-xl text-sm font-bold ${importResult.errors?.length ? 'bg-amber-50 text-amber-700' : 'bg-green-50 text-green-700'}`}>
                    {importResult.imported} centres importats correctament
                    {importResult.total ? ` de ${importResult.total}` : ''}
                    {importResult.errors?.length ? ` · ${importResult.errors.length} errors` : ''}
                    {importResult.debug && (
                      <div className="mt-1 text-[10px] font-normal opacity-70 space-y-0.5">
                        <div>Registres CSV parsejats: {importResult.debug.rowsParsed ?? '?'} · amb nom: {importResult.debug.rowsWithName ?? '?'} · delimitador: "{importResult.debug.delimiter ?? '?'}"</div>
                        {importResult.debug.withCoords != null && <div>Amb coordenades GPS: {importResult.debug.withCoords}</div>}
                        {importResult.debug.sampleKeys && <div>Columnes detectades: {importResult.debug.sampleKeys}</div>}
                      </div>
                    )}
                  </div>
                  {/* Geocoding button (not needed for Andalucía which already has GPS coords, nor for CSV uploads) */}
                  {importResult.imported > 0 && importTab !== 'andalucia' && importTab !== 'csv' && (
                    <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl space-y-2">
                      <p className="text-xs text-indigo-700 font-bold">Geocodificació GPS (necessari per aparèixer al mapa)</p>
                      <p className="text-[10px] text-indigo-600">Els centres importats no tenen coordenades GPS. Usa Nominatim (OSM) per geocodificar per municipi. Processa 50 municipis/crida (~55 s).</p>
                      {geocodingResult && (
                        <div className="text-[10px] font-bold text-indigo-800">
                          ✓ {geocodingResult.geocoded_municipalities} municipis geocodificats · {geocodingResult.updated_centers} centres actualitzats
                          {geocodingResult.remaining_municipalities > 0 && ` · ${geocodingResult.remaining_municipalities} municipis restants`}
                        </div>
                      )}
                      <div className="flex gap-2">
                        <button
                          onClick={handleGeocode}
                          disabled={geocoding}
                          className="px-4 py-2 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-indigo-700 disabled:opacity-40 transition-all"
                        >
                          {geocoding ? 'Geocodificant...' : geocodingResult?.remaining_municipalities === 0 ? '✓ Completat' : geocodingResult ? 'Continuar geocodificació' : 'Geocodificar Centres'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* CSV tab */}
              {importTab === 'csv' && (
                <div className="space-y-4">
                  <p className="text-xs text-slate-500">Puja un CSV de qualsevol comunitat autònoma. L'aplicació detectarà les columnes automàticament.</p>
                  <div>
                    <input ref={fileInputRef} type="file" accept=".csv,.txt" onChange={handleFileChange} className="hidden" />
                    <button onClick={() => fileInputRef.current?.click()}
                      className="w-full py-3 border-2 border-dashed border-slate-200 rounded-xl text-sm text-slate-500 hover:border-indigo-400 hover:text-indigo-600 transition-all">
                      {csvHeaders.length ? `✓ Fitxer carregat (${csvHeaders.length} columnes detectades)` : '+ Seleccionar fitxer CSV'}
                    </button>
                  </div>
                  {csvHeaders.length > 0 && (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        {CSV_FIELDS.map(field => (
                          <div key={field}>
                            <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">{CSV_FIELD_LABELS[field]}</label>
                            <select value={csvColumnMap[field] || ''} onChange={e => setCsvColumnMap(m => ({ ...m, [field]: e.target.value }))}
                              className="w-full px-2 py-1.5 bg-slate-50 rounded-lg text-xs border border-slate-200">
                              <option value="">— Ignorar —</option>
                              {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                            </select>
                          </div>
                        ))}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">Regió</label>
                          <input value={csvRegion} onChange={e => setCsvRegion(e.target.value)} placeholder="ex: Andalusia"
                            className="w-full px-2 py-1.5 bg-slate-50 rounded-lg text-xs border border-slate-200" />
                        </div>
                        <div>
                          <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">Codi País</label>
                          <input value={csvPais} onChange={e => setCsvPais(e.target.value)} placeholder="ex: ES-AN"
                            className="w-full px-2 py-1.5 bg-slate-50 rounded-lg text-xs border border-slate-200" />
                        </div>
                      </div>
                      <button onClick={handleCsvImport} disabled={importLoading || !csvColumnMap.name}
                        className="w-full py-3 bg-indigo-600 text-white text-sm font-black rounded-xl hover:bg-indigo-700 disabled:opacity-40 transition-all">
                        {importLoading ? 'Important...' : `Importar centres`}
                      </button>
                    </>
                  )}
                </div>
              )}

              {/* API tabs */}
              {importTab !== 'csv' && (
                <div className="space-y-4">
                  {importTab === 'pais-vasco' && (
                    <div className="bg-slate-50 rounded-xl p-4 text-xs text-slate-600 space-y-1">
                      <p className="font-bold">Font: Open Data Euskadi (Hezkuntza)</p>
                      <p>~1.800 centres docents no universitaris. Inclou nom, municipi, email i telèfon.</p>
                      <p className="text-slate-400">Font: opendata.euskadi.eus</p>
                    </div>
                  )}
                  {importTab === 'navarra' && (
                    <div className="bg-slate-50 rounded-xl p-4 text-xs text-slate-600 space-y-1">
                      <p className="font-bold">Font: Govern Obert de Navarra</p>
                      <p>~1.200 centres educatius. Alta qualitat de dades, inclou email de contacte.</p>
                      <p className="text-slate-400">Font: datosabiertos.navarra.es</p>
                    </div>
                  )}
                  {importTab === 'madrid' && (
                    <div className="bg-slate-50 rounded-xl p-4 text-xs text-slate-600 space-y-1">
                      <p className="font-bold">Font: Dades Obertes Comunitat de Madrid</p>
                      <p>~5.000 centres educatius. Nota: l'email pot no estar disponible en tots els registres.</p>
                      <p className="text-slate-400">Font: datos.comunidad.madrid</p>
                    </div>
                  )}
                  {importTab === 'valencia' && (
                    <div className="bg-slate-50 rounded-xl p-4 text-xs text-slate-600 space-y-1">
                      <p className="font-bold">Font: Dades Obertes GVA (Comunitat Valenciana)</p>
                      <p>~3.500 centres docents. Inclou nom, municipi, tipus i email de contacte.</p>
                      <p className="text-slate-400">Font: dadesobertes.gva.es</p>
                    </div>
                  )}
                  {importTab === 'andalucia' && (
                    <div className="bg-slate-50 rounded-xl p-4 text-xs text-slate-600 space-y-1">
                      <p className="font-bold">Font: Dades Obertes Junta de Andalucía</p>
                      <p>~10.000 centres docents no universitaris. Inclou nom, municipi, telèfon i email.</p>
                      <p className="text-slate-400">Font: juntadeandalucia.es/datosabiertos</p>
                    </div>
                  )}
                  <button
                    onClick={() => handleApiImport(importTab)}
                    disabled={importLoading}
                    className="w-full py-4 bg-indigo-600 text-white text-sm font-black rounded-xl hover:bg-indigo-700 disabled:opacity-40 transition-all"
                  >
                    {importLoading
                      ? 'Descarregant i important dades...'
                      : `Importar des de ${importTab === 'pais-vasco' ? 'País Vasco / Euskadi' : importTab === 'navarra' ? 'Navarra' : importTab === 'madrid' ? 'Madrid' : importTab === 'valencia' ? 'Comunitat Valenciana' : 'Andalucía'}`}
                  </button>
                  {importLoading && (
                    <p className="text-center text-xs text-slate-400">Pot trigar uns segons. No tanquis aquesta finestra.</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CRMDashboard;
