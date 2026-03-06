import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import MarkerClusterGroup from 'react-leaflet-cluster';
import { useLanguage } from '../LanguageContext';
import { fetchAllCentersForMap } from '../services/educationCentersService';
import type { CatEducationCenterFull } from '../types';
import { ICON_RED, ICON_ORANGE, ICON_GREEN, ICON_BLUE, ICON_GRAY, haversineKm } from './mapUtils';

// Leaflet icon fix
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({ iconRetinaUrl: markerIcon2x, iconUrl: markerIcon, shadowUrl: markerShadow });

type CenterWithDistance = CatEducationCenterFull & { _distance: number };

// Fly map to coordinates
function FlyTo({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => { map.flyTo(center, zoom, { duration: 1 }); }, [map, center, zoom]);
  return null;
}

const NetworkExpansion: React.FC = () => {
  const { t } = useLanguage();
  const [centers, setCenters] = useState<CatEducationCenterFull[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [referenceCenter, setReferenceCenter] = useState<CatEducationCenterFull | null>(null);
  const [radiusKm, setRadiusKm] = useState(10);
  const [selectedForProposal, setSelectedForProposal] = useState<Set<string>>(new Set());
  const [aiData, setAiData] = useState<Record<string, any>>({});
  const [isEnriching, setIsEnriching] = useState(false);
  const [mapCenter, setMapCenter] = useState<[number, number]>([41.5, 1.8]);
  const [mapZoom, setMapZoom] = useState(8);

  // Load centers
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

  // Search results
  const searchResults = useMemo(() => {
    if (!searchQuery || searchQuery.length < 2) return [];
    const q = searchQuery.toLowerCase();
    return centers
      .filter(c => c.denominacio_completa?.toLowerCase().includes(q) || c.nom_municipi?.toLowerCase().includes(q))
      .slice(0, 8);
  }, [centers, searchQuery]);

  // Nearby centers
  const nearbyCenters = useMemo<CenterWithDistance[]>(() => {
    if (!referenceCenter || !referenceCenter.coordenades_geo_y || !referenceCenter.coordenades_geo_x) return [];
    return centers
      .filter(c => c.codi_centre !== referenceCenter.codi_centre && c.coordenades_geo_y != null && c.coordenades_geo_x != null)
      .map(c => ({
        ...c,
        _distance: haversineKm(referenceCenter.coordenades_geo_y!, referenceCenter.coordenades_geo_x!, c.coordenades_geo_y!, c.coordenades_geo_x!),
      }))
      .filter(c => c._distance <= radiusKm)
      .sort((a, b) => a._distance - b._distance);
  }, [centers, referenceCenter, radiusKm]);

  // Select reference center
  const selectReference = useCallback((c: CatEducationCenterFull) => {
    setReferenceCenter(c);
    setSearchQuery('');
    setSelectedForProposal(new Set());
    setAiData({});
    if (c.coordenades_geo_y && c.coordenades_geo_x) {
      setMapCenter([c.coordenades_geo_y, c.coordenades_geo_x]);
      setMapZoom(12);
    }
  }, []);

  // Toggle selection
  const toggleSelection = useCallback((codi: string) => {
    setSelectedForProposal(prev => {
      const next = new Set(prev);
      if (next.has(codi)) next.delete(codi);
      else next.add(codi);
      return next;
    });
  }, []);

  // Select all nearby
  const selectAllNearby = useCallback(() => {
    setSelectedForProposal(new Set(nearbyCenters.map(c => c.codi_centre)));
  }, [nearbyCenters]);

  // Enrich with AI
  const enrichWithAI = useCallback(async () => {
    if (!referenceCenter || selectedForProposal.size === 0) return;
    setIsEnriching(true);
    try {
      const realCenters = nearbyCenters.filter(c => selectedForProposal.has(c.codi_centre));
      const resp = await fetch('/api/automation/network-prospecting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          referenceCenterName: referenceCenter.denominacio_completa,
          realCenters: realCenters.map(c => ({
            denominacio_completa: c.denominacio_completa,
            nom_naturalesa: c.nom_naturalesa,
            nom_municipi: c.nom_municipi,
            nom_comarca: c.nom_comarca,
            _distance: c._distance,
          })),
        }),
      });
      const data = await resp.json();
      const enriched: Record<string, any> = {};
      if (data?.expansion_nodes) {
        for (const node of data.expansion_nodes) {
          const match = realCenters.find(c =>
            c.denominacio_completa === node.target_name ||
            c.denominacio_completa?.toLowerCase().includes(node.target_name?.toLowerCase())
          );
          if (match) enriched[match.codi_centre] = node;
        }
      }
      setAiData(enriched);
    } catch (err) {
      console.error('[Expansion AI]', err);
    } finally {
      setIsEnriching(false);
    }
  }, [referenceCenter, selectedForProposal, nearbyCenters]);

  // Export CSV
  const exportCsv = useCallback(() => {
    const sel = nearbyCenters.filter(c => selectedForProposal.has(c.codi_centre));
    if (sel.length === 0) return;
    const headers = ['codi_centre', 'denominacio_completa', 'nom_naturalesa', 'nom_municipi', 'nom_comarca', 'telefon', 'email_centre', 'distancia_km'];
    const rows = sel.map(c => [
      c.codi_centre, c.denominacio_completa, c.nom_naturalesa || '', c.nom_municipi || '',
      c.nom_comarca || '', c.telefon || '', c.email_centre || '', c._distance.toFixed(1),
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `expansion_${referenceCenter?.denominacio_completa?.replace(/\s+/g, '_') || 'centres'}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [nearbyCenters, selectedForProposal, referenceCenter]);

  // Get icon for map marker
  const getIcon = useCallback((c: CenterWithDistance) => {
    if (selectedForProposal.has(c.codi_centre)) return ICON_GREEN;
    const nat = (c.nom_naturalesa || '').toLowerCase();
    if (nat.includes('públic') || nat.includes('public')) return ICON_BLUE;
    if (nat.includes('privat')) return ICON_ORANGE;
    return ICON_GRAY;
  }, [selectedForProposal]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-cyan-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{(t as any).centerMapLoading || 'Carregant...'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-cyan-500 rounded-2xl flex items-center justify-center text-white shadow-lg">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <h2 className="text-3xl font-bold text-slate-900">{t.expansionTitle || "Expansió per Proximitat"}</h2>
            <p className="text-slate-500 text-sm">{t.expansionDesc || "Troba centres propers per expandir la xarxa"}</p>
          </div>
        </div>
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
          {centers.length} centres &middot; {nearbyCenters.length} {(t as any).expansionNearby || 'propers'} &middot; {selectedForProposal.size} {(t as any).centerMapSelected || 'seleccionats'}
        </span>
      </div>

      {/* Main layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6" style={{ minHeight: '70vh' }}>
        {/* Sidebar */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-xl p-6 space-y-5 overflow-y-auto" style={{ maxHeight: '75vh' }}>

          {/* Search */}
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
              {(t as any).expansionSearchCenter || 'Centre de referència'}
            </label>
            <div className="relative">
              <input
                type="text"
                value={referenceCenter ? referenceCenter.denominacio_completa : searchQuery}
                onChange={e => { setSearchQuery(e.target.value); if (referenceCenter) { setReferenceCenter(null); setAiData({}); } }}
                placeholder={(t as any).expansionSearchCenter || 'Cercar centre...'}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs"
              />
              {searchResults.length > 0 && !referenceCenter && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-[200px] overflow-y-auto">
                  {searchResults.map(c => (
                    <button key={c.codi_centre} onClick={() => selectReference(c)}
                      className="w-full text-left px-4 py-2 hover:bg-indigo-50 transition-colors border-b border-slate-50">
                      <p className="text-xs font-bold text-slate-900 truncate">{c.denominacio_completa}</p>
                      <p className="text-[10px] text-slate-400">{c.nom_municipi} · {c.nom_comarca}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {referenceCenter && (
              <div className="mt-2 p-3 bg-cyan-50 rounded-xl">
                <p className="text-xs font-bold text-cyan-800">{referenceCenter.denominacio_completa}</p>
                <p className="text-[10px] text-cyan-600">{referenceCenter.nom_municipi} · {referenceCenter.nom_naturalesa}</p>
              </div>
            )}
          </div>

          {/* Radius */}
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
              {(t as any).expansionRadiusKm || 'Radi'}: {radiusKm} km
            </label>
            <input type="range" min={2} max={50} value={radiusKm} onChange={e => setRadiusKm(Number(e.target.value))}
              className="w-full accent-cyan-600" />
            <div className="flex justify-between text-[9px] text-slate-400"><span>2 km</span><span>50 km</span></div>
          </div>

          {/* Nearby list */}
          {referenceCenter && (
            <>
              <div className="border-t border-slate-100 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    {nearbyCenters.length} {(t as any).expansionNearby || 'centres propers'}
                  </p>
                  <button onClick={selectAllNearby}
                    className="text-[9px] font-black text-indigo-600 uppercase tracking-widest hover:text-indigo-800">
                    {(t as any).centerMapSelectAll || 'Sel. tots'}
                  </button>
                </div>
                <div className="space-y-1 max-h-[250px] overflow-y-auto">
                  {nearbyCenters.slice(0, 50).map(c => (
                    <label key={c.codi_centre}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer transition-colors ${selectedForProposal.has(c.codi_centre) ? 'bg-green-50' : 'hover:bg-slate-50'}`}>
                      <input type="checkbox" checked={selectedForProposal.has(c.codi_centre)}
                        onChange={() => toggleSelection(c.codi_centre)}
                        className="w-4 h-4 rounded border-slate-300 text-green-600" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-bold text-slate-900 truncate">{c.denominacio_completa}</p>
                        <p className="text-[9px] text-slate-400">{c.nom_municipi} · {c._distance.toFixed(1)} km</p>
                      </div>
                      {aiData[c.codi_centre] && (
                        <span className="text-[9px] font-black text-cyan-600 bg-cyan-50 px-2 py-0.5 rounded-lg">
                          {aiData[c.codi_centre].opportunity_score}/10
                        </span>
                      )}
                    </label>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="border-t border-slate-100 pt-4 space-y-2">
                <button onClick={enrichWithAI} disabled={isEnriching || selectedForProposal.size === 0}
                  className="w-full py-3 bg-cyan-600 text-white rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-cyan-700 transition-all disabled:opacity-40">
                  {isEnriching ? ((t as any).expansionEnrichingAI || 'Analitzant...') : `${(t as any).expansionEnrichAI || 'Enriquir amb IA'} (${selectedForProposal.size})`}
                </button>
                <button onClick={exportCsv} disabled={selectedForProposal.size === 0}
                  className="w-full py-3 bg-emerald-600 text-white rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-emerald-700 transition-all disabled:opacity-40">
                  {(t as any).centerMapExportCsv || 'Exportar CSV'} ({selectedForProposal.size})
                </button>
                <button onClick={() => { setSelectedForProposal(new Set()); setAiData({}); }}
                  className="w-full py-2 bg-slate-50 text-slate-600 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-slate-100 transition-all">
                  {(t as any).centerMapClearSelection || 'Netejar'}
                </button>
              </div>
            </>
          )}

          {!referenceCenter && (
            <div className="text-center py-8 text-slate-400">
              <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <p className="text-[10px] font-black uppercase tracking-widest">{(t as any).expansionNoReference || 'Selecciona un centre de referència'}</p>
            </div>
          )}
        </div>

        {/* Map */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-xl overflow-hidden" style={{ minHeight: '65vh' }}>
          <MapContainer center={mapCenter} zoom={mapZoom} style={{ height: '100%', width: '100%', minHeight: '65vh' }} scrollWheelZoom>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <FlyTo center={mapCenter} zoom={mapZoom} />

            {/* Radius circle */}
            {referenceCenter?.coordenades_geo_y && referenceCenter?.coordenades_geo_x && (
              <Circle
                center={[referenceCenter.coordenades_geo_y, referenceCenter.coordenades_geo_x]}
                radius={radiusKm * 1000}
                pathOptions={{ color: '#06b6d4', weight: 2, fillOpacity: 0.05, dashArray: '8 4' }}
              />
            )}

            {/* Reference marker */}
            {referenceCenter?.coordenades_geo_y && referenceCenter?.coordenades_geo_x && (
              <Marker position={[referenceCenter.coordenades_geo_y, referenceCenter.coordenades_geo_x]} icon={ICON_RED}>
                <Popup>
                  <div className="min-w-[180px]">
                    <p className="font-bold text-sm text-red-600 mb-1">{referenceCenter.denominacio_completa}</p>
                    <p className="text-xs text-slate-500">Centre de referència</p>
                    <p className="text-xs">{referenceCenter.nom_municipi} · {referenceCenter.nom_naturalesa}</p>
                  </div>
                </Popup>
              </Marker>
            )}

            {/* Nearby markers */}
            <MarkerClusterGroup chunkedLoading maxClusterRadius={40} showCoverageOnHover={false}>
              {nearbyCenters.map(c => (
                <Marker
                  key={c.codi_centre}
                  position={[c.coordenades_geo_y!, c.coordenades_geo_x!]}
                  icon={getIcon(c)}
                  eventHandlers={{ click: () => toggleSelection(c.codi_centre) }}
                >
                  <Popup>
                    <div className="min-w-[200px]">
                      <p className="font-bold text-sm mb-1">{c.denominacio_completa}</p>
                      <p className="text-xs text-slate-500">{c.nom_naturalesa}</p>
                      <p className="text-xs">{c.nom_municipi} ({c.nom_comarca})</p>
                      <p className="text-xs font-bold text-cyan-600 mt-1">{c._distance.toFixed(1)} km</p>
                      {c.telefon && <p className="text-xs mt-1">Tel: {c.telefon}</p>}
                      {c.email_centre && <p className="text-xs">Email: {c.email_centre}</p>}
                      {aiData[c.codi_centre] && (
                        <div className="mt-2 p-2 bg-cyan-50 rounded text-[10px]">
                          <p className="font-bold text-cyan-800">Score: {aiData[c.codi_centre].opportunity_score}/10</p>
                          <p className="text-cyan-600 mt-1">{aiData[c.codi_centre].reason_for_similarity}</p>
                          <p className="italic text-cyan-700 mt-1">"{aiData[c.codi_centre].custom_referral_pitch}"</p>
                        </div>
                      )}
                      <button
                        className={`mt-2 w-full py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-all ${
                          selectedForProposal.has(c.codi_centre)
                            ? 'bg-red-50 text-red-600 hover:bg-red-100'
                            : 'bg-green-50 text-green-700 hover:bg-green-100'
                        }`}
                        onClick={e => { e.stopPropagation(); toggleSelection(c.codi_centre); }}
                      >
                        {selectedForProposal.has(c.codi_centre) ? 'Desseleccionar' : 'Seleccionar'}
                      </button>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MarkerClusterGroup>
          </MapContainer>
        </div>
      </div>

      {/* AI Results Panel */}
      {Object.keys(aiData).length > 0 && (
        <div className="mt-6 bg-white rounded-3xl border border-slate-100 shadow-xl p-6">
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-4">
            Anàlisi IA — {Object.keys(aiData).length} centres
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {nearbyCenters.filter(c => aiData[c.codi_centre]).map(c => (
              <div key={c.codi_centre} className="p-4 bg-slate-900 text-white rounded-2xl">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-bold text-cyan-400 truncate flex-1">{c.denominacio_completa}</h4>
                  <span className="text-lg font-black text-cyan-300 ml-2">{aiData[c.codi_centre].opportunity_score}/10</span>
                </div>
                <p className="text-[10px] text-slate-400 mb-2">{c.nom_municipi} · {c._distance.toFixed(1)} km · {c.nom_naturalesa}</p>
                <p className="text-xs text-slate-300 mb-2">{aiData[c.codi_centre].reason_for_similarity}</p>
                <p className="text-xs italic text-cyan-200">"{aiData[c.codi_centre].custom_referral_pitch}"</p>
                {c.email_centre && <p className="text-[10px] text-slate-500 mt-2">{c.email_centre}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default NetworkExpansion;
