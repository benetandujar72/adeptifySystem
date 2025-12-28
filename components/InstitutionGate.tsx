import React, { useEffect, useMemo, useState } from 'react';
import { useLanguage } from '../LanguageContext';
import { CatEducationCenter, searchCatEducationCenters } from '../services/educationCentersService';

type Props = {
  onSelected: (sel: { tenantSlug: string; centerName: string; needsRegistration?: boolean; freeAccess?: boolean }) => void;
};

function slugifyTenant(input: string): string {
  const base = (input || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

  const suffix = Math.random().toString(36).slice(2, 8);
  const core = (base || 'centre').slice(0, 35);
  return `m-${core}-${suffix}`.slice(0, 50);
}

const InstitutionGate: React.FC<Props> = ({ onSelected }) => {
  const { t } = useLanguage();

  const labels = useMemo(() => {
    return {
      title: t.institutionGateTitle,
      subtitle: t.institutionGateSubtitle,
      field: t.institutionGateField,
      placeholder: t.institutionGatePlaceholder,
      loading: t.institutionGateLoading,
      hint: t.institutionGateHint,
      notFound: t.institutionGateNotFound,
      useTyped: t.institutionGateUseTyped,
      freeCta: t.institutionGateFreeCta,
    };
  }, [t]);

  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<CatEducationCenter[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    const q = query.trim();

    if (q.length < 2) {
      setOptions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const handle = window.setTimeout(async () => {
      try {
        const res = await searchCatEducationCenters(q, 12);
        if (!alive) return;
        setOptions(res);
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }, 200);

    return () => {
      alive = false;
      window.clearTimeout(handle);
    };
  }, [query]);

  const canUseTyped = query.trim().length >= 2;
  const makeFreeTenantSlug = () => {
    const suffix = Math.random().toString(36).slice(2, 8);
    return `free-${suffix}`;
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] fade-up px-4">
      <div className="bg-white p-12 rounded-[2.5rem] shadow-2xl border border-slate-100 w-full max-w-2xl space-y-8 relative overflow-visible">
        <div className="absolute top-0 left-0 w-full h-1.5 bg-indigo-600" />

        <div className="text-center space-y-2">
          <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight uppercase">{labels.title}</h2>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em]">{labels.subtitle}</p>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">{labels.field}</label>
          <div className="relative">
            <input
              type="text"
              autoFocus
              className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:border-indigo-600 transition-all font-bold text-sm text-slate-700"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              onBlur={() => window.setTimeout(() => setOpen(false), 120)}
              placeholder={labels.placeholder}
              autoComplete="off"
            />

            {open && (loading || options.length > 0 || canUseTyped) && (
              <div className="absolute z-20 mt-2 w-full bg-white rounded-2xl border border-slate-100 shadow-2xl overflow-hidden max-h-[50vh] overflow-y-auto">
                {loading && (
                  <div className="px-5 py-4 text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                    {labels.loading}
                  </div>
                )}

                {!loading && options.map((c) => (
                  <button
                    key={c.codi_centre}
                    type="button"
                    className="w-full text-left px-5 py-4 hover:bg-slate-50 transition-all border-t border-slate-50"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      onSelected({ tenantSlug: c.codi_centre, centerName: c.denominacio_completa });
                    }}
                  >
                    <p className="text-sm font-black text-slate-900 truncate">{c.denominacio_completa}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest truncate">
                      {(c.nom_municipi || '-')}{c.nom_comarca ? ` • ${c.nom_comarca}` : ''}{c.codi_postal ? ` • ${c.codi_postal}` : ''}
                    </p>
                  </button>
                ))}

                {!loading && canUseTyped && (
                  <div className="border-t border-slate-50 px-5 py-4 bg-white">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-3">
                      {labels.notFound}
                    </p>
                    <button
                      type="button"
                      className="w-full bg-slate-900 text-white py-3 rounded-xl font-black text-[10px] uppercase tracking-[0.3em] hover:bg-indigo-600 transition-all"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        const name = query.trim();
                        onSelected({ tenantSlug: slugifyTenant(name), centerName: name, needsRegistration: true });
                      }}
                    >
                      {labels.useTyped}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <p className="text-[10px] text-slate-400 font-bold italic ml-4">{labels.hint}</p>

          <div className="mt-4">
            <button
              type="button"
              className="w-full bg-indigo-600 text-white py-3 rounded-xl font-black text-[10px] uppercase tracking-[0.3em] hover:bg-slate-900 transition-all"
              onClick={() => {
                onSelected({ tenantSlug: makeFreeTenantSlug(), centerName: '', needsRegistration: true, freeAccess: true });
              }}
            >
              {labels.freeCta}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InstitutionGate;
