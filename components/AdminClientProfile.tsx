import React, { useEffect, useMemo, useState } from 'react';
import { Consultation, ProposalData, CenterArtifact, CenterReport } from '../types';
import { useLanguage } from '../LanguageContext';
import { centerInsightsService, normalizeCenterKey } from '../services/centerInsightsService';
import { centerArtifactsService } from '../services/centerArtifactsService';
import { consultationService } from '../services/consultationService';
import { generateCenterDAFO, generateCenterCustomProposal, generateCenterReport, DafoResult } from '../services/geminiService';
import { downloadCenterReportPdf, downloadCustomProposalPdf, downloadDafoPdf } from '../services/pdfExport';

type Props = {
  tenantSlug?: string;
  centerName: string;
  consultations: Consultation[];
};

const AdminClientProfile: React.FC<Props> = ({ tenantSlug, centerName, consultations }) => {
  const { t, language } = useLanguage() as { t: any, language: any };
  const centerKey = useMemo(() => normalizeCenterKey(centerName), [centerName]);

  const [artifacts, setArtifacts] = useState<CenterArtifact[]>([]);
  const [latestDafo, setLatestDafo] = useState<DafoResult | null>(null);
  const [latestCustomProposal, setLatestCustomProposal] = useState<ProposalData | null>(null);
  const [latestReport, setLatestReport] = useState<CenterReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chatMessagesCount, setChatMessagesCount] = useState<number>(0);

  const centerConsultations = useMemo(() => {
    return consultations.filter(c => normalizeCenterKey(c.centerName) === centerKey);
  }, [consultations, centerKey]);

  const histories = useMemo(() => {
    return centerConsultations.map(c => c.consultationHistory || []);
  }, [centerConsultations]);

  const metrics = useMemo(() => {
    let totalAnswered = 0;
    let lastDate = '';
    const respondents = new Set<string>();

    for (const c of centerConsultations) {
      if (!lastDate || (c.date && new Date(c.date) > new Date(lastDate))) lastDate = c.date || '';
      respondents.add(c.contactEmail || c.contactName || 'unknown');

      const history = Array.isArray(c.consultationHistory) ? c.consultationHistory : [];
      for (const h of history) {
        if (Array.isArray(h.answer) && h.answer.filter(Boolean).length > 0) {
          totalAnswered += 1;
        }
      }
    }

    return {
      submissions: centerConsultations.length,
      respondents: respondents.size,
      avgAnswered: centerConsultations.length > 0 ? Math.round(totalAnswered / centerConsultations.length) : 0,
      lastActivity: lastDate
    };
  }, [centerConsultations]);

  const refresh = async () => {
    try {
      const centerIdForChat = tenantSlug ? `${tenantSlug}::${centerName}` : centerName;
      const [insights, list, chat] = await Promise.all([
        centerInsightsService.get(centerName, tenantSlug),
        centerArtifactsService.listForCenter(centerName, tenantSlug),
        consultationService.getChatHistory(centerIdForChat),
      ]);

      setLatestDafo((insights as any)?.dafo ?? null);
      setLatestCustomProposal((insights as any)?.customProposal ?? null);
      setArtifacts(list);
      setChatMessagesCount(chat.length);

      const newestReport = list.find(a => a.artifactType === 'report');
      setLatestReport((newestReport?.payload as CenterReport) ?? null);
    } catch (e: any) {
      setError(e.message || 'Error refresh');
    }
  };

  useEffect(() => {
    refresh();
  }, [centerKey, tenantSlug]);

  const onGenerate = async (type: 'dafo' | 'report' | 'proposal') => {
    setLoading(true);
    setError(null);
    try {
      if (type === 'dafo') {
        const dafo = await generateCenterDAFO(centerName, histories, language);
        await centerInsightsService.upsertDafo(centerName, dafo, tenantSlug);
        await centerArtifactsService.addArtifact(centerName, 'dafo', dafo, tenantSlug);
      } else if (type === 'report') {
        const report = await generateCenterReport(centerName, histories, language);
        await centerArtifactsService.addArtifact(centerName, 'report', report, tenantSlug);
      } else {
        let dafo = latestDafo;
        if (!dafo) {
          dafo = await generateCenterDAFO(centerName, histories, language);
          await centerInsightsService.upsertDafo(centerName, dafo, tenantSlug);
          await centerArtifactsService.addArtifact(centerName, 'dafo', dafo, tenantSlug);
        }
        const proposal = await generateCenterCustomProposal(centerName, histories, dafo, language);
        await centerInsightsService.upsertCustomProposal(centerName, proposal, tenantSlug);
        await centerArtifactsService.addArtifact(centerName, 'custom_proposal', proposal, tenantSlug);
      }
      await refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-slate-50/50">
      {/* Header Premium */}
      <div className="bg-white/80 backdrop-blur-md border-b border-slate-100 p-8 sticky top-0 z-10 shrink-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
            <h3 className="text-4xl font-black text-slate-900 tracking-tight">{centerName}</h3>
            <div className="flex items-center gap-3">
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-600 font-bold text-[10px] uppercase tracking-widest border border-indigo-100">
                {centerKey}
              </span>
              <div className="flex items-center gap-1.5 grayscale brightness-125">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  {language === 'ca' ? 'Sincronitzat' : 'Sincronizado'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => onGenerate('dafo')}
              disabled={loading}
              className="px-5 py-2.5 bg-slate-900 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-lg hover:shadow-indigo-200/50 disabled:opacity-50"
            >
              {loading ? '...' : (language === 'ca' ? 'DAFO' : 'DAFO')}
            </button>
            <button
              onClick={() => onGenerate('report')}
              disabled={loading}
              className="px-5 py-2.5 bg-white border-2 border-slate-900 text-slate-900 rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-slate-50 transition-all disabled:opacity-50"
            >
              {loading ? '...' : (language === 'ca' ? 'Informe' : 'Informe')}
            </button>
            <button
              onClick={() => onGenerate('proposal')}
              disabled={loading}
              className="px-5 py-2.5 bg-indigo-600 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg hover:shadow-indigo-200/50 disabled:opacity-50"
            >
              {loading ? '...' : (language === 'ca' ? 'Proposta' : 'Propuesta')}
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-8">
        {error && (
          <div className="bg-red-50 border border-red-100 p-4 rounded-2xl text-[11px] text-red-600 font-bold flex items-center gap-3">
            <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
            {error}
          </div>
        )}

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: language === 'ca' ? 'Respondents' : 'Respondientes', val: metrics.respondents, icon: '👤' },
            { label: language === 'ca' ? 'Submissions' : 'Submisiones', val: metrics.submissions, icon: '📝' },
            { label: language === 'ca' ? 'Mitjana Respostes' : 'Media Respuestas', val: metrics.avgAnswered, icon: '📊' },
            { label: language === 'ca' ? 'Missatges Xat' : 'Mensajes Chat', val: chatMessagesCount, icon: '💬' },
          ].map((m, i) => (
            <div key={i} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-md transition-all group">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-lg grayscale group-hover:grayscale-0 transition-all">
                  {m.icon}
                </div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{m.label}</span>
              </div>
              <div className="text-3xl font-black text-slate-900">{m.val}</div>
            </div>
          ))}
        </div>

        {/* Latest Documents Vision */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.2em]">{language === 'ca' ? 'Últims Documents Generats' : 'Últimos Documentos Generados'}</h4>
            {metrics.lastActivity && (
              <span className="text-[10px] font-bold text-slate-400">
                {language === 'ca' ? 'Última activitat: ' : 'Última actividad: '}
                {new Date(metrics.lastActivity).toLocaleDateString()}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* DAFO Card */}
            <div className={`p-8 rounded-[2.5rem] border-2 transition-all ${latestDafo ? 'bg-white border-slate-100' : 'bg-slate-50 border-dashed border-slate-200 opacity-60'}`}>
              <div className="flex items-center justify-between mb-6">
                <h5 className="font-black text-slate-900 uppercase text-[12px] tracking-widest">DAFO</h5>
                {latestDafo && (
                  <button onClick={() => downloadDafoPdf(centerName, latestDafo, language)} className="text-[10px] font-black text-indigo-600 hover:text-indigo-700 uppercase tracking-widest">PDF ↓</button>
                )}
              </div>
              {latestDafo ? (
                <p className="text-[12px] text-slate-600 leading-relaxed line-clamp-4">{latestDafo.summary}</p>
              ) : (
                <div className="h-24 flex items-center justify-center text-[10px] font-bold text-slate-400 uppercase tracking-widest italic">{language === 'ca' ? 'Sense dades' : 'Sin datos'}</div>
              )}
            </div>

            {/* Informe Card */}
            <div className={`p-8 rounded-[2.5rem] border-2 transition-all ${latestReport ? 'bg-white border-slate-100' : 'bg-slate-50 border-dashed border-slate-200 opacity-60'}`}>
              <div className="flex items-center justify-between mb-6">
                <h5 className="font-black text-slate-900 uppercase text-[12px] tracking-widest">{language === 'ca' ? 'Informe' : 'Informe'}</h5>
                {latestReport && (
                  <button onClick={() => downloadCenterReportPdf(centerName, latestReport, language)} className="text-[10px] font-black text-indigo-600 hover:text-indigo-700 uppercase tracking-widest">PDF ↓</button>
                )}
              </div>
              {latestReport ? (
                <p className="text-[12px] text-slate-600 leading-relaxed line-clamp-4">{latestReport.executiveSummary}</p>
              ) : (
                <div className="h-24 flex items-center justify-center text-[10px] font-bold text-slate-400 uppercase tracking-widest italic">{language === 'ca' ? 'Sense dades' : 'Sin datos'}</div>
              )}
            </div>

            {/* Proposta Card */}
            <div className={`p-8 rounded-[2.5rem] border-2 transition-all ${latestCustomProposal ? 'bg-white border-slate-100' : 'bg-slate-50 border-dashed border-slate-200 opacity-60'}`}>
              <div className="flex items-center justify-between mb-6">
                <h5 className="font-black text-slate-900 uppercase text-[12px] tracking-widest">{language === 'ca' ? 'Proposta' : 'Propuesta'}</h5>
                {latestCustomProposal && (
                  <button onClick={() => downloadCustomProposalPdf(centerName, latestCustomProposal, language)} className="text-[10px] font-black text-indigo-600 hover:text-indigo-700 uppercase tracking-widest">PDF ↓</button>
                )}
              </div>
              {latestCustomProposal ? (
                <div className="space-y-2">
                  <p className="text-[12px] text-slate-600 leading-relaxed line-clamp-3">{latestCustomProposal.solution}</p>
                  <div className="pt-2 border-t border-slate-50 flex items-center justify-between">
                    <span className="text-[10px] font-black text-slate-400 uppercase">{language === 'ca' ? 'Inversió' : 'Inversión'}</span>
                    <span className="text-[12px] font-black text-slate-900">{Math.round(latestCustomProposal.totalInitial || 0).toLocaleString()}€</span>
                  </div>
                </div>
              ) : (
                <div className="h-24 flex items-center justify-center text-[10px] font-bold text-slate-400 uppercase tracking-widest italic">{language === 'ca' ? 'Sense dades' : 'Sin datos'}</div>
              )}
            </div>
          </div>
        </div>

        {/* History Table Optimized */}
        <div className="bg-white rounded-[2.5rem] border border-slate-100 overflow-hidden">
          <div className="p-8 border-b border-slate-50 flex items-center justify-between">
            <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.2em]">{language === 'ca' ? 'Històric d\'Arxius' : 'Histórico de Archivos'}</h4>
            <span className="text-[10px] font-black text-slate-400 bg-slate-50 px-3 py-1 rounded-full">{artifacts.length} {language === 'ca' ? 'ítems' : 'ítems'}</span>
          </div>
          <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  <th className="px-8 py-4">{language === 'ca' ? 'Tipus' : 'Tipo'}</th>
                  <th className="px-8 py-4">{language === 'ca' ? 'Data' : 'Fecha'}</th>
                  <th className="px-8 py-4 text-right">{language === 'ca' ? 'Acció' : 'Acción'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {artifacts.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50/80 transition-all group">
                    <td className="px-8 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-indigo-500" />
                        <span className="text-[11px] font-black text-slate-700 uppercase">
                          {a.artifactType === 'dafo' ? 'DAFO' : a.artifactType === 'report' ? (language === 'ca' ? 'Informe' : 'Informe') : (language === 'ca' ? 'Proposta' : 'Propuesta')}
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-4 text-[11px] font-bold text-slate-400 uppercase">
                      {new Date(a.createdAt).toLocaleString()}
                    </td>
                    <td className="px-8 py-4 text-right">
                      <button
                        onClick={() => {
                          if (a.artifactType === 'dafo') downloadDafoPdf(centerName, a.payload, language);
                          else if (a.artifactType === 'report') downloadCenterReportPdf(centerName, a.payload, language);
                          else downloadCustomProposalPdf(centerName, a.payload, language);
                        }}
                        className="px-4 py-1.5 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-all"
                      >
                        {language === 'ca' ? 'Descarregar' : 'Descargar'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {artifacts.length === 0 && (
              <div className="p-12 text-center text-[11px] font-bold text-slate-400 italic uppercase tracking-widest">
                {language === 'ca' ? 'Encara no hi ha històric' : 'Aún no hay histórico'}
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
      `}</style>
    </div>
  );
};

export default AdminClientProfile;
