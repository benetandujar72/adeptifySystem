import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, FeatureGroup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import 'leaflet-draw';
import 'leaflet-draw/dist/leaflet.draw.css';
import MarkerClusterGroup from 'react-leaflet-cluster';
import { useLanguage } from '../LanguageContext';
import { fetchAllCentersForMap } from '../services/educationCentersService';
import type { CatEducationCenterFull } from '../types';

// -- Leaflet icon fix for Vite --
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

import { colorIcon, ICON_BLUE, ICON_ORANGE, ICON_PURPLE, ICON_GREEN, ICON_GRAY } from './mapUtils';

// -- Study type groupings --
const STUDY_GROUPS = [
  { key: 'infantil', fields: ['einf1c', 'einf2c'] as const },
  { key: 'primaria', fields: ['epri'] as const },
  { key: 'eso', fields: ['eso'] as const },
  { key: 'batx', fields: ['batx'] as const },
  { key: 'fpMitja', fields: ['cfpm', 'cfam'] as const },
  { key: 'fpSuperior', fields: ['cfps', 'cfas'] as const },
  { key: 'edEspecial', fields: ['ee'] as const },
  { key: 'adults', fields: ['adults'] as const },
  { key: 'arts', fields: ['esdi', 'escm', 'escs', 'dane', 'danp', 'dans', 'muse', 'musp', 'muss'] as const },
  { key: 'esportiu', fields: ['tegm', 'tegs', 'estr'] as const },
  { key: 'idiomes', fields: ['idi'] as const },
] as const;

type StudyGroupKey = typeof STUDY_GROUPS[number]['key'];

interface MapFilters {
  naturalesa: string[];
  comarca: string;
  municipi: string;
  studyTypes: StudyGroupKey[];
}

// -- Draw control component --
function DrawControl({ onAreaSelected }: { onAreaSelected: (bounds: L.LatLngBounds) => void }) {
  const map = useMap();

  useEffect(() => {
    const drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);

    const drawControl = new (L.Control as any).Draw({
      position: 'topright',
      draw: {
        polygon: false,
        polyline: false,
        circle: false,
        circlemarker: false,
        marker: false,
        rectangle: {
          shapeOptions: { color: '#22c55e', weight: 2, fillOpacity: 0.1 },
        },
      },
      edit: { featureGroup: drawnItems, remove: true },
    });

    map.addControl(drawControl);

    map.on((L as any).Draw.Event.CREATED, (e: any) => {
      const layer = e.layer;
      drawnItems.addLayer(layer);
      onAreaSelected(layer.getBounds());
      setTimeout(() => drawnItems.removeLayer(layer), 500);
    });

    return () => {
      map.removeControl(drawControl);
      map.removeLayer(drawnItems);
    };
  }, [map, onAreaSelected]);

  return null;
}

