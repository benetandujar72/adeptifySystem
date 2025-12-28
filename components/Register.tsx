import React, { useEffect, useState } from 'react';
import { useLanguage } from '../LanguageContext';
import { CatEducationCenter, searchCatEducationCenters } from '../services/educationCentersService';

export type RegistrationData = {
  contactName: string;
  contactEmail: string;
  centerName: string;
};

interface RegisterProps {
  initial?: Partial<RegistrationData>;
  onRegistered: (data: RegistrationData) => void;
}

const LOCAL_REG_KEY = 'adeptify_registration';
const SESSION_FREE_ACCESS_KEY = 'adeptify_free_access';

const Register: React.FC<RegisterProps> = ({ initial, onRegistered }) => {
  const { t, language } = useLanguage();
  const isFreeAccess = (() => {
    try {
      return sessionStorage.getItem(SESSION_FREE_ACCESS_KEY) === 'true';
    } catch {
      return false;
    }
  })();
  const [contactName, setContactName] = useState(initial?.contactName ?? '');
  const [contactEmail, setContactEmail] = useState(initial?.contactEmail ?? '');
  const [centerName, setCenterName] = useState(initial?.centerName ?? '');
  const [centerOptions, setCenterOptions] = useState<CatEducationCenter[]>([]);
  const [centerLoading, setCenterLoading] = useState(false);
  const [centerOpen, setCenterOpen] = useState(false);

  useEffect(() => {
    // If there's already a stored registration, prefill.
    try {
      const raw = localStorage.getItem(LOCAL_REG_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (typeof parsed?.contactName === 'string' && !contactName) setContactName(parsed.contactName);
      if (typeof parsed?.contactEmail === 'string' && !contactEmail) setContactEmail(parsed.contactEmail);
      if (typeof parsed?.centerName === 'string' && !centerName) setCenterName(parsed.centerName);
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let alive = true;
    const q = centerName.trim();

    if (q.length < 2) {
      setCenterOptions([]);
      setCenterLoading(false);
      return;
    }

    setCenterLoading(true);
    const handle = window.setTimeout(async () => {
      try {
        const res = await searchCatEducationCenters(q, 12);
        if (!alive) return;
        setCenterOptions(res);
      } finally {
        if (!alive) return;
        setCenterLoading(false);
      }
    }, 200);

    return () => {
      alive = false;
      window.clearTimeout(handle);
    };
  }, [centerName]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: RegistrationData = {
      contactName: contactName.trim(),
      contactEmail: contactEmail.trim(),
      centerName: centerName.trim(),
    };
    if (!payload.contactName || !payload.contactEmail || !payload.centerName) return;
    try {
      localStorage.setItem(LOCAL_REG_KEY, JSON.stringify(payload));
    } catch {
      // ignore
    }
    onRegistered(payload);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] fade-up px-4">
      <div className="bg-white p-12 rounded-[2.5rem] shadow-2xl border border-slate-100 w-full max-w-md space-y-8 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1.5 bg-indigo-600" />

        <div className="text-center space-y-2">
          <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 11c0 1.657-1.79 3-4 3S4 12.657 4 11s1.79-3 4-3 4 1.343 4 3zm0 0c0 1.657 1.79 3 4 3s4-1.343 4-3-1.79-3-4-3-4 1.343-4 3zM4 20v-1a4 4 0 014-4h0m8 5v-1a4 4 0 00-4-4h0" />
            </svg>
          </div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight uppercase">
            {isFreeAccess ? t.registerTitlePersonalized : t.registerTitle}
          </h2>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em]">
            {isFreeAccess ? t.registerSubtitlePersonalized : t.registerSubtitle}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label htmlFor="reg-name" className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">{t.registerName}</label>
            <input
              id="reg-name"
              type="text"
              required
              autoFocus
              className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:border-indigo-600 transition-all font-bold text-sm text-slate-700"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              placeholder={t.registerNamePlaceholder}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="reg-email" className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">{t.registerEmail}</label>
            <input
              id="reg-email"
              type="email"
              required
              autoComplete="email"
              className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:border-indigo-600 transition-all font-bold text-sm text-slate-700"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder={t.registerEmailPlaceholder}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="reg-center" className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">{t.registerCenter}</label>
            <div className="relative">
              <input
                id="reg-center"
                type="text"
                required
                className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:border-indigo-600 transition-all font-bold text-sm text-slate-700"
                value={centerName}
                onChange={(e) => {
                  setCenterName(e.target.value);
                  setCenterOpen(true);
                }}
                onFocus={() => setCenterOpen(true)}
                onBlur={() => {
                  // Allow click selection before closing.
                  window.setTimeout(() => setCenterOpen(false), 120);
                }}
                placeholder={t.registerCenterPlaceholder}
                autoComplete="off"
              />

              {centerOpen && (centerLoading || centerOptions.length > 0) && (
                <div className="absolute z-20 mt-2 w-full bg-white rounded-2xl border border-slate-100 shadow-2xl overflow-hidden">
                  {centerLoading && (
                    <div className="px-5 py-4 text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                      {language === 'ca' ? 'Carregant...' : language === 'eu' ? 'Kargatzen...' : 'Cargando...'}
                    </div>
                  )}

                  {!centerLoading && centerOptions.map((c) => (
                    <button
                      key={c.codi_centre}
                      type="button"
                      className="w-full text-left px-5 py-4 hover:bg-slate-50 transition-all border-t border-slate-50"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setCenterName(c.denominacio_completa);
                        setCenterOpen(false);
                      }}
                    >
                      <p className="text-sm font-black text-slate-900 truncate">{c.denominacio_completa}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest truncate">
                        {(c.nom_municipi || '-')}{c.nom_comarca ? ` • ${c.nom_comarca}` : ''}{c.codi_postal ? ` • ${c.codi_postal}` : ''}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black text-xs uppercase tracking-[0.3em] hover:bg-indigo-600 transition-all shadow-xl active:scale-95 flex items-center justify-center gap-3 btn-premium"
          >
            {t.registerContinue}
          </button>
        </form>

        <div className="pt-6 border-t border-slate-50 text-center">
          <p className="text-[8px] text-slate-300 font-bold uppercase tracking-widest">{t.registerFreeNote}</p>
        </div>
      </div>
    </div>
  );
};

export default Register;
