import React, { useMemo, useState } from 'react';
import { useLanguage } from '../LanguageContext';
import { ADEPTIFY_INFO } from '../constants';

type Props = {
  onOpenApp: () => void;
  onOpenDocs: () => void;
};

const ConsultorLanding: React.FC<Props> = ({ onOpenApp, onOpenDocs }) => {
  const { t } = useLanguage();
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactMessage, setContactMessage] = useState('');
  const [contactStatus, setContactStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [contactError, setContactError] = useState('');

  const faqs = useMemo(
    () => [
      { q: t.consultorFaqQ1, a: t.consultorFaqA1 },
      { q: t.consultorFaqQ2, a: t.consultorFaqA2 },
      { q: t.consultorFaqQ3, a: t.consultorFaqA3 },
      { q: t.consultorFaqQ4, a: t.consultorFaqA4 },
    ],
    [t]
  );

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
    <div className="fade-up">
      <section className="w-full max-w-6xl mx-auto">
        <div className="text-center mb-14 md:mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-50 border border-slate-100 rounded-full text-[10px] font-black uppercase tracking-[0.25em] text-slate-600">
            {t.consultorKicker}
          </div>

          <h1 className="mt-8 text-5xl md:text-6xl font-serif text-slate-900 mb-6 leading-tight">
            {t.consultorHeroTitle}{' '}
            <span className="italic text-indigo-700 font-normal">{t.consultorHeroTitleAccent}</span>
          </h1>

          <p className="text-slate-500 font-medium text-lg max-w-3xl mx-auto leading-relaxed">
            {t.consultorHeroDesc}
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3">
            <button
              onClick={onOpenApp}
              className="bg-slate-900 text-white px-8 py-4 rounded-xl font-black text-[10px] uppercase tracking-[0.22em] hover:bg-indigo-600 transition-all shadow-lg"
            >
              {t.consultorPrimaryCta}
            </button>
            <button
              onClick={onOpenDocs}
              className="bg-white text-slate-900 px-8 py-4 rounded-xl font-black text-[10px] uppercase tracking-[0.22em] border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50 transition-all"
            >
              {t.consultorSecondaryCta}
            </button>
          </div>

          <p className="mt-6 text-[11px] text-slate-400 font-semibold tracking-wide">
            {t.consultorTrustLine}
          </p>
        </div>
      </section>

      <section className="w-full max-w-6xl mx-auto mb-16 md:mb-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((step) => (
            <div
              key={step}
              className="bg-white p-8 rounded-2xl border border-slate-100 shadow-[0_4px_20px_rgba(0,0,0,0.03)] text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-slate-50 text-slate-900 flex items-center justify-center font-black">
                {step}
              </div>
              <h3 className="mt-6 text-lg font-black text-slate-900 tracking-tight">
                {step === 1 ? t.consultorHow1Title : step === 2 ? t.consultorHow2Title : t.consultorHow3Title}
              </h3>
              <p className="mt-3 text-sm text-slate-500 leading-relaxed font-medium">
                {step === 1 ? t.consultorHow1Desc : step === 2 ? t.consultorHow2Desc : t.consultorHow3Desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="w-full max-w-6xl mx-auto mb-16 md:mb-20">
        <div className="text-left md:text-center mb-10">
          <h2 className="text-2xl md:text-3xl font-serif text-slate-900 italic">{t.consultorProductTitle}</h2>
          <p className="mt-3 text-slate-500 font-medium leading-relaxed max-w-3xl md:mx-auto">{t.consultorProductDesc}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="bg-white border border-slate-100 rounded-2xl p-8 shadow-[0_4px_20px_rgba(0,0,0,0.03)]"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 tracking-tight">
                    {i === 1
                      ? t.consultorGen1Title
                      : i === 2
                        ? t.consultorGen2Title
                        : i === 3
                          ? t.consultorGen3Title
                          : t.consultorGen4Title}
                  </h3>
                  <p className="mt-2 text-sm text-slate-500 leading-relaxed font-medium">
                    {i === 1
                      ? t.consultorGen1Desc
                      : i === 2
                        ? t.consultorGen2Desc
                        : i === 3
                          ? t.consultorGen3Desc
                          : t.consultorGen4Desc}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="w-full max-w-6xl mx-auto mb-16 md:mb-20">
        <div className="text-left md:text-center mb-10">
          <h2 className="text-2xl md:text-3xl font-serif text-slate-900 italic">{t.consultorScreensTitle}</h2>
          <p className="mt-3 text-slate-500 font-medium leading-relaxed max-w-3xl md:mx-auto">{t.consultorScreensDesc}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-[0_20px_40px_rgba(0,0,0,0.06)]"
            >
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">
                  {i === 1 ? t.consultorScreens1Label : i === 2 ? t.consultorScreens2Label : t.consultorScreens3Label}
                </span>
                <span className="text-[10px] font-black uppercase tracking-[0.22em] text-indigo-700">
                  {t.consultorScreensTag}
                </span>
              </div>
              <img
                className="w-full h-56 object-cover bg-slate-50"
                src={i === 1 ? '/screenshots/consultor-feature-1.svg' : i === 2 ? '/screenshots/consultor-feature-2.svg' : '/screenshots/consultor-feature-3.svg'}
                alt={i === 1 ? t.consultorScreens1Alt : i === 2 ? t.consultorScreens2Alt : t.consultorScreens3Alt}
                loading="lazy"
              />
              <div className="p-6">
                <p className="text-sm text-slate-500 leading-relaxed font-medium">
                  {i === 1
                    ? t.consultorScreens1Desc
                    : i === 2
                      ? t.consultorScreens2Desc
                      : t.consultorScreens3Desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="w-full max-w-6xl mx-auto mb-16 md:mb-20">
        <div className="text-left md:text-center mb-10">
          <h2 className="text-2xl md:text-3xl font-serif text-slate-900 italic">{t.consultorExamplesTitle}</h2>
          <p className="mt-3 text-slate-500 font-medium leading-relaxed max-w-3xl md:mx-auto">{t.consultorExamplesDesc}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white border border-slate-100 rounded-2xl p-8 shadow-[0_4px_20px_rgba(0,0,0,0.03)]">
            <h3 className="text-lg font-black text-slate-900 tracking-tight">{t.consultorExample1Title}</h3>
            <p className="mt-2 text-sm text-slate-500 leading-relaxed font-medium">{t.consultorExample1Desc}</p>
            <div className="mt-6 bg-slate-950 rounded-2xl p-6 text-slate-100">
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-indigo-300">{t.consultorExampleBoxLabel}</p>
              <p className="mt-3 text-sm leading-relaxed text-slate-200">{t.consultorExampleBox1}</p>
            </div>
          </div>

          <div className="bg-white border border-slate-100 rounded-2xl p-8 shadow-[0_4px_20px_rgba(0,0,0,0.03)]">
            <h3 className="text-lg font-black text-slate-900 tracking-tight">{t.consultorExample2Title}</h3>
            <p className="mt-2 text-sm text-slate-500 leading-relaxed font-medium">{t.consultorExample2Desc}</p>
            <div className="mt-6 bg-slate-950 rounded-2xl p-6 text-slate-100">
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-indigo-300">{t.consultorExampleBoxLabel}</p>
              <p className="mt-3 text-sm leading-relaxed text-slate-200">{t.consultorExampleBox2}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="w-full max-w-6xl mx-auto mb-16 md:mb-20">
        <div className="text-left md:text-center mb-10">
          <h2 className="text-2xl md:text-3xl font-serif text-slate-900 italic">{t.consultorPlansTitle}</h2>
          <p className="mt-3 text-slate-500 font-medium leading-relaxed max-w-3xl md:mx-auto">{t.consultorPlansDesc}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className={`bg-white border rounded-2xl p-8 shadow-[0_4px_20px_rgba(0,0,0,0.03)] ${i === 2 ? 'border-indigo-200' : 'border-slate-100'}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-black text-slate-900 tracking-tight">
                    {i === 1 ? t.consultorPlan1Name : i === 2 ? t.consultorPlan2Name : t.consultorPlan3Name}
                  </h3>
                  <p className="mt-2 text-sm text-slate-500 leading-relaxed font-medium">
                    {i === 1 ? t.consultorPlan1Desc : i === 2 ? t.consultorPlan2Desc : t.consultorPlan3Desc}
                  </p>
                </div>
                {i === 2 ? (
                  <span className="inline-flex items-center px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-black uppercase tracking-[0.22em]">
                    {t.consultorPlanFeatured}
                  </span>
                ) : null}
              </div>

              <div className="mt-6 text-slate-900">
                <div className="text-3xl font-black tracking-tight">
                  {i === 1 ? t.consultorPlan1Price : i === 2 ? t.consultorPlan2Price : t.consultorPlan3Price}
                </div>
                <div className="mt-1 text-[11px] text-slate-400 font-semibold tracking-wide">
                  {i === 1 ? t.consultorPlan1PriceNote : i === 2 ? t.consultorPlan2PriceNote : t.consultorPlan3PriceNote}
                </div>
              </div>

              <ul className="mt-6 space-y-3">
                {(
                  i === 1
                    ? [t.consultorPlan1Feat1, t.consultorPlan1Feat2, t.consultorPlan1Feat3]
                    : i === 2
                      ? [t.consultorPlan2Feat1, t.consultorPlan2Feat2, t.consultorPlan2Feat3]
                      : [t.consultorPlan3Feat1, t.consultorPlan3Feat2, t.consultorPlan3Feat3]
                ).map((txt) => (
                  <li key={txt} className="flex items-start gap-3 text-sm text-slate-600 font-medium">
                    <span className="mt-1 w-4 h-4 rounded bg-indigo-50 text-indigo-700 flex items-center justify-center shrink-0">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                      </svg>
                    </span>
                    <span>{txt}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={onOpenApp}
                className={`mt-8 w-full px-8 py-4 rounded-xl font-black text-[10px] uppercase tracking-[0.22em] transition-all ${
                  i === 2
                    ? 'bg-slate-900 text-white hover:bg-indigo-600 shadow-lg'
                    : 'bg-white text-slate-900 border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50'
                }`}
              >
                {t.consultorPlanCta}
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="w-full max-w-4xl mx-auto mb-16 md:mb-20">
        <div className="text-left md:text-center mb-10">
          <h2 className="text-2xl md:text-3xl font-serif text-slate-900 italic">{t.consultorFaqTitle}</h2>
          <p className="mt-3 text-slate-500 font-medium leading-relaxed max-w-2xl md:mx-auto">{t.consultorFaqDesc}</p>
        </div>

        <div className="space-y-3">
          {faqs.map((item, idx) => {
            const isOpen = openFaq === idx;
            const buttonId = `consultor-faq-${idx}-button`;
            const panelId = `consultor-faq-${idx}-panel`;
            return (
              <div
                key={item.q}
                className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.03)]"
              >
                <button
                  type="button"
                  onClick={() => setOpenFaq(isOpen ? null : idx)}
                  className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left"
                  id={buttonId}
                  aria-controls={panelId}
                  aria-expanded={isOpen ? 'true' : 'false'}
                >
                  <span className="text-sm md:text-base font-black text-slate-900 tracking-tight">{item.q}</span>
                  <span
                    className={`w-9 h-9 rounded-xl flex items-center justify-center border border-slate-100 text-slate-700 transition-transform ${
                      isOpen ? 'rotate-45 bg-indigo-50 text-indigo-700 border-indigo-100' : 'bg-slate-50'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 5v14m7-7H5" />
                    </svg>
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

      <section className="w-full max-w-6xl mx-auto">
        <div className="bg-white border border-slate-100 rounded-2xl p-10 md:p-12 shadow-[0_20px_40px_rgba(0,0,0,0.06)] grid grid-cols-1 md:grid-cols-2 gap-10">
          <div className="max-w-xl">
            <h2 className="text-2xl md:text-3xl font-serif text-slate-900 italic">{t.consultorContactTitle}</h2>
            <p className="mt-3 text-slate-500 font-medium leading-relaxed">{t.consultorContactDesc}</p>

            <div className="mt-8 space-y-3 text-sm text-slate-600 font-medium">
              <div className="flex items-start gap-3">
                <span className="mt-1 w-8 h-8 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-700">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5h18M3 12h18M3 19h18" />
                  </svg>
                </span>
                <div>
                  <div className="text-slate-900 font-black">{t.consultorContactPhoneLabel}</div>
                  <div className="text-slate-500">{ADEPTIFY_INFO.phone}</div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <span className="mt-1 w-8 h-8 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-700">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 22s8-4.5 8-10a8 8 0 10-16 0c0 5.5 8 10 8 10z" />
                  </svg>
                </span>
                <div>
                  <div className="text-slate-900 font-black">{t.consultorContactAddressLabel}</div>
                  <div className="text-slate-500">{ADEPTIFY_INFO.address}</div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <span className="mt-1 w-8 h-8 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-700">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4h16v16H4z" />
                  </svg>
                </span>
                <div>
                  <div className="text-slate-900 font-black">{t.consultorContactEmailLabel}</div>
                  <div className="text-slate-500">{ADEPTIFY_INFO.email}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-8">
            <div className="grid grid-cols-1 gap-4">
              <label className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">
                {t.consultorContactFieldName}
                <input
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  className="mt-2 w-full px-4 py-3 rounded-xl bg-white border border-slate-200 text-slate-900 text-sm font-semibold outline-none focus:border-indigo-300"
                  placeholder={t.consultorContactNamePlaceholder}
                />
              </label>

              <label className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">
                {t.consultorContactFieldEmail}
                <input
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  className="mt-2 w-full px-4 py-3 rounded-xl bg-white border border-slate-200 text-slate-900 text-sm font-semibold outline-none focus:border-indigo-300"
                  placeholder={t.consultorContactEmailPlaceholder}
                  type="email"
                />
              </label>

              <label className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">
                {t.consultorContactFieldMessage}
                <textarea
                  value={contactMessage}
                  onChange={(e) => setContactMessage(e.target.value)}
                  className="mt-2 w-full px-4 py-3 rounded-xl bg-white border border-slate-200 text-slate-900 text-sm font-semibold outline-none focus:border-indigo-300 min-h-[140px]"
                  placeholder={t.consultorContactMessagePlaceholder}
                />
              </label>

              <button
                type="button"
                onClick={submitContact}
                disabled={!canSubmit || contactStatus === 'sending'}
                className={`mt-2 px-8 py-4 rounded-xl font-black text-[10px] uppercase tracking-[0.22em] transition-all ${
                  canSubmit && contactStatus !== 'sending'
                    ? 'bg-slate-900 text-white hover:bg-indigo-600 shadow-lg'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                {contactStatus === 'sending' ? t.consultorContactSending : t.consultorContactSubmit}
              </button>

              {contactStatus === 'sent' ? (
                <p className="text-[11px] text-emerald-700 font-semibold leading-relaxed">{t.consultorContactSuccess}</p>
              ) : null}

              {contactStatus === 'error' ? (
                <p className="text-[11px] text-rose-700 font-semibold leading-relaxed">{contactError || t.consultorContactError}</p>
              ) : null}

              <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                {t.consultorContactNote}
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default ConsultorLanding;