const CenterMapExplorer: React.FC = () => {
  const { t } = useLanguage();
  const [centers, setCenters] = useState<CatEducationCenterFull[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<MapFilters>({
    naturalesa: [],
    comarca: '',
    municipi: '',
    studyTypes: [],
  });
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMsg, setRefreshMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [showDrawer, setShowDrawer] = useState(false);
  const [comarcaSearch, setComarcaSearch] = useState('');
  const [municipiSearch, setMunicipiSearch] = useState('');

  // Email modal state
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailSubject, setEmailSubject] = useState('');
  const [campaignName, setCampaignName] = useState('');
  const [emailChecked, setEmailChecked] = useState<Set<string>>(new Set());
  const [sendingEmails, setSendingEmails] = useState(false);
  const [emailSendProgress, setEmailSendProgress] = useState<{ sent: number; total: number; errors: string[]; aiPersonalized?: number; mongoEnriched?: number; leadsCreated?: number } | null>(null);

  // Load centers on mount
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await fetchAllCentersForMap();
        if (alive) setCenters(data);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  // Derive filter options from data
  const filterOptions = useMemo(() => {
    const naturaleses = new Set<string>();
    const comarques = new Set<string>();
    const municipis = new Set<string>();

    for (const c of centers) {
      if (c.nom_naturalesa) naturaleses.add(c.nom_naturalesa);
      if (c.nom_comarca) comarques.add(c.nom_comarca);
      if (c.nom_municipi) {
        if (!filters.comarca || c.nom_comarca === filters.comarca) {
          municipis.add(c.nom_municipi);
        }
      }
    }

    return {
      naturaleses: Array.from(naturaleses).sort(),
      comarques: Array.from(comarques).sort(),
      municipis: Array.from(municipis).sort(),
    };
  }, [centers, filters.comarca]);

  // Filtered centers
  const filteredCenters = useMemo(() => {
    return centers.filter((c) => {
      if (filters.naturalesa.length > 0 && !filters.naturalesa.includes(c.nom_naturalesa || '')) return false;
      if (filters.comarca && c.nom_comarca !== filters.comarca) return false;
      if (filters.municipi && c.nom_municipi !== filters.municipi) return false;
      if (filters.studyTypes.length > 0) {
        const matchesAny = filters.studyTypes.some((groupKey) => {
          const group = STUDY_GROUPS.find((g) => g.key === groupKey);
          if (!group) return false;
          return group.fields.some((f) => (c as any)[f]);
        });
        if (!matchesAny) return false;
      }
      return true;
    });
  }, [centers, filters]);

  // Marker icon based on selection state and naturalesa
  const getIcon = useCallback(
    (c: CatEducationCenterFull) => {
      if (selected.has(c.codi_centre)) return ICON_GREEN;
      const nat = (c.nom_naturalesa || '').toLowerCase();
      if (nat.includes('públic') || nat.includes('public')) return ICON_BLUE;
      if (nat.includes('privat') || nat.includes('priv')) return ICON_ORANGE;
      if (nat.includes('concertat') || nat.includes('concert')) return ICON_PURPLE;
      return ICON_GRAY;
    },
    [selected],
  );

  // Toggle individual selection
  const toggleSelection = useCallback((codi: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(codi)) next.delete(codi);
      else next.add(codi);
      return next;
    });
  }, []);

  // Area selection handler
  const handleAreaSelected = useCallback(
    (bounds: L.LatLngBounds) => {
      const inBounds = filteredCenters.filter(
        (c) =>
          c.coordenades_geo_y != null &&
          c.coordenades_geo_x != null &&
          bounds.contains([c.coordenades_geo_y, c.coordenades_geo_x]),
      );
      setSelected((prev) => {
        const next = new Set(prev);
        inBounds.forEach((c) => next.add(c.codi_centre));
        return next;
      });
    },
    [filteredCenters],
  );

  // Select all visible
  const selectAllVisible = useCallback(() => {
    setSelected((prev) => {
      const next = new Set(prev);
      filteredCenters.forEach((c) => next.add(c.codi_centre));
      return next;
    });
  }, [filteredCenters]);

  // Clear selection
  const clearSelection = useCallback(() => setSelected(new Set()), []);

  // Export CSV
  const exportCsv = useCallback(() => {
    const selectedCenters = centers.filter((c) => selected.has(c.codi_centre));
    if (selectedCenters.length === 0) return;
    const headers = ['codi_centre', 'denominacio_completa', 'nom_naturalesa', 'adreca', 'nom_municipi', 'nom_comarca', 'codi_postal', 'telefon', 'email_centre'];
    const rows = selectedCenters.map((c) => headers.map((h) => `"${String((c as any)[h] || '').replace(/"/g, '""')}"`).join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `centres_seleccionats_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [centers, selected]);

  // Refresh from API
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setRefreshMsg(null);
    try {
      const resp = await fetch('/api/admin/centers/refresh', { method: 'POST' });
      const data = await resp.json();
      if (resp.ok && data.success) {
        setRefreshMsg({ ok: true, text: `${t.centerMapRefreshSuccess} (${data.upserted} centres)` });
        // Reload map data
        const fresh = await fetchAllCentersForMap();
        setCenters(fresh);
      } else {
        setRefreshMsg({ ok: false, text: t.centerMapRefreshError });
      }
    } catch {
      setRefreshMsg({ ok: false, text: t.centerMapRefreshError });
    } finally {
      setRefreshing(false);
    }
  }, [t]);

  // Open email modal
  const openEmailModal = useCallback(() => {
    const centersWithEmails = centers
      .filter(c => selected.has(c.codi_centre) && c.email_centre)
      .map(c => c.codi_centre);
    setEmailChecked(new Set(centersWithEmails));
    setEmailSubject("Proposta de col·laboració - Adeptify");
    setShowEmailModal(true);
    setEmailSendProgress(null);
  }, [centers, selected]);

  // Send bulk emails
  const sendBulkEmails = useCallback(async () => {
    const recipients = centers
      .filter(c => emailChecked.has(c.codi_centre) && c.email_centre)
      .map(c => ({
        email: c.email_centre!, centerName: c.denominacio_completa, codi: c.codi_centre,
        nom_naturalesa: c.nom_naturalesa, nom_municipi: c.nom_municipi, nom_comarca: c.nom_comarca,
        estudis: c.estudis,
        einf1c: c.einf1c, einf2c: c.einf2c, epri: c.epri, eso: c.eso, batx: c.batx,
        cfpm: c.cfpm, cfps: c.cfps, cfam: c.cfam, cfas: c.cfas,
        ee: c.ee, adults: c.adults, idi: c.idi,
        esdi: c.esdi, escm: c.escm, escs: c.escs,
        dane: c.dane, danp: c.danp, dans: c.dans,
        muse: c.muse, musp: c.musp, muss: c.muss,
        tegm: c.tegm, tegs: c.tegs, estr: c.estr,
        ai_opportunity_score: c.ai_opportunity_score,
        ai_reason_similarity: c.ai_reason_similarity,
        ai_custom_pitch: c.ai_custom_pitch,
      }));
    if (recipients.length === 0) return;

    setSendingEmails(true);
    setEmailSendProgress({ sent: 0, total: recipients.length, errors: [] });
    try {
      const resp = await fetch('/api/centers/send-bulk-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipients, subject: emailSubject, campaignName: campaignName.trim() || null }),
      });
      const data = await resp.json();
      setEmailSendProgress({ sent: data.sent || 0, total: recipients.length, errors: data.errors || [], aiPersonalized: data.aiPersonalized || 0, mongoEnriched: data.mongoEnriched || 0, leadsCreated: data.leadsCreated || 0 });
    } catch (err: any) {
      setEmailSendProgress(prev => prev ? { ...prev, errors: [err.message] } : { sent: 0, total: recipients.length, errors: [err.message] });
    } finally {
      setSendingEmails(false);
    }
  }, [centers, emailChecked, emailSubject]);

  // Toggle email recipient
  const toggleEmailChecked = useCallback((codi: string) => {
    setEmailChecked(prev => {
      const next = new Set(prev);
      if (next.has(codi)) next.delete(codi);
      else next.add(codi);
      return next;
    });
  }, []);

  // Naturalesa filter toggle
  const toggleNaturalesa = (val: string) => {
    setFilters((prev) => ({
      ...prev,
      naturalesa: prev.naturalesa.includes(val) ? prev.naturalesa.filter((v) => v !== val) : [...prev.naturalesa, val],
    }));
  };

  // Study type filter toggle
  const toggleStudyType = (key: StudyGroupKey) => {
    setFilters((prev) => ({
      ...prev,
      studyTypes: prev.studyTypes.includes(key) ? prev.studyTypes.filter((k) => k !== key) : [...prev.studyTypes, key],
    }));
  };

  // Study type translation map
  const studyLabel = (key: string): string => {
    const map: Record<string, string> = {
      infantil: t.centerMapInfantil, primaria: t.centerMapPrimaria, eso: t.centerMapEso,
      batx: t.centerMapBatx, fpMitja: t.centerMapFpMitja, fpSuperior: t.centerMapFpSuperior,
      edEspecial: t.centerMapEdEspecial, adults: t.centerMapAdults, arts: t.centerMapArts,
      esportiu: t.centerMapEsportiu, idiomes: t.centerMapIdiomes,
    };
    return map[key] || key;
  };

  // Build study types string for popup
  const getStudyTypesLabel = (c: CatEducationCenterFull): string => {
    return STUDY_GROUPS
      .filter((g) => g.fields.some((f) => (c as any)[f]))
      .map((g) => studyLabel(g.key))
      .join(', ');
  };

  // Filtered comarcas and municipis for searchable dropdowns
  const filteredComarques = useMemo(() => {
    if (!comarcaSearch) return filterOptions.comarques;
    const q = comarcaSearch.toLowerCase();
    return filterOptions.comarques.filter((c) => c.toLowerCase().includes(q));
  }, [filterOptions.comarques, comarcaSearch]);

  const filteredMunicipis = useMemo(() => {
    if (!municipiSearch) return filterOptions.municipis;
    const q = municipiSearch.toLowerCase();
    return filterOptions.municipis.filter((m) => m.toLowerCase().includes(q));
  }, [filterOptions.municipis, municipiSearch]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t.centerMapLoading}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center text-white shadow-lg">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div>
            <h2 className="text-3xl font-bold text-slate-900">{t.centerMapTitle}</h2>
            <p className="text-slate-500 text-sm">{t.centerMapDesc}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            {centers.length} {t.centerMapTotal} &middot; {filteredCenters.length} {t.centerMapVisible} &middot; {selected.size} {t.centerMapSelected}
          </span>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="px-4 py-2 bg-slate-900 text-white rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-indigo-600 transition-all disabled:opacity-50"
          >
            {refreshing ? t.centerMapRefreshing : t.centerMapRefresh}
          </button>
        </div>
      </div>

      {refreshMsg && (
        <div className={`mb-4 px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest ${refreshMsg.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {refreshMsg.text}
        </div>
      )}

      {/* Main layout: sidebar + map */}
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6" style={{ minHeight: '70vh' }}>
        {/* Sidebar Filters */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-xl p-6 space-y-5 overflow-y-auto" style={{ maxHeight: '75vh' }}>
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t.centerMapFilter}</h3>

          {/* Titularitat */}
          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">{t.centerMapNaturalesa}</label>
            <div className="space-y-1">
              {filterOptions.naturaleses.map((nat) => (
                <label key={nat} className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={filters.naturalesa.includes(nat)}
                    onChange={() => toggleNaturalesa(nat)}
                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-xs text-slate-700 group-hover:text-indigo-600 transition-colors">{nat}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Comarca */}
          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">{t.centerMapComarca}</label>
            <input
              type="text"
              value={comarcaSearch}
              onChange={(e) => setComarcaSearch(e.target.value)}
              placeholder={t.centerMapAllComarca}
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs mb-1"
            />
            <select
              value={filters.comarca}
              onChange={(e) => {
                setFilters((prev) => ({ ...prev, comarca: e.target.value, municipi: '' }));
                setMunicipiSearch('');
              }}
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
            >
              <option value="">{t.centerMapAllComarca}</option>
              {filteredComarques.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Municipi */}
          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">{t.centerMapMunicipi}</label>
            <input
              type="text"
              value={municipiSearch}
              onChange={(e) => setMunicipiSearch(e.target.value)}
              placeholder={t.centerMapAllMunicipi}
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs mb-1"
            />
            <select
              value={filters.municipi}
              onChange={(e) => setFilters((prev) => ({ ...prev, municipi: e.target.value }))}
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
            >
              <option value="">{t.centerMapAllMunicipi}</option>
              {filteredMunicipis.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          {/* Estudis */}
          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">{t.centerMapStudies}</label>
            <div className="space-y-1">
              {STUDY_GROUPS.map((g) => (
                <label key={g.key} className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={filters.studyTypes.includes(g.key)}
                    onChange={() => toggleStudyType(g.key)}
                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-xs text-slate-700 group-hover:text-indigo-600 transition-colors">{studyLabel(g.key)}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-slate-100 pt-4">
            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-3">
              {selected.size} {t.centerMapSelected}
            </p>

            <div className="space-y-2">
              <button
                onClick={selectAllVisible}
                className="w-full py-2 bg-indigo-50 text-indigo-700 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-indigo-100 transition-all"
              >
                {t.centerMapSelectAll}
              </button>
              <button
                onClick={clearSelection}
                className="w-full py-2 bg-slate-50 text-slate-600 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-slate-100 transition-all"
              >
                {t.centerMapClearSelection}
              </button>
              <button
                onClick={exportCsv}
                disabled={selected.size === 0}
                className="w-full py-2 bg-emerald-600 text-white rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-emerald-700 transition-all disabled:opacity-40"
              >
                {t.centerMapExportCsv} ({selected.size})
              </button>
            </div>
          </div>

          {/* Legend */}
          <div className="border-t border-slate-100 pt-4 space-y-1">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Llegenda</p>
            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-blue-500" /> <span className="text-[10px] text-slate-600">{t.centerMapPublic}</span></div>
            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-orange-500" /> <span className="text-[10px] text-slate-600">{t.centerMapPrivat}</span></div>
            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-purple-500" /> <span className="text-[10px] text-slate-600">{t.centerMapConcertat}</span></div>
            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-green-500" /> <span className="text-[10px] text-slate-600">{t.centerMapSelected}</span></div>
          </div>
        </div>

        {/* Map */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-xl overflow-hidden" style={{ minHeight: '65vh' }}>
          <MapContainer
            center={[41.5, 1.8]}
            zoom={8}
            style={{ height: '100%', width: '100%', minHeight: '65vh' }}
            scrollWheelZoom={true}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <DrawControl onAreaSelected={handleAreaSelected} />
            <MarkerClusterGroup
              chunkedLoading
              maxClusterRadius={50}
              spiderfyOnMaxZoom
              showCoverageOnHover={false}
            >
              {filteredCenters.map((c) => {
                if (c.coordenades_geo_y == null || c.coordenades_geo_x == null) return null;
                return (
                  <Marker
                    key={c.codi_centre}
                    position={[c.coordenades_geo_y, c.coordenades_geo_x]}
                    icon={getIcon(c)}
                    eventHandlers={{
                      click: () => toggleSelection(c.codi_centre),
                    }}
                  >
                    <Popup>
                      <div className="min-w-[200px]">
                        <p className="font-bold text-sm mb-1">{c.denominacio_completa}</p>
                        <p className="text-xs text-slate-500 mb-1">{c.nom_naturalesa}</p>
                        {c.adreca && <p className="text-xs">{c.adreca}</p>}
                        <p className="text-xs">{c.nom_municipi}{c.nom_comarca ? ` (${c.nom_comarca})` : ''} {c.codi_postal || ''}</p>
                        {c.telefon && <p className="text-xs mt-1">Tel: {c.telefon}</p>}
                        {c.email_centre && <p className="text-xs">Email: {c.email_centre}</p>}
                        {getStudyTypesLabel(c) && (
                          <p className="text-xs mt-2 text-indigo-600 font-medium">{getStudyTypesLabel(c)}</p>
                        )}
                        <button
                          className={`mt-2 w-full py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-all ${
                            selected.has(c.codi_centre)
                              ? 'bg-red-50 text-red-600 hover:bg-red-100'
                              : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          }`}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSelection(c.codi_centre);
                          }}
                        >
                          {selected.has(c.codi_centre) ? 'Desseleccionar' : 'Seleccionar'}
                        </button>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </MarkerClusterGroup>
          </MapContainer>
        </div>
      </div>

      {/* Selected centers drawer */}
      {selected.size > 0 && (
        <div className="mt-6 bg-white rounded-3xl border border-slate-100 shadow-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">
              {selected.size} {t.centerMapSelected}
            </h3>
            <div className="flex gap-2">
              <button
                onClick={openEmailModal}
                disabled={centers.filter(c => selected.has(c.codi_centre) && c.email_centre).length === 0}
                className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-indigo-700 transition-all disabled:opacity-40"
              >
                {(t as any).centerMapSendEmail || 'Enviar Email'} ({centers.filter(c => selected.has(c.codi_centre) && c.email_centre).length})
              </button>
              <button
                onClick={exportCsv}
                className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-emerald-700 transition-all"
              >
                {t.centerMapExportCsv}
              </button>
              <button
                onClick={clearSelection}
                className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-slate-200 transition-all"
              >
                {t.centerMapClearSelection}
              </button>
            </div>
          </div>

          <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
            <table className="w-full text-left">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b border-slate-100">
                  <th className="py-2 px-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Codi</th>
                  <th className="py-2 px-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Nom</th>
                  <th className="py-2 px-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">{t.centerMapNaturalesa}</th>
                  <th className="py-2 px-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">{t.centerMapMunicipi}</th>
                  <th className="py-2 px-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">{t.centerMapComarca}</th>
                  <th className="py-2 px-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Tel</th>
                  <th className="py-2 px-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Email</th>
                  <th className="py-2 px-3 text-[9px] font-black text-slate-400 uppercase tracking-widest"></th>
                </tr>
              </thead>
              <tbody>
                {centers
                  .filter((c) => selected.has(c.codi_centre))
                  .map((c) => (
                    <tr key={c.codi_centre} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                      <td className="py-2 px-3 text-xs text-slate-500 font-mono">{c.codi_centre}</td>
                      <td className="py-2 px-3 text-xs font-bold text-slate-900">{c.denominacio_completa}</td>
                      <td className="py-2 px-3 text-xs text-slate-600">{c.nom_naturalesa || '-'}</td>
                      <td className="py-2 px-3 text-xs text-slate-600">{c.nom_municipi || '-'}</td>
                      <td className="py-2 px-3 text-xs text-slate-600">{c.nom_comarca || '-'}</td>
                      <td className="py-2 px-3 text-xs text-slate-600">{c.telefon || '-'}</td>
                      <td className="py-2 px-3 text-xs text-slate-600">{c.email_centre || '-'}</td>
                      <td className="py-2 px-3">
                        <button
                          onClick={() => toggleSelection(c.codi_centre)}
                          className="text-red-400 hover:text-red-600 transition-colors"
                          title="Desseleccionar"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Email Modal */}
      {showEmailModal && (
        <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4" onClick={() => !sendingEmails && setShowEmailModal(false)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-black text-slate-900 uppercase tracking-widest">{(t as any).centerMapEmailModalTitle || 'Enviar Email'}</h3>
                <button onClick={() => !sendingEmails && setShowEmailModal(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-all">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 180px)' }}>
              {/* Subject */}
              <div className="mb-4">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">{(t as any).centerMapEmailSubject || 'Assumpte'}</label>
                <input type="text" value={emailSubject} onChange={e => setEmailSubject(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm" />
              </div>

              {/* Campaign name */}
              <div className="mb-4">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Nom de la Campanya (opcional)</label>
                <input type="text" value={campaignName} onChange={e => setCampaignName(e.target.value)}
                  placeholder={`Campanya ${new Date().toLocaleDateString('ca')} · ${emailChecked.size} centres`}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm" />
                <p className="text-[10px] text-slate-400 mt-1">Es crearà una carpeta al CRM per agrupar aquest enviament i fer-ne el seguiment</p>
              </div>

              {/* Personalization info */}
              <div className="mb-4">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">{(t as any).centerMapEmailBody || 'Cos del missatge'}</label>
                <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100 rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2 pb-2 border-b border-indigo-100">
                    <div className="w-6 h-6 bg-indigo-600 rounded flex items-center justify-center">
                      <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                    </div>
                    <span className="text-[10px] font-black text-indigo-700 uppercase tracking-widest">Email personalitzat per centre</span>
                  </div>
                  <div className="space-y-2 text-xs text-slate-600">
                    <p className="font-bold text-slate-800">Cada email s'adapta automàticament al centre:</p>
                    <ul className="list-disc ml-4 space-y-1">
                      <li><strong>Nom del centre</strong> — Mencionat a la primera frase</li>
                      <li><strong>Tipus</strong> — Públic / Concertat / Privat — to adaptat</li>
                      <li><strong>Estudis</strong> — Infantil, ESO, Batxillerat, FP... segons l'oferta real</li>
                      <li><strong>Ubicació</strong> — Comarca i municipi del centre</li>
                      <li><strong>Dades IA</strong> — Si existeixen, s'afegeix un pitch personalitzat</li>
                      <li><strong>Leads</strong> — Si hi ha necessitats detectades, IA genera intro única</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Attachments note */}
              <div className="mb-4 p-3 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center gap-3">
                <svg className="w-5 h-5 text-indigo-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                <p className="text-[10px] text-indigo-700 font-bold">S'adjunta automàticament: Logo Adeptify + PDF d'informació general + casos reals amb captures</p>
              </div>

              {/* Recipients */}
              <div className="mb-4">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                  {(t as any).centerMapEmailRecipients || 'Destinataris'} ({emailChecked.size})
                </label>
                <div className="max-h-[200px] overflow-y-auto border border-slate-200 rounded-xl">
                  {centers.filter(c => selected.has(c.codi_centre)).map(c => (
                    <label key={c.codi_centre} className={`flex items-center gap-3 px-4 py-2 border-b border-slate-50 cursor-pointer hover:bg-slate-50 transition-colors ${!c.email_centre ? 'opacity-40' : ''}`}>
                      <input type="checkbox" checked={emailChecked.has(c.codi_centre)} disabled={!c.email_centre}
                        onChange={() => c.email_centre && toggleEmailChecked(c.codi_centre)}
                        className="w-4 h-4 rounded border-slate-300 text-indigo-600" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-900 truncate">{c.denominacio_completa}</p>
                        <p className="text-[10px] text-slate-500">{c.email_centre || ((t as any).centerMapEmailNoEmail || 'sense email')}</p>
                      </div>
                      <span className="text-[10px] text-slate-400">{c.nom_municipi}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Sending spinner */}
              {sendingEmails && !emailSendProgress?.sent && (
                <div className="p-4 bg-indigo-50 rounded-xl mb-4 flex items-center gap-3">
                  <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                  <p className="text-xs text-indigo-700 font-bold">Personalitzant i enviant emails... Això pot trigar fins a 1 minut.</p>
                </div>
              )}

              {/* Progress / Result */}
              {emailSendProgress && emailSendProgress.sent > 0 && (
                <div className={`p-4 rounded-xl mb-4 text-sm font-bold ${emailSendProgress.errors.length > 0 ? 'bg-amber-50 text-amber-700' : 'bg-green-50 text-green-700'}`}>
                  {emailSendProgress.sent}/{emailSendProgress.total} {(t as any).centerMapEmailSent || 'enviats'}
                  {(emailSendProgress.aiPersonalized || 0) > 0 && (
                    <span className="ml-2 text-xs font-normal text-indigo-600">({emailSendProgress.aiPersonalized} amb intro IA)</span>
                  )}
                  {(emailSendProgress.mongoEnriched || 0) > 0 && (
                    <span className="ml-2 text-xs font-normal text-blue-600">({emailSendProgress.mongoEnriched} amb perfil enriquit)</span>
                  )}
                  {(emailSendProgress.leadsCreated || 0) > 0 && (
                    <span className="ml-2 text-xs font-normal text-emerald-600">({emailSendProgress.leadsCreated} nous leads CRM)</span>
                  )}
                  {emailSendProgress.errors.length > 0 && (
                    <div className="mt-2 text-xs font-normal">
                      {emailSendProgress.errors.length} {(t as any).centerMapEmailErrors || 'errors'}:
                      <ul className="list-disc ml-4 mt-1">{emailSendProgress.errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="p-6 border-t border-slate-100 flex justify-end gap-3">
              <button onClick={() => setShowEmailModal(false)} disabled={sendingEmails}
                className="px-6 py-3 bg-slate-100 text-slate-600 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-slate-200 transition-all disabled:opacity-50">
                {(t as any).centerMapEmailClose || 'Tancar'}
              </button>
              <button onClick={sendBulkEmails} disabled={sendingEmails || emailChecked.size === 0}
                className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-indigo-700 transition-all disabled:opacity-50">
                {sendingEmails ? ((t as any).centerMapEmailSending || 'Enviant...') : `${(t as any).centerMapEmailSend || 'Enviar'} (${emailChecked.size})`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CenterMapExplorer;
