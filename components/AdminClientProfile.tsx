import React, { useEffect, useMemo, useState } from 'react';
import { Consultation, ProposalData, CenterArtifact, CenterReport } from '../types';
import { useLanguage } from '../LanguageContext';
import { centerInsightsService, normalizeCenterKey } from '../services/centerInsightsService';
import { centerArtifactsService } from '../services/centerArtifactsService';
import { consultationService } from '../services/consultationService';
import { generateCenterDAFO, generateCenterCustomProposal, generateCenterReport, DafoResult } from '../services/geminiService';
import { downloadCenterReportPdf, downloadDafoPdf } from '../services/pdfExport';

type AnswerCountRow = { label: string; count: number };
type QuestionDistributionRow = { question: string; total: number; top: AnswerCountRow[] };
type RespondentRow = {
  name: string;
  email: string;
  submissions: number;
  lastDate: string;
  avgAnsweredPerSubmission: number;
};

type Props = {
  tenantSlug?: string;
  centerName: string;
  consultations: Consultation[];
};

const AdminClientProfile: React.FC<Props> = ({ tenantSlug, centerName, consultations }) => {
  const { t, language } = useLanguage();
  const centerKey = useMemo(() => normalizeCenterKey(centerName), [centerName]);

  const labels = useMemo(() => {
    return {
      dashboardTitle: language === 'ca' ? "Mini dashboard (abans del pressupost)" : 'Mini dashboard (antes del presupuesto)',
      metricsTitle: language === 'ca' ? 'Mètriques de rendiment' : 'Métricas de rendimiento',
      metricRespondents: language === 'ca' ? 'Respondents únics' : 'Respondientes únicos',
      metricSubmissions: language === 'ca' ? 'Auditories totals' : 'Auditorías totales',
      metricAvgAnswered: language === 'ca' ? 'Mitjana respostes' : 'Media respuestas',
      metricLastActivity: language === 'ca' ? 'Última activitat' : 'Última actividad',
      respondentsTitle: language === 'ca' ? 'Qui ha respost' : 'Quién ha respondido',
      respondentName: language === 'ca' ? 'Nom' : 'Nombre',
      respondentEmail: language === 'ca' ? 'Email' : 'Email',
      respondentSubmissions: language === 'ca' ? 'Enviaments' : 'Envíos',
      respondentLast: language === 'ca' ? 'Última data' : 'Última fecha',
      respondentAvg: language === 'ca' ? 'Mitjana (respostes)' : 'Media (respuestas)',
      distributionTitle: language === 'ca' ? 'Taula classificada (categories de respostes)' : 'Tabla clasificada (categorías de respuestas)',
      distributionQuestion: language === 'ca' ? 'Pregunta' : 'Pregunta',
      distributionTop: language === 'ca' ? 'Top respostes' : 'Top respuestas',
      distributionTotal: language === 'ca' ? 'Total' : 'Total',
      latestAnswersTitle: language === 'ca' ? 'Últimes respostes (qui i què)' : 'Últimas respuestas (quién y qué)',
      noData: language === 'ca' ? 'Encara no hi ha dades.' : 'Aún no hay datos.',
    };
  }, [language]);

  const [artifacts, setArtifacts] = useState<CenterArtifact[]>([]);
  const [latestDafo, setLatestDafo] = useState<DafoResult | null>(null);
  const [latestCustomProposal, setLatestCustomProposal] = useState<ProposalData | null>(null);
  const [latestReport, setLatestReport] = useState<CenterReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const histories = useMemo(() => {
    return consultations
      .filter(c => normalizeCenterKey(c.centerName) === centerKey)
      .map(c => c.consultationHistory || []);
  }, [consultations, centerKey]);

  const centerConsultations = useMemo(() => {
    return consultations.filter(c => normalizeCenterKey(c.centerName) === centerKey);
  }, [consultations, centerKey]);

  const dashboard = useMemo(() => {
    const byRespondent = new Map<string, {
      name: string;
      email: string;
      submissions: number;
      lastDate: string;
      totalAnswered: number;
    }>();

    const questionCounts = new Map<string, Map<string, { count: number; label: string }>>();
    let totalAnswered = 0;
    let submissionCount = 0;
    let lastActivity = '';

    const normalizeAnswerKey = (value: string) => value.trim().toLowerCase();

    for (const c of centerConsultations) {
      submissionCount += 1;

      const dateIso = c.date || '';
      if (!lastActivity || (dateIso && new Date(dateIso).getTime() > new Date(lastActivity).getTime())) {
        lastActivity = dateIso;
      }

      const email = (c.contactEmail || '').trim();
      const name = (c.contactName || '').trim();
      const respondentKey = email || name || 'unknown';
      const current = byRespondent.get(respondentKey) ?? {
        name: name || (language === 'ca' ? 'Sense nom' : 'Sin nombre'),
        email: email || '-',
        submissions: 0,
        lastDate: '',
        totalAnswered: 0,
      };

      current.submissions += 1;
      if (!current.lastDate || (dateIso && new Date(dateIso).getTime() > new Date(current.lastDate).getTime())) {
        current.lastDate = dateIso;
      }

      const history = Array.isArray(c.consultationHistory) ? c.consultationHistory : [];
      let answeredThisSubmission = 0;
      for (const h of history) {
        const q = (h?.question || '').trim();
        const answers = Array.isArray(h?.answer) ? h.answer : [];
        const nonEmptyAnswers = answers.map(a => (a ?? '').toString().trim()).filter(Boolean);
        if (!q || nonEmptyAnswers.length === 0) continue;

        answeredThisSubmission += nonEmptyAnswers.length;

        const answerMap = questionCounts.get(q) ?? new Map<string, { count: number; label: string }>();
        for (const a of nonEmptyAnswers) {
          const k = normalizeAnswerKey(a);
          const prev = answerMap.get(k);
          if (prev) prev.count += 1;
          else answerMap.set(k, { count: 1, label: a });
        }
        questionCounts.set(q, answerMap);
      }

      current.totalAnswered += answeredThisSubmission;
      totalAnswered += answeredThisSubmission;
      byRespondent.set(respondentKey, current);
    }

    const respondents: RespondentRow[] = Array.from(byRespondent.values())
      .map(r => ({
        name: r.name,
        email: r.email,
        submissions: r.submissions,
        lastDate: r.lastDate,
        avgAnsweredPerSubmission: r.submissions > 0 ? Math.round((r.totalAnswered / r.submissions) * 10) / 10 : 0,
      }))
      .sort((a, b) => {
        const ad = a.lastDate ? new Date(a.lastDate).getTime() : 0;
        const bd = b.lastDate ? new Date(b.lastDate).getTime() : 0;
        return bd - ad;
      });

    const distributions: QuestionDistributionRow[] = Array.from(questionCounts.entries())
      .map(([question, answersMap]) => {
        const rows = Array.from(answersMap.values()).sort((a, b) => b.count - a.count);
        const total = rows.reduce((acc, x) => acc + x.count, 0);
        return {
          question,
          total,
          top: rows.slice(0, 6).map(x => ({ label: x.label, count: x.count })),
        };
      })
      .sort((a, b) => b.total - a.total);

    const avgAnswered = submissionCount > 0 ? Math.round((totalAnswered / submissionCount) * 10) / 10 : 0;

    return {
      respondents,
      distributions,
      submissions: submissionCount,
      uniqueRespondents: respondents.length,
      avgAnswered,
      lastActivity,
    };
  }, [centerConsultations, language]);

  const centerIdForChat = useMemo(() => {
    // Chats are stored using the tenant-prefixed center id.
    return tenantSlug ? `${tenantSlug}::${centerName}` : centerName;
  }, [tenantSlug, centerName]);

  const [chatMessagesCount, setChatMessagesCount] = useState<number>(0);

  const refresh = async () => {
    setError(null);
    try {
      const [insights, list, chat] = await Promise.all([
        centerInsightsService.get(centerName, tenantSlug),
        centerArtifactsService.listForCenter(centerName, tenantSlug),
        consultationService.getChatHistory(centerIdForChat),
      ]);

      setLatestDafo((insights as any)?.dafo ?? null);
      setLatestCustomProposal((insights as any)?.customProposal ?? null);
      setArtifacts(list);
      setChatMessagesCount(chat.length);

      // Best-effort: pick most recent report from artifacts.
      const newestReport = list.find(a => a.artifactType === 'report');
      setLatestReport((newestReport?.payload as CenterReport) ?? null);
    } catch (e: any) {
      setError(typeof e?.message === 'string' ? e.message : String(e));
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centerKey, tenantSlug]);

  const onGenerateDafo = async () => {
    setLoading(true);
    setError(null);
    try {
      const dafo = await generateCenterDAFO(centerName, histories, language);
      await centerInsightsService.upsertDafo(centerName, dafo, tenantSlug);
      await centerArtifactsService.addArtifact(centerName, 'dafo', dafo, tenantSlug);
      setLatestDafo(dafo);
      await refresh();
    } catch (e: any) {
      setError(typeof e?.message === 'string' ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const onGenerateCustomProposal = async () => {
    setLoading(true);
    setError(null);
    try {
      let dafo = latestDafo;
      if (!dafo) {
        dafo = await generateCenterDAFO(centerName, histories, language);
        await centerInsightsService.upsertDafo(centerName, dafo, tenantSlug);
        await centerArtifactsService.addArtifact(centerName, 'dafo', dafo, tenantSlug);
        setLatestDafo(dafo);
      }
      const proposal = await generateCenterCustomProposal(centerName, histories, dafo, language);
      await centerInsightsService.upsertCustomProposal(centerName, proposal, tenantSlug);
      await centerArtifactsService.addArtifact(centerName, 'custom_proposal', proposal, tenantSlug);
      setLatestCustomProposal(proposal);
      await refresh();
    } catch (e: any) {
      setError(typeof e?.message === 'string' ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const onGenerateReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const report = await generateCenterReport(centerName, histories, language);
      await centerArtifactsService.addArtifact(centerName, 'report', report, tenantSlug);
      setLatestReport(report);
      await refresh();
    } catch (e: any) {
      setError(typeof e?.message === 'string' ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-2xl max-h-[70vh] flex flex-col overflow-hidden">
      <div className="p-10 pb-8 border-b border-slate-50 shrink-0">
        <div className="flex justify-between items-start gap-6">
          <div className="min-w-0">
            <h3 className="text-3xl font-black text-slate-900 mb-1 truncate">{centerName}</h3>
            <p className="text-indigo-600 font-bold uppercase text-[10px] tracking-[0.3em] truncate">{centerKey}</p>
          </div>
          <div className="bg-slate-50 px-4 py-2 rounded-xl text-center">
            <p className="text-[8px] font-black text-slate-400 uppercase mb-1">{t.adminCentersInAudit}</p>
            <p className="font-serif italic font-bold text-slate-900">{centerConsultations.length}</p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onGenerateDafo}
            disabled={loading}
            className="px-4 py-3 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-600 transition-all disabled:opacity-60"
          >
            {loading ? t.adminGeneratingDafo : t.adminGenerateDafo}
          </button>
          <button
            type="button"
            onClick={onGenerateReport}
            disabled={loading}
            className="px-4 py-3 bg-white border border-slate-200 text-slate-700 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:border-indigo-200 hover:text-indigo-700 transition-all disabled:opacity-60"
          >
            {language === 'ca' ? 'Generar informe' : 'Generar informe'}
          </button>
          <button
            type="button"
            onClick={onGenerateCustomProposal}
            disabled={loading}
            className="px-4 py-3 bg-white border border-slate-200 text-slate-700 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:border-indigo-200 hover:text-indigo-700 transition-all disabled:opacity-60"
          >
            {language === 'ca' ? 'Generar proposta a mida' : 'Generar propuesta a medida'}
          </button>

          <div className="ml-auto bg-slate-50 px-4 py-3 rounded-2xl">
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{language === 'ca' ? 'Xat' : 'Chat'}</p>
            <p className="text-[10px] font-black text-slate-700">{chatMessagesCount} {language === 'ca' ? 'missatges' : 'mensajes'}</p>
          </div>
        </div>

        {error && <p className="mt-4 text-[10px] text-red-600 font-bold">{error}</p>}
      </div>

      <div className="flex-1 overflow-y-auto p-10 space-y-10 custom-scrollbar">
        <div className="bg-slate-50 rounded-[2rem] p-8 border border-slate-100">
          <div className="flex items-center justify-between gap-4 mb-6">
            <div>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{labels.dashboardTitle}</p>
              <p className="text-[9px] text-slate-400 font-bold uppercase mt-1 tracking-widest">{labels.metricsTitle}</p>
            </div>
          </div>

          {dashboard.submissions === 0 ? (
            <p className="text-[10px] text-slate-400 font-bold italic">{labels.noData}</p>
          ) : (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white border border-slate-100 rounded-2xl p-4">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">{labels.metricRespondents}</p>
                  <p className="text-[14px] font-black text-slate-900">{dashboard.uniqueRespondents}</p>
                </div>
                <div className="bg-white border border-slate-100 rounded-2xl p-4">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">{labels.metricSubmissions}</p>
                  <p className="text-[14px] font-black text-slate-900">{dashboard.submissions}</p>
                </div>
                <div className="bg-white border border-slate-100 rounded-2xl p-4">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">{labels.metricAvgAnswered}</p>
                  <p className="text-[14px] font-black text-slate-900">{dashboard.avgAnswered}</p>
                </div>
                <div className="bg-white border border-slate-100 rounded-2xl p-4">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">{labels.metricLastActivity}</p>
                  <p className="text-[14px] font-black text-slate-900">
                    {dashboard.lastActivity ? new Date(dashboard.lastActivity).toLocaleDateString() : '-'}
                  </p>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white border border-slate-100 rounded-2xl p-6 overflow-hidden">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">{labels.respondentsTitle}</p>
                  <div className="max-h-[260px] overflow-y-auto custom-scrollbar pr-2">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="text-[9px] text-slate-400 uppercase tracking-widest font-black">
                          <th className="py-2">{labels.respondentName}</th>
                          <th className="py-2">{labels.respondentEmail}</th>
                          <th className="py-2 text-right">{labels.respondentSubmissions}</th>
                          <th className="py-2 text-right">{labels.respondentAvg}</th>
                          <th className="py-2 text-right">{labels.respondentLast}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dashboard.respondents.map((r, idx) => (
                          <tr key={idx} className="border-t border-slate-100 text-[10px] text-slate-700">
                            <td className="py-2 font-bold max-w-[160px] truncate">{r.name}</td>
                            <td className="py-2 max-w-[180px] truncate">{r.email}</td>
                            <td className="py-2 text-right font-black">{r.submissions}</td>
                            <td className="py-2 text-right font-black">{r.avgAnsweredPerSubmission}</td>
                            <td className="py-2 text-right">{r.lastDate ? new Date(r.lastDate).toLocaleDateString() : '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="bg-white border border-slate-100 rounded-2xl p-6 overflow-hidden">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">{labels.distributionTitle}</p>
                  <div className="max-h-[260px] overflow-y-auto custom-scrollbar pr-2">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="text-[9px] text-slate-400 uppercase tracking-widest font-black">
                          <th className="py-2">{labels.distributionQuestion}</th>
                          <th className="py-2">{labels.distributionTop}</th>
                          <th className="py-2 text-right">{labels.distributionTotal}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dashboard.distributions.slice(0, 30).map((d, idx) => (
                          <tr key={idx} className="border-t border-slate-100 text-[10px] text-slate-700 align-top">
                            <td className="py-2 font-bold max-w-[220px] truncate">{d.question}</td>
                            <td className="py-2">
                              <div className="space-y-1">
                                {d.top.map((a, j) => (
                                  <div key={j} className="flex items-start justify-between gap-3">
                                    <span className="min-w-0 truncate">{a.label}</span>
                                    <span className="shrink-0 font-black text-slate-600">{a.count}</span>
                                  </div>
                                ))}
                              </div>
                            </td>
                            <td className="py-2 text-right font-black">{d.total}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="mt-6 bg-white border border-slate-100 rounded-2xl p-6">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">{labels.latestAnswersTitle}</p>
                <div className="max-h-[260px] overflow-y-auto custom-scrollbar pr-2 space-y-3">
                  {centerConsultations
                    .slice()
                    .sort((a, b) => (new Date(b.date).getTime() || 0) - (new Date(a.date).getTime() || 0))
                    .slice(0, 12)
                    .map(c => (
                      <div key={c.id} className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
                        <div className="flex items-start justify-between gap-4 mb-2">
                          <div className="min-w-0">
                            <p className="text-[10px] font-black text-slate-900 truncate">{(c.contactName || (language === 'ca' ? 'Sense nom' : 'Sin nombre'))}</p>
                            <p className="text-[9px] font-bold text-slate-400 truncate">{c.contactEmail || '-'}</p>
                          </div>
                          <p className="text-[9px] font-bold text-slate-400 whitespace-nowrap">{c.date ? new Date(c.date).toLocaleDateString() : ''}</p>
                        </div>
                        <div className="space-y-2">
                          {(c.consultationHistory || []).slice(0, 5).map((h, idx) => (
                            <div key={idx} className="text-[10px]">
                              <p className="font-black text-slate-600 truncate">{h.question}</p>
                              <p className="text-slate-600 font-medium break-words">{Array.isArray(h.answer) ? h.answer.filter(Boolean).join(' · ') : ''}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-slate-50 rounded-[2rem] p-8 border border-slate-100">
            <div className="flex items-center justify-between gap-4 mb-4">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{language === 'ca' ? 'DAFO (última versió)' : 'DAFO (última versión)'}</p>
              <button
                type="button"
                onClick={() => latestDafo && downloadDafoPdf(centerName, latestDafo, language)}
                disabled={!latestDafo}
                className="text-[9px] font-black uppercase tracking-widest px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:border-indigo-200 hover:text-indigo-700 transition-all disabled:opacity-60"
              >
                {language === 'ca' ? 'Descarregar PDF' : 'Descargar PDF'}
              </button>
            </div>
            {latestDafo ? (
              <p className="text-[10px] text-slate-600 font-medium leading-relaxed break-words">{latestDafo.summary}</p>
            ) : (
              <p className="text-[10px] text-slate-400 font-bold italic">{language === 'ca' ? 'Encara no hi ha DAFO generat.' : 'Aún no hay DAFO generado.'}</p>
            )}
          </div>

          <div className="bg-slate-50 rounded-[2rem] p-8 border border-slate-100">
            <div className="flex items-center justify-between gap-4 mb-4">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{language === 'ca' ? 'Informe (última versió)' : 'Informe (última versión)'}</p>
              <button
                type="button"
                onClick={() => latestReport && downloadCenterReportPdf(centerName, latestReport, language)}
                disabled={!latestReport}
                className="text-[9px] font-black uppercase tracking-widest px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:border-indigo-200 hover:text-indigo-700 transition-all disabled:opacity-60"
              >
                {language === 'ca' ? 'Descarregar PDF' : 'Descargar PDF'}
              </button>
            </div>
            {latestReport ? (
              <p className="text-[10px] text-slate-600 font-medium leading-relaxed break-words">{latestReport.executiveSummary}</p>
            ) : (
              <p className="text-[10px] text-slate-400 font-bold italic">{language === 'ca' ? 'Encara no hi ha informe generat.' : 'Aún no hay informe generado.'}</p>
            )}
          </div>
        </div>

        <div className="bg-white border border-slate-100 rounded-[2rem] p-8">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">{language === 'ca' ? 'Històric (DAFO / Informe / Proposta)' : 'Histórico (DAFO / Informe / Propuesta)'}</p>
          {artifacts.length ? (
            <div className="space-y-3">
              {artifacts.slice(0, 30).map(a => (
                <div key={a.id} className="flex items-center justify-between gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="min-w-0">
                    <p className="text-[10px] font-black text-slate-800 uppercase truncate">
                      {a.artifactType === 'dafo'
                        ? (language === 'ca' ? 'DAFO' : 'DAFO')
                        : a.artifactType === 'report'
                          ? (language === 'ca' ? 'Informe' : 'Informe')
                          : (language === 'ca' ? 'Proposta a mida' : 'Propuesta a medida')}
                    </p>
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">
                      {new Date(a.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {a.artifactType === 'dafo' && (
                      <button
                        type="button"
                        onClick={() => downloadDafoPdf(centerName, a.payload as DafoResult, language)}
                        className="text-[9px] font-black uppercase tracking-widest px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:border-indigo-200 hover:text-indigo-700 transition-all"
                      >
                        PDF
                      </button>
                    )}
                    {a.artifactType === 'report' && (
                      <button
                        type="button"
                        onClick={() => downloadCenterReportPdf(centerName, a.payload as CenterReport, language)}
                        className="text-[9px] font-black uppercase tracking-widest px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:border-indigo-200 hover:text-indigo-700 transition-all"
                      >
                        PDF
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[10px] text-slate-400 font-bold italic">{language === 'ca' ? 'Encara no hi ha històric.' : 'Aún no hay histórico.'}</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminClientProfile;
