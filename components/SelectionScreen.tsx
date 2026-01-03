
import React, { useMemo, useState } from 'react';
import { ProductType } from '../types';
import { useLanguage } from '../LanguageContext';

interface SelectionScreenProps {
  onChoice: (choice: ProductType | 'DOCS') => void;
  centerName?: string;
}

const SelectionScreen: React.FC<SelectionScreenProps> = ({ onChoice, centerName }) => {
  const { t } = useLanguage();
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const faqs = useMemo(() => ([
    { q: t.landingFaqQ1, a: t.landingFaqA1 },
    { q: t.landingFaqQ2, a: t.landingFaqA2 },
    { q: t.landingFaqQ3, a: t.landingFaqA3 },
  ]), [t]);

  const scrollToRoutes = () => {
    const el = document.getElementById('adeptify-routes');
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const products = [
    {
      id: 'LMS' as ProductType,
      title: t.lmsTitle,
      desc: t.lmsDesc,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      ),
    },
    {
      id: 'AUDIT' as ProductType,
      title: t.auditTitle,
      desc: t.auditDesc,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      ),
    },
    {
      id: 'VISION' as ProductType,
      title: t.visionTitle,
      desc: t.visionDesc,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      ),
    }
  ];

  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 fade-up">
      <section className="w-full max-w-6xl">
        <div className="text-center mb-12 md:mb-16">
          {centerName?.trim() ? (
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-50 border border-slate-100 rounded-full text-[10px] font-black uppercase tracking-[0.25em] text-slate-600">
              <span className="text-slate-400">{t.landingCenterLabel}</span>
              <span className="text-slate-900">{centerName.trim()}</span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-50 border border-slate-100 rounded-full text-[10px] font-black uppercase tracking-[0.25em] text-slate-600">
              {t.landingKicker}
            </div>
          )}

          <h1 className="mt-8 text-5xl md:text-6xl font-serif text-slate-900 mb-6 leading-tight">
            {t.heroTitle} <br />
            <span className="italic text-indigo-700 font-normal">{t.heroSubtitle}</span>
          </h1>

          <p className="text-slate-500 font-medium text-lg max-w-2xl mx-auto leading-relaxed">
            {t.heroDesc}
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3">
            <button
              onClick={scrollToRoutes}
              className="bg-slate-900 text-white px-8 py-4 rounded-xl font-black text-[10px] uppercase tracking-[0.22em] hover:bg-indigo-600 transition-all shadow-lg"
            >
              {t.landingPrimaryCta}
            </button>
            <button
              onClick={() => onChoice('DOCS')}
              className="bg-white text-slate-900 px-8 py-4 rounded-xl font-black text-[10px] uppercase tracking-[0.22em] border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50 transition-all"
            >
              {t.landingSecondaryCta}
            </button>
          </div>

          <p className="mt-6 text-[11px] text-slate-400 font-semibold tracking-wide">
            {t.landingTrustLine}
          </p>
        </div>
      </section>

      <section className="w-full max-w-6xl mb-16 md:mb-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((step) => (
            <div key={step} className="bg-white p-8 rounded-2xl border border-slate-100 shadow-[0_4px_20px_rgba(0,0,0,0.03)] text-left">
              <div className="w-10 h-10 rounded-xl bg-slate-50 text-slate-900 flex items-center justify-center font-black">
                {step}
              </div>
              <h3 className="mt-6 text-lg font-black text-slate-900 tracking-tight">
                {step === 1 ? t.landingHow1Title : step === 2 ? t.landingHow2Title : t.landingHow3Title}
              </h3>
              <p className="mt-3 text-sm text-slate-500 leading-relaxed font-medium">
                {step === 1 ? t.landingHow1Desc : step === 2 ? t.landingHow2Desc : t.landingHow3Desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section id="adeptify-routes" className="w-full max-w-6xl mb-16 md:mb-20 scroll-mt-28">
        <div className="text-left md:text-center mb-10">
          <h2 className="text-2xl md:text-3xl font-serif text-slate-900 italic">{t.landingChooseTitle}</h2>
          <p className="mt-3 text-slate-500 font-medium max-w-2xl md:mx-auto leading-relaxed">
            {t.landingChooseDesc}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full">
          {products.map((product) => (
            <div
              key={product.id}
              onClick={() => onChoice(product.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onChoice(product.id);
                }
              }}
              role="button"
              tabIndex={0}
              aria-label={product.title}
              className="group bg-white p-10 rounded-2xl border border-slate-100 shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:shadow-[0_20px_40px_rgba(0,0,0,0.06)] hover:border-indigo-200 transition-all duration-500 cursor-pointer flex flex-col items-start text-left gap-6"
            >
              <div className="w-12 h-12 bg-slate-50 text-slate-900 rounded-xl flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-all duration-500">
                {product.icon}
              </div>
              <div className="space-y-3">
                <h3 className="text-xl font-bold text-slate-900 tracking-tight">{product.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed font-medium">{product.desc}</p>
              </div>
              <div className="mt-4 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-indigo-600 group-hover:translate-x-2 transition-transform">
                {t.btnStart}
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 w-full bg-slate-950 rounded-2xl p-10 md:p-12 text-white flex flex-col md:flex-row items-start md:items-center justify-between gap-10 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-[100px] -mr-40 -mt-40" />
          <div className="space-y-4 relative z-10 max-w-lg">
            <h3 className="text-2xl md:text-3xl font-serif italic text-indigo-400">{t.globalAuditTitle}</h3>
            <p className="text-slate-400 text-sm leading-relaxed font-medium">
              {t.globalAuditDesc}
            </p>
          </div>
          <button
            onClick={() => onChoice('DEEP_AUDIT')}
            className="bg-white text-slate-900 px-10 py-5 rounded-xl font-black text-[10px] uppercase tracking-[0.22em] hover:bg-indigo-50 hover:scale-105 active:scale-95 transition-all shadow-xl shrink-0 relative z-10"
          >
            {t.globalAuditBtn}
          </button>
        </div>
      </section>

      <section className="w-full max-w-4xl mb-16 md:mb-20">
        <div className="text-left md:text-center mb-10">
          <h2 className="text-2xl md:text-3xl font-serif text-slate-900 italic">{t.landingFaqTitle}</h2>
          <p className="mt-3 text-slate-500 font-medium leading-relaxed max-w-2xl md:mx-auto">
            {t.landingFaqDesc}
          </p>
        </div>

        <div className="space-y-3">
          {faqs.map((item, idx) => {
            const isOpen = openFaq === idx;
            const buttonId = `landing-faq-${idx}-button`;
            const panelId = `landing-faq-${idx}-panel`;
            return (
              <div key={item.q} className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.03)]">
                <button
                  type="button"
                  onClick={() => setOpenFaq(isOpen ? null : idx)}
                  className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left"
                  id={buttonId}
                  aria-controls={panelId}
                  aria-expanded={isOpen ? 'true' : 'false'}
                >
                  <span className="text-sm md:text-base font-black text-slate-900 tracking-tight">{item.q}</span>
                  <span className={`w-9 h-9 rounded-xl flex items-center justify-center border border-slate-100 text-slate-700 transition-transform ${isOpen ? 'rotate-45 bg-indigo-50 text-indigo-700 border-indigo-100' : 'bg-slate-50'}`}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 5v14m7-7H5" /></svg>
                  </span>
                </button>
                {isOpen ? (
                  <div id={panelId} role="region" aria-labelledby={buttonId} className="px-6 pb-6 -mt-1">
                    <p className="text-sm text-slate-500 leading-relaxed font-medium">{item.a}</p>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>

      <section className="w-full max-w-6xl">
        <div className="bg-white border border-slate-100 rounded-2xl p-10 md:p-12 shadow-[0_20px_40px_rgba(0,0,0,0.06)] flex flex-col md:flex-row items-start md:items-center justify-between gap-10">
          <div className="max-w-xl">
            <h2 className="text-2xl md:text-3xl font-serif text-slate-900 italic">{t.landingFinalTitle}</h2>
            <p className="mt-3 text-slate-500 font-medium leading-relaxed">{t.landingFinalDesc}</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <button
              onClick={scrollToRoutes}
              className="bg-slate-900 text-white px-8 py-4 rounded-xl font-black text-[10px] uppercase tracking-[0.22em] hover:bg-indigo-600 transition-all shadow-lg"
            >
              {t.landingPrimaryCta}
            </button>
            <button
              onClick={() => onChoice('DOCS')}
              className="bg-white text-slate-900 px-8 py-4 rounded-xl font-black text-[10px] uppercase tracking-[0.22em] border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50 transition-all"
            >
              {t.landingSecondaryCta}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default SelectionScreen;
