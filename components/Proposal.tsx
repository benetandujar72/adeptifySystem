
import React, { useRef, useState } from 'react';
import { ProposalData } from '../types';
import { ADEPTIFY_INFO } from '../constants';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { useLanguage } from '../LanguageContext';

interface ProposalProps {
  data: ProposalData;
  centerName?: string;
  onAccept: (planName: string) => void;
}

const Proposal: React.FC<ProposalProps> = ({ data, centerName, onAccept }) => {
  const { t, language } = useLanguage();
  const proposalRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const proposalRefCode = useRef(`AD-${Math.random().toString(36).substring(7).toUpperCase()}`);
  const modelUsed = data?.meta?.modelUsed;

  const downloadPDF = async () => {
    if (!proposalRef.current) return;
    setIsExporting(true);
    try {
      const element = proposalRef.current;
      const canvas = await html2canvas(element, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfPageHeight = pdf.internal.pageSize.getHeight();
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;
      while (heightLeft > 0) {
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
        heightLeft -= pdfPageHeight;
        position -= pdfPageHeight;
        if (heightLeft > 0) pdf.addPage();
      }
      pdf.save(`${t.proposalPdfFilenamePrefix}_${centerName || t.proposalDefaultCenterName}.pdf`);
    } catch (error) {
      alert(t.proposalPdfError);
    } finally {
      setIsExporting(false);
    }
  };

  const sendByEmail = () => {
    const subject = t.proposalEmailSubject.replace('{center}', centerName || 'Adeptify Systems');
    const body = t.proposalEmailBody
      .replace('{center}', centerName || t.proposalEmailDefaultCenter)
      .replace('{diagnosis}', data.diagnosis)
      .replace('{total}', data.totalInitial.toLocaleString())
      .replace('{phone}', ADEPTIFY_INFO.phone)
      .replace('{address}', ADEPTIFY_INFO.address);

    const mailtoUrl = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailtoUrl;
  };

  return (
    <div className="space-y-16 fade-up pb-32">
      <div ref={proposalRef} className="bg-white rounded-xl shadow-[0_40px_80px_rgba(0,0,0,0.08)] border border-slate-100 overflow-hidden max-w-5xl mx-auto">
        
        {/* Capçalera Estil Informe */}
        <div className="p-16 border-b border-slate-100 flex justify-between items-start">
          <div className="space-y-6">
            <h2 className="text-2xl font-serif italic text-slate-900 tracking-tight">Adeptify<span className="text-indigo-600">.</span>Systems</h2>
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em]">{t.proposalDocTitle}</p>
              <h3 className="text-3xl font-bold text-slate-900">{centerName || t.proposalDocDefaultHeading}</h3>
            </div>
          </div>
          <div className="text-right space-y-2">
             <span className="inline-block bg-slate-50 border border-slate-100 px-4 py-2 rounded text-[10px] font-bold text-slate-600 tracking-widest uppercase">
               Ref: {proposalRefCode.current}
             </span>
             <p className="text-[10px] text-slate-400 font-medium">{t.dateEmit}: {new Date().toLocaleDateString()}</p>
          </div>
        </div>
        
        <div className="p-16 space-y-20">
          {/* Executive Summary */}
          <section className="max-w-3xl">
            <h4 className="text-[10px] font-bold text-indigo-600 uppercase tracking-[0.4em] mb-6">{t.summaryTitle}</h4>
            <div className="space-y-6">
              <p className="text-2xl font-serif text-slate-800 leading-snug italic border-l-4 border-indigo-600 pl-8">
                "{data?.diagnosis || t.proposalProcessingDiagnosis}"
              </p>
              <p className="text-base text-slate-600 leading-relaxed pl-8">
                {data?.solution || t.proposalProcessingSolution}
              </p>
            </div>
          </section>

          {/* Q/A recap */}
          <section>
            <h4 className="text-[10px] font-bold text-indigo-600 uppercase tracking-[0.4em] mb-10">{t.proposalRecapTitle}</h4>
            {(data?.consultationRecap || []).length > 0 ? (
              <div className="space-y-6">
                {data.consultationRecap!.map((row, idx) => (
                  <div key={idx} className="bg-white border border-slate-100 rounded-xl p-8">
                    <p className="text-xs font-bold text-slate-900 mb-3">{row.question}</p>
                    <div className="space-y-2">
                      {(row.answers || []).length > 0 ? (
                        <ul className="text-xs text-slate-600 list-disc pl-5 space-y-1">
                          {row.answers.map((a, j) => (
                            <li key={j}>{a}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs text-slate-400 italic">—</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white border border-slate-100 rounded-xl p-8 text-center text-slate-400 italic text-sm">
                {t.roadmapGenerating}
              </div>
            )}
          </section>

          {/* System interpretation / response */}
          <section>
            <h4 className="text-[10px] font-bold text-indigo-600 uppercase tracking-[0.4em] mb-10">{t.proposalSystemResponseTitle}</h4>
            {(data?.consultationRecap || []).length > 0 ? (
              <div className="space-y-6">
                {data.consultationRecap!.map((row, idx) => (
                  <div key={idx} className="bg-slate-50 border border-slate-100 rounded-xl p-8">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">{t.phaseLabel} 0{idx + 1}</p>
                    <p className="text-sm font-bold text-slate-900 mb-3">{row.question}</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">{t.proposalInterpretationLabel}</p>
                        <p className="text-xs text-slate-600 leading-relaxed">{row.systemInterpretation || '—'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">{t.proposalSystemResponseLabel}</p>
                        <p className="text-xs text-slate-600 leading-relaxed">{row.systemResponse || '—'}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white border border-slate-100 rounded-xl p-8 text-center text-slate-400 italic text-sm">
                {t.roadmapGenerating}
              </div>
            )}
          </section>

          {/* Detailed solution */}
          <section>
            <h4 className="text-[10px] font-bold text-indigo-600 uppercase tracking-[0.4em] mb-10">{t.proposalSolutionDetailsTitle}</h4>
            {(data?.solutionDetails || []).length > 0 ? (
              <div className="space-y-6">
                {data.solutionDetails!.map((p, idx) => (
                  <div key={idx} className="bg-white border border-slate-100 rounded-xl p-8">
                    <h5 className="text-sm font-bold text-slate-900 mb-4">{p.title}</h5>
                    <div className="space-y-4">
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">{t.proposalPainPointLabel}</p>
                        <p className="text-xs text-slate-600 leading-relaxed">{p.painPoint}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">{t.proposalHowItSolvesLabel}</p>
                        <p className="text-xs text-slate-600 leading-relaxed">{p.howItSolvesIt}</p>
                      </div>
                      {(p.examples || []).length > 0 && (
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">{t.proposalExamplesLabel}</p>
                          <ul className="text-xs text-slate-600 list-disc pl-5 space-y-1">
                            {p.examples.map((ex, j) => (
                              <li key={j}>{ex}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white border border-slate-100 rounded-xl p-8 text-center text-slate-400 italic text-sm">
                {t.roadmapGenerating}
              </div>
            )}
          </section>

          {/* Roadmap */}
          <section>
            <h4 className="text-[10px] font-bold text-indigo-600 uppercase tracking-[0.4em] mb-10">{t.roadmapTitle}</h4>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-px bg-slate-100 border border-slate-100 rounded-lg overflow-hidden">
              {(data?.phases || []).length > 0 ? data.phases.map((phase, idx) => (
                <div key={idx} className="bg-white p-8 space-y-4">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">{t.phaseLabel} 0{idx+1}</span>
                  <h5 className="text-sm font-bold text-slate-900 uppercase tracking-tight">{phase?.name || t.proposalUnnamedPhase}</h5>
                  <p className="text-xs text-slate-500 leading-relaxed font-medium">{phase?.description || t.proposalPendingDescription}</p>
                  <p className="text-[10px] font-bold text-indigo-600 pt-2">{t.weekLabel} {phase?.startWeek || idx+1}</p>

                  {typeof (phase as any)?.cost === 'number' && (
                    <p className="text-[10px] font-bold text-slate-700">{t.proposalPhaseCostLabel}: {(phase as any).cost.toLocaleString()}€</p>
                  )}

                  {Array.isArray((phase as any)?.deliverables) && (phase as any).deliverables.length > 0 && (
                    <div className="pt-2">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">{t.proposalIncludesLabel}</p>
                      <ul className="text-[10px] text-slate-600 list-disc pl-4 space-y-1">
                        {(phase as any).deliverables.slice(0, 4).map((d: string, j: number) => (
                          <li key={j}>{d}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )) : (
                <div className="col-span-4 bg-white p-8 text-center text-slate-400 italic text-sm">
                  {t.roadmapGenerating}
                </div>
              )}
            </div>
          </section>

          {/* Budget Analysis */}
          <section className="bg-slate-50 p-12 rounded-xl">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.4em] mb-12">{t.budgetTitle}</h4>
            <div className="space-y-4 mb-16">
              {(data?.items || []).length > 0 ? data.items.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center py-4 border-b border-slate-200/60">
                  <div>
                    <span className="text-sm font-bold text-slate-800 block">{item?.concept || t.proposalConceptFallback}</span>
                    <span className="text-[10px] text-slate-500 font-medium">{item?.description || t.proposalItemDetailsFallback}</span>
                    {typeof item?.hours === 'number' && typeof item?.hourlyRate === 'number' && (
                      <div className="mt-1 text-[10px] text-slate-500 font-bold">
                        {t.proposalHoursBreakdown
                          .replace('{hours}', String(item.hours))
                          .replace('{rate}', String(item.hourlyRate))}
                      </div>
                    )}
                  </div>
                  <span className="font-serif text-lg text-slate-900 font-bold">{(item?.price || 0).toLocaleString()}€</span>
                </div>
              )) : (
                <div className="py-4 text-center text-slate-400 italic text-sm">
                  {t.costsPending}
                </div>
              )}
            </div>

            <div className="flex flex-col md:flex-row justify-between items-end gap-10">
              <div className="text-left">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">{t.totalInvestment}</span>
                <span className="text-6xl font-serif text-slate-900 tracking-tighter">{(data?.totalInitial || 0).toLocaleString()}€</span>
              </div>
              
              <div className="bg-indigo-600 text-white p-8 rounded-xl space-y-2 min-w-[300px] shadow-xl shadow-indigo-100">
                 <p className="text-[10px] font-bold uppercase tracking-widest opacity-80">{t.nextGenBadge}</p>
                 <p className="text-4xl font-serif italic">0,00€<span className="text-sm opacity-60 ml-2 font-sans font-normal">*</span></p>
                 <p className="text-[8px] opacity-60 leading-tight pt-2 uppercase font-bold tracking-widest">{t.nextGenDisclaimer}</p>
              </div>
            </div>

            {/* Subscription */}
            <div className="mt-16 bg-white border border-slate-100 rounded-xl p-10">
              <h4 className="text-[10px] font-bold text-indigo-600 uppercase tracking-[0.4em] mb-6">{t.proposalSubscriptionTitle}</h4>
              {data?.subscription ? (
                <div className="space-y-4">
                  <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                    <div>
                      <p className="text-sm font-bold text-slate-900">{data.subscription.name}</p>
                      <p className="text-xs text-slate-500">{t.proposalSlaLabel}: {data.subscription.sla}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-3xl font-serif text-slate-900 font-bold">
                        {data.subscription.pricePerMonth.toLocaleString()}€<span className="text-xs text-slate-500 font-sans font-medium">{t.proposalPerMonth}</span>
                      </p>
                    </div>
                  </div>
                  {Array.isArray(data.subscription.includes) && data.subscription.includes.length > 0 && (
                    <ul className="text-xs text-slate-600 list-disc pl-5 space-y-1">
                      {data.subscription.includes.map((x, i) => (
                        <li key={i}>{x}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : (
                <p className="text-sm text-slate-400 italic">{t.costsPending}</p>
              )}
            </div>

            {/* Add-ons */}
            <div className="mt-10 bg-white border border-slate-100 rounded-xl p-10">
              <h4 className="text-[10px] font-bold text-indigo-600 uppercase tracking-[0.4em] mb-6">{t.proposalAddonsTitle}</h4>
              {(data?.addons || []).length > 0 ? (
                <div className="space-y-4">
                  {data.addons!.map((a, idx) => (
                    <div key={idx} className="flex flex-col md:flex-row md:items-start md:justify-between gap-6 py-4 border-b border-slate-100 last:border-b-0">
                      <div className="max-w-2xl">
                        <p className="text-sm font-bold text-slate-900">{a.name}</p>
                        <p className="text-xs text-slate-600 leading-relaxed">{a.description}</p>
                      </div>
                      <div className="text-right text-xs text-slate-700 font-bold whitespace-nowrap">
                        {typeof a.setupPrice === 'number' && (
                          <div>{t.proposalSetupLabel}: {a.setupPrice.toLocaleString()}€</div>
                        )}
                        {typeof a.pricePerMonth === 'number' && (
                          <div>{a.pricePerMonth.toLocaleString()}€{t.proposalPerMonth}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-400 italic">{t.costsPending}</p>
              )}
            </div>

            {/* Totals */}
            {data?.totals && (
              <div className="mt-10 bg-slate-900 text-white rounded-xl p-10">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest opacity-70">{t.proposalTotalsInitialLabel}</p>
                    <p className="text-2xl font-serif font-bold">{data.totals.initial.toLocaleString()}€</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest opacity-70">{t.proposalTotalsMonthlyLabel}</p>
                    <p className="text-2xl font-serif font-bold">{data.totals.recurringMonthly.toLocaleString()}€{t.proposalPerMonth}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest opacity-70">{t.proposalTotalsFirstYearLabel}</p>
                    <p className="text-2xl font-serif font-bold">{data.totals.estimatedFirstYear.toLocaleString()}€</p>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
        
        {/* Footer del Document */}
        <div className="bg-slate-50 p-12 border-t border-slate-100 flex flex-col items-center gap-6">
           <p className="text-[9px] text-slate-400 font-medium uppercase tracking-[0.2em] text-center max-w-2xl leading-relaxed">
             Adeptify Systems SLU • NIF {ADEPTIFY_INFO.nif} • {ADEPTIFY_INFO.address}<br/>
             {t.proposalFooterDisclaimer}
           </p>
           <p className="text-[9px] text-slate-500 font-medium text-center max-w-2xl leading-relaxed">
             {t.proposalGeneratedNote
               .replace('{model}', modelUsed || t.unknownModel)
               .replace('{date}', new Date().toLocaleDateString())}
           </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto flex flex-col sm:flex-row gap-4 no-print px-4">
        <button 
          onClick={downloadPDF} 
          disabled={isExporting} 
          className="flex-1 bg-slate-900 text-white py-5 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center justify-center gap-3 shadow-2xl btn-premium"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
          {isExporting ? t.exporting : t.exportPdf}
        </button>
        
        <button 
          onClick={sendByEmail}
          className="flex-1 bg-indigo-600 text-white py-5 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all flex items-center justify-center gap-3 shadow-xl"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
          {t.sendEmail}
        </button>

        <button 
          onClick={() => window.open(`https://wa.me/34690831770`, '_blank')}
          className="flex-1 bg-white border border-slate-200 text-slate-700 py-5 rounded-xl font-bold text-xs uppercase tracking-widest hover:border-slate-400 transition-all flex items-center justify-center gap-3"
        >
          <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.72.94 3.659 1.437 5.63 1.438h.004c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
          {t.contactConsultant}
        </button>
      </div>
    </div>
  );
};

export default Proposal;
