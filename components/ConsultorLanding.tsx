import React, { useMemo, useState, useEffect } from 'react';
import { useLanguage } from '../LanguageContext';
import { ADEPTIFY_INFO } from '../constants';
import ProjectExamples from './ProjectExamples';
import AnimatedCounter from './AnimatedCounter';

type Props = {
  onOpenApp: () => void;
  onOpenDocs: () => void;
};

const ConsultorLanding: React.FC<Props> = ({ onOpenApp, onOpenDocs }) => {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'services' | 'cases' | 'methodology'>('services');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactMessage, setContactMessage] = useState('');
  const [contactStatus, setContactStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [contactError, setContactError] = useState('');

  const canSubmit = !!contactName.trim() && !!contactEmail.trim() && !!contactMessage.trim();

  const submitContact = async () => {
    if (!canSubmit || contactStatus === 'sending') return;

    setContactStatus('sending');
    setContactError('');

    try {
      const resp = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: contactName.trim(),
          email: contactEmail.trim(),
          message: contactMessage.trim(),
          page: window.location.href,
          lang: document.documentElement.lang || undefined,
        }),
      });

      if (!resp.ok) {
        let msg = t.consultorContactError;
        try {
          const data = await resp.json();
          const serverMsg = data?.error?.message;
          if (typeof serverMsg === 'string' && serverMsg.trim()) msg = serverMsg.trim();
        } catch {
          // ignore
        }
        throw new Error(msg);
      }

      setContactStatus('sent');
      setContactMessage('');
    } catch (e) {
      setContactStatus('error');
      setContactError(e instanceof Error ? e.message : t.consultorContactError);
    }
  };

  return (
    <div className="fade-up space-y-24 md:space-y-32 pb-20">
      {/* 1. HERO SECTION */}
      <section className="relative w-full max-w-7xl mx-auto px-4 pt-10 md:pt-20">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-[500px] bg-gradient-to-b from-blue-50/50 to-transparent -z-10 blur-3xl rounded-full" />

        <div className="text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-100 rounded-full text-[10px] font-black uppercase tracking-[0.25em] text-blue-600 mb-8">
            {t.consultorKicker}
          </div>

          <h1 className="text-5xl md:text-7xl font-sans font-black text-slate-900 mb-8 leading-[1.1] tracking-tight">
            {t.lpHeroTitle1}<br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-cyan-500">
              {t.lpHeroTitle2}
            </span>
          </h1>

          <p className="text-slate-500 font-medium text-lg md:text-xl max-w-3xl mx-auto leading-relaxed mb-12">
            {t.lpHeroDesc}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => document.getElementById('contacto')?.scrollIntoView({ behavior: 'smooth' })}
              className="w-full sm:w-auto bg-blue-600 text-white px-10 py-5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-blue-700 transition-all shadow-xl shadow-blue-200 hover:-translate-y-1 active:scale-95"
            >
              {t.lpHeroCta1}
            </button>
            <button
              onClick={() => document.getElementById('casos')?.scrollIntoView({ behavior: 'smooth' })}
              className="w-full sm:w-auto bg-white text-slate-900 px-10 py-5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] border border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition-all active:scale-95"
            >
              {t.lpHeroCta2}
            </button>
          </div>

          <div className="mt-16 flex items-center justify-center gap-8 grayscale opacity-50">
            {/* Logos representatius de tech stack */}
            <div className="font-black text-xl tracking-tighter text-slate-400">REACT</div>
            <div className="font-black text-xl tracking-tighter text-slate-400">SUPABASE</div>
            <div className="font-black text-xl tracking-tighter text-slate-400">TAILWIND</div>
            <div className="font-black text-xl tracking-tighter text-slate-400">GEMINI IA</div>
          </div>
        </div>
      </section>

      {/* 2. VALUE PROPOSITION */}
      <section className="w-full max-w-6xl mx-auto px-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div>
            <h2 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tight leading-tight mb-6">
              {t.lpValueTitle}
            </h2>
            <p className="text-lg text-slate-500 font-medium leading-relaxed mb-10">
              {t.lpValueDesc}
            </p>

            <div className="space-y-8">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex gap-5">
                  <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600">
                    {i === 1 ? (
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                    ) : i === 2 ? (
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                    ) : (
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                    )}
                  </div>
                  <div>
                    <h4 className="text-xl font-black text-slate-900 mb-2">{(t as any)[`lpValue${i}Title`]}</h4>
                    <p className="text-slate-500 font-medium leading-relaxed">{(t as any)[`lpValue${i}Desc`]}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-4 bg-gradient-to-tr from-blue-100 via-white to-cyan-50 rounded-[3rem] blur-2xl opacity-70" />
            <div className="relative glass-morphism border border-white/40 shadow-2xl rounded-[2.5rem] overflow-hidden bg-white/60 p-2">
              <div className="bg-slate-900 rounded-[2.2rem] p-8 aspect-square flex flex-col justify-center overflow-hidden relative">
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/20 blur-[80px] rounded-full" />
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-cyan-400/10 blur-[60px] rounded-full" />

                <div className="space-y-6 relative z-10">
                  <div className="h-2 w-24 bg-blue-500 rounded-full" />
                  <div className="h-8 w-full bg-white/10 rounded-xl" />
                  <div className="h-8 w-3/4 bg-white/10 rounded-xl" />
                  <div className="pt-8 grid grid-cols-2 gap-4">
                    <div className="h-20 bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl flex items-center justify-center">
                      <div className="w-8 h-8 text-white"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg></div>
                    </div>
                    <div className="h-20 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center">
                      <div className="w-8 h-8 text-blue-400"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. SERVICE PACKAGES */}
      <section id="servicios" className="w-full max-w-7xl mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tight mb-6">{t.lpServicesTitle}</h2>
          <p className="text-lg text-slate-500 font-medium max-w-3xl mx-auto">{t.lpServicesDesc}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[1, 2, 3].map((i) => (
            <div key={i} className="group relative bg-white border border-slate-100 p-10 rounded-[2.5rem] shadow-sm hover:shadow-2xl hover:shadow-blue-100 transition-all duration-500 hover:-translate-y-2">
              <div className="w-16 h-16 rounded-[1.5rem] bg-slate-50 text-blue-600 flex items-center justify-center mb-8 border border-slate-100 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                {i === 1 ? (
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg>
                ) : i === 2 ? (
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                ) : (
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg>
                )}
              </div>
              <h3 className="text-2xl font-black text-slate-900 mb-4">{(t as any)[`lpService${i}Title`]}</h3>
              <p className="text-slate-500 font-medium leading-relaxed mb-10">{(t as any)[`lpService${i}Desc`]}</p>

              <div className="pt-6 border-t border-slate-50 group-hover:border-blue-50 transition-colors flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 group-hover:text-blue-500 transition-colors">{t.lpServiceCta}</span>
                <svg className="w-5 h-5 text-slate-300 group-hover:text-blue-500 group-hover:translate-x-2 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 4. CASE STUDIES (Reusing ProjectExamples) */}
      <section id="casos" className="w-full bg-slate-50 py-24 md:py-32">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tight mb-6">{t.lpCasesTitle}</h2>
            <p className="text-lg text-slate-500 font-medium max-w-3xl mx-auto">{t.lpCasesDesc}</p>
          </div>
          <ProjectExamples />
        </div>
      </section>

      {/* 5. METHODOLOGY */}
      <section className="w-full max-w-7xl mx-auto px-4">
        <div className="text-center mb-20">
          <h2 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tight mb-6">{t.lpMethodTitle}</h2>
          <p className="text-lg text-slate-500 font-medium max-w-3xl mx-auto">{t.lpMethodDesc}</p>
        </div>

        <div className="relative">
          <div className="hidden md:block absolute top-[28px] left-[5%] right-[5%] h-1 bg-slate-100 -z-10" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="text-center space-y-6">
                <div className="w-14 h-14 rounded-full bg-white border-4 border-blue-500 mx-auto flex items-center justify-center font-black text-blue-600 text-lg shadow-lg">
                  {i}
                </div>
                <div>
                  <h4 className="text-xl font-black text-slate-900 mb-3">{(t as any)[`lpMethod${i}Title`]}</h4>
                  <p className="text-slate-500 font-medium leading-relaxed">{(t as any)[`lpMethod${i}Desc`]}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 6. IMPACT METRICS */}
      <section className="w-full py-16">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center bg-blue-600 rounded-[3rem] p-16 shadow-2xl shadow-blue-200">
            <div>
              <div className="text-5xl md:text-6xl font-black text-white mb-2 flex items-center justify-center">
                <AnimatedCounter value={95} suffix="%" />
              </div>
              <div className="text-blue-100 font-black uppercase tracking-[0.2em] text-xs px-2">{t.lpMetric1Label}</div>
            </div>
            <div className="border-t md:border-t-0 md:border-x border-blue-500/50 py-8 md:py-0">
              <div className="text-5xl md:text-6xl font-black text-white mb-2 flex items-center justify-center">
                <AnimatedCounter value={4.5} suffix="K" decimals={1} prefix="+" />
              </div>
              <div className="text-blue-100 font-black uppercase tracking-[0.2em] text-xs px-2">{t.lpMetric2Label}</div>
            </div>
            <div>
              <div className="text-5xl md:text-6xl font-black text-white mb-2 flex items-center justify-center">
                <AnimatedCounter value={15} suffix="+" />
              </div>
              <div className="text-blue-100 font-black uppercase tracking-[0.2em] text-xs px-2">{t.lpMetric3Label}</div>
            </div>
          </div>
        </div>
      </section>

      {/* 7. CONTACT FORM */}
      <section id="contacto" className="w-full max-w-6xl mx-auto px-4">
        <div className="bg-slate-900 rounded-[3rem] overflow-hidden shadow-2xl grid grid-cols-1 lg:grid-cols-[1fr,1.2fr]">
          <div className="p-12 md:p-20 bg-gradient-to-br from-slate-900 to-slate-800 text-white flex flex-col justify-center">
            <h2 className="text-3xl md:text-5xl font-black tracking-tight mb-8">
              {t.lpContactTitle}
            </h2>
            <p className="text-slate-400 text-lg font-medium leading-relaxed mb-12">
              {t.lpContactDesc}
            </p>

            <div className="space-y-6">
              <div className="flex items-center gap-4 text-slate-300">
                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/10"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg></div>
                <span className="font-semibold">{ADEPTIFY_INFO.email}</span>
              </div>
              <div className="flex items-center gap-4 text-slate-300">
                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/10"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 22s8-4.5 8-10a8 8 0 10-16 0c0 5.5 8 10 8 10z" /></svg></div>
                <span className="font-semibold">Barcelona, Spain</span>
              </div>
            </div>
          </div>

          <div className="p-10 md:p-20 bg-white">
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{t.consultorContactFieldName}</label>
                  <input
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    className="w-full px-6 py-4 rounded-2xl bg-slate-50 border border-slate-100 text-slate-900 font-semibold outline-none focus:border-blue-500 focus:bg-white transition-all"
                    placeholder={t.lpContactNamePlaceholder}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{t.consultorContactFieldEmail}</label>
                  <input
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    className="w-full px-6 py-4 rounded-2xl bg-slate-50 border border-slate-100 text-slate-900 font-semibold outline-none focus:border-blue-500 focus:bg-white transition-all"
                    placeholder={t.lpContactEmailPlaceholder}
                    type="email"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{t.consultorContactFieldMessage}</label>
                <textarea
                  value={contactMessage}
                  onChange={(e) => setContactMessage(e.target.value)}
                  className="w-full px-6 py-4 rounded-2xl bg-slate-50 border border-slate-100 text-slate-900 font-semibold outline-none focus:border-blue-500 focus:bg-white transition-all min-h-[160px]"
                  placeholder={t.lpContactMsgPlaceholder}
                />
              </div>

              <button
                type="button"
                onClick={submitContact}
                disabled={!canSubmit || contactStatus === 'sending'}
                className={`w-full px-10 py-5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all shadow-xl ${canSubmit && contactStatus !== 'sending'
                  ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-100'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none'
                  }`}
              >
                {contactStatus === 'sending' ? t.consultorContactSending : t.lpContactSubmit}
              </button>

              {contactStatus === 'sent' && (
                <p className="text-center font-bold text-emerald-600 animate-bounce">{t.lpContactSuccess}</p>
              )}

              {contactStatus === 'error' && (
                <p className="text-center font-bold text-rose-500">{contactError || t.lpContactError}</p>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default ConsultorLanding;

