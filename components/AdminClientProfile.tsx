import React, { useEffect, useMemo, useState } from 'react';
import { Consultation, ProposalData, CenterArtifact, CenterReport } from '../types';
import { useLanguage } from '../LanguageContext';
import { centerInsightsService, normalizeCenterKey } from '../services/centerInsightsService';
import { centerArtifactsService } from '../services/centerArtifactsService';
import { consultationService } from '../services/consultationService';
import { generateCenterDAFO, generateCenterCustomProposal, generateCenterReport, DafoResult } from '../services/geminiService';
import { downloadCenterReportPdf, downloadDafoPdf } from '../services/pdfExport';

type Props = {
  tenantSlug?: string;
  centerName: string;
  consultations: Consultation[];
};

const AdminClientProfile: React.FC<Props> = ({ tenantSlug, centerName, consultations }) => {
  const { t, language } = useLanguage();
  const centerKey = useMemo(() => normalizeCenterKey(centerName), [centerName]);

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
