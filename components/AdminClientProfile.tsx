import React, { useEffect, useMemo, useState } from 'react';
import { Consultation, ProposalData, CenterArtifact, CenterReport } from '../types';
import { useLanguage } from '../LanguageContext';
import { centerInsightsService, normalizeCenterKey } from '../services/centerInsightsService';
import { centerArtifactsService } from '../services/centerArtifactsService';
import { consultationService } from '../services/consultationService';
import { unifiedClientService, ClientDetail, LeadInteraction, CrmNote } from '../services/unifiedClientService';
import { generateCenterDAFO, generateCenterCustomProposal, generateCenterReport, DafoResult } from '../services/geminiService';
import { downloadCenterReportPdf, downloadCustomProposalPdf, downloadDafoPdf } from '../services/pdfExport';
import { supabase } from '../services/supabaseClient';

type Props = {
  tenantSlug?: string;
  centerName: string;
  leadId?: string;
  codiCentre?: string;
  consultations: Consultation[];
};

type ProfileTab = 'overview' | 'crm' | 'history';

const AdminClientProfile: React.FC<Props> = ({ tenantSlug, centerName, leadId, codiCentre, consultations }) => {
  const { t, language } = useLanguage() as { t: any, language: any };
  const centerKey = useMemo(() => normalizeCenterKey(centerName), [centerName]);

  const [artifacts, setArtifacts] = useState<CenterArtifact[]>([]);
  const [latestDafo, setLatestDafo] = useState<DafoResult | null>(null);
  const [latestCustomProposal, setLatestCustomProposal] = useState<ProposalData | null>(null);
  const [latestReport, setLatestReport] = useState<CenterReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chatMessagesCount, setChatMessagesCount] = useState<number>(0);

  // CRM / Lead state
  const [profileTab, setProfileTab] = useState<ProfileTab>('overview');
  const [clientDetail, setClientDetail] = useState<ClientDetail | null>(null);
  const [newNote, setNewNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

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

  // Load CRM detail when leadId is provided
  useEffect(() => {
    if (leadId) {
      unifiedClientService.fetchClientDetail(leadId).then(detail => {
        setClientDetail(detail);
      });
    }
  }, [leadId]);

  const handleAddNote = async () => {
    if (!leadId || !newNote.trim() || !supabase) return;
    setSavingNote(true);
    try {
      await supabase.from('crm_notes').insert({
        lead_id: leadId,
        content: newNote.trim(),
        created_by: 'admin',
      });
      await supabase.from('lead_interactions').insert({
        lead_id: leadId,
        interaction_type: 'note',
        content_summary: newNote.trim(),
      });
      setNewNote('');
      // Refresh detail
      const detail = await unifiedClientService.fetchClientDetail(leadId);
      setClientDetail(detail);
    } catch (e) {
      console.error('Error saving note:', e);
    } finally {
      setSavingNote(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!leadId || !supabase) return;
    setUpdatingStatus(true);
    try {
      await supabase.from('leads').update({ status: newStatus }).eq('id', leadId);
      const detail = await unifiedClientService.fetchClientDetail(leadId);
      setClientDetail(detail);
    } catch (e) {
      console.error('Error updating status:', e);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const interactionTypeLabels: Record<string, string> = {
    email_sent: language === 'ca' ? 'Email enviat' : 'Email enviado',
    ai_analysis: language === 'ca' ? 'Anàlisi IA' : 'Análisis IA',
    proposal_generated: language === 'ca' ? 'Proposta generada' : 'Propuesta generada',
    meeting: language === 'ca' ? 'Reunió' : 'Reunión',
    bulk_email: language === 'ca' ? 'Email massiu' : 'Email masivo',
    note: language === 'ca' ? 'Nota' : 'Nota',
    opened: language === 'ca' ? 'Email obert' : 'Email abierto',
  };

  const interactionTypeColors: Record<string, string> = {
    email_sent: 'bg-blue-100 text-blue-700',
    ai_analysis: 'bg-purple-100 text-purple-700',
    proposal_generated: 'bg-emerald-100 text-emerald-700',
    meeting: 'bg-amber-100 text-amber-700',
    bulk_email: 'bg-cyan-100 text-cyan-700',
    note: 'bg-slate-100 text-slate-700',
    opened: 'bg-green-100 text-green-700',
  };

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
              {loading ? '...' : 'DAFO'}
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

        {/* Profile sub-tabs */}
        {leadId && (
          <div className="flex gap-1 mt-4">
            {([
              { id: 'overview' as ProfileTab, label: language === 'ca' ? 'Resum' : language === 'en' ? 'Overview' : 'Resumen' },
              { id: 'crm' as ProfileTab, label: 'CRM & Leads' },
              { id: 'history' as ProfileTab, label: language === 'ca' ? 'Historial' : language === 'en' ? 'History' : 'Historial' },
            ]).map(tab => (
              <button
                key={tab.id}
                onClick={() => setProfileTab(tab.id)}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  profileTab === tab.id
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-8">
        {error && (
          <div className="bg-red-50 border border-red-100 p-4 rounded-2xl text-[11px] text-red-600 font-bold flex items-center gap-3">
            <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
            {error}
          </div>
        )}

        {/* ======= CRM & LEADS TAB ======= */}
        {profileTab === 'crm' && clientDetail && (
          <div className="space-y-6">
            {/* Lead Info Card */}
            <div className="bg-white rounded-[2.5rem] border border-slate-100 p-8 space-y-6">
              <div className="flex items-center justify-between">
                <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.2em]">
                  {language === 'ca' ? 'Informació del Lead' : language === 'en' ? 'Lead Information' : 'Información del Lead'}
                </h4>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-bold text-slate-400 uppercase">Status:</span>
                  <select
                    value={clientDetail.client.lead_status}
                    onChange={e => handleStatusChange(e.target.value)}
                    disabled={updatingStatus}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 text-[10px] font-black uppercase tracking-wider focus:outline-none focus:border-indigo-400"
                  >
                    {['new', 'qualified', 'proposal_sent', 'closed', 'lost', 'converted'].map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {[
                  { label: 'Email', value: clientDetail.client.email },
                  { label: language === 'ca' ? 'Nom' : 'Nombre', value: clientDetail.client.full_name },
                  { label: language === 'ca' ? 'Telèfon' : 'Teléfono', value: clientDetail.client.phone || clientDetail.client.center_phone },
                  { label: language === 'ca' ? 'Origen' : 'Source', value: clientDetail.client.source },
                  { label: language === 'ca' ? 'Municipi' : 'Municipio', value: clientDetail.client.center_municipi },
                  { label: language === 'ca' ? 'Comarca' : 'Comarca', value: clientDetail.client.center_comarca },
                  { label: 'AI Score', value: clientDetail.client.ai_opportunity_score != null ? `${clientDetail.client.ai_opportunity_score}/10` : null },
                  { label: language === 'ca' ? 'Obertures' : 'Aperturas', value: clientDetail.client.open_count },
                  { label: 'Web', value: clientDetail.client.center_web },
                ].filter(f => f.value).map((f, i) => (
                  <div key={i} className="p-4 bg-slate-50 rounded-2xl">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">{f.label}</span>
                    <span className="text-[12px] font-bold text-slate-700 break-all">{String(f.value)}</span>
                  </div>
                ))}
              </div>

              {/* AI Needs Analysis */}
              {clientDetail.client.ai_needs_analysis && (
                <div className="p-6 bg-indigo-50/50 rounded-2xl border border-indigo-100">
                  <h5 className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-3">
                    {language === 'ca' ? 'Anàlisi IA de Necessitats' : language === 'en' ? 'AI Needs Analysis' : 'Análisis IA de Necesidades'}
                  </h5>
                  {clientDetail.client.ai_needs_analysis.needs_detected && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {(clientDetail.client.ai_needs_analysis.needs_detected as string[]).map((n: string, i: number) => (
                        <span key={i} className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full text-[9px] font-bold">{n}</span>
                      ))}
                    </div>
                  )}
                  {clientDetail.client.ai_needs_analysis.recommended_solution && (
                    <p className="text-[11px] text-indigo-700 mt-2">{clientDetail.client.ai_needs_analysis.recommended_solution}</p>
                  )}
                </div>
              )}

              {/* AI Custom Pitch */}
              {clientDetail.client.ai_custom_pitch && (
                <div className="p-6 bg-emerald-50/50 rounded-2xl border border-emerald-100">
                  <h5 className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-2">AI Pitch</h5>
                  <p className="text-[11px] text-emerald-700">{clientDetail.client.ai_custom_pitch}</p>
                </div>
              )}
            </div>

            {/* Notes Section */}
            <div className="bg-white rounded-[2.5rem] border border-slate-100 p-8 space-y-4">
              <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.2em]">
                {language === 'ca' ? 'Notes CRM' : language === 'en' ? 'CRM Notes' : 'Notas CRM'}
              </h4>

              {/* Add note form */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newNote}
                  onChange={e => setNewNote(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddNote()}
                  placeholder={language === 'ca' ? 'Afegir nota...' : language === 'en' ? 'Add note...' : 'Añadir nota...'}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-[11px] focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />
                <button
                  onClick={handleAddNote}
                  disabled={savingNote || !newNote.trim()}
                  className="px-5 py-2.5 bg-slate-900 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-600 transition-all disabled:opacity-50"
                >
                  {savingNote ? '...' : '+'}
                </button>
              </div>

              {/* Notes list */}
              <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar">
                {clientDetail.notes.length === 0 && (
                  <p className="text-[10px] text-slate-400 italic text-center py-4">
                    {language === 'ca' ? 'Sense notes' : language === 'en' ? 'No notes' : 'Sin notas'}
                  </p>
                )}
                {clientDetail.notes.map(note => (
                  <div key={note.id} className="p-4 bg-slate-50 rounded-2xl flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-[8px] font-black text-slate-500 uppercase">{note.created_by?.[0] || 'A'}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] text-slate-700">{note.content}</p>
                      <span className="text-[9px] text-slate-400 mt-1 block">
                        {new Date(note.created_at).toLocaleString()} &middot; {note.created_by}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ======= INTERACTION HISTORY TAB ======= */}
        {profileTab === 'history' && clientDetail && (
          <div className="space-y-6">
            <div className="bg-white rounded-[2.5rem] border border-slate-100 p-8">
              <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.2em] mb-6">
                {language === 'ca' ? 'Timeline d\'Interaccions' : language === 'en' ? 'Interaction Timeline' : 'Timeline de Interacciones'}
                <span className="ml-2 px-2 py-0.5 bg-slate-100 rounded-full text-slate-500">{clientDetail.interactions.length}</span>
              </h4>

              <div className="space-y-0 relative">
                {/* Timeline line */}
                <div className="absolute left-[15px] top-2 bottom-2 w-px bg-slate-200" />

                {clientDetail.interactions.length === 0 && (
                  <p className="text-[10px] text-slate-400 italic text-center py-8 relative z-10">
                    {language === 'ca' ? 'Sense interaccions registrades' : language === 'en' ? 'No recorded interactions' : 'Sin interacciones registradas'}
                  </p>
                )}

                {clientDetail.interactions.map((inter, idx) => (
                  <div key={inter.id} className="flex gap-4 pb-4 relative z-10">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${interactionTypeColors[inter.interaction_type] || 'bg-slate-100 text-slate-500'}`}>
                      <span className="text-[8px] font-black uppercase">
                        {inter.interaction_type === 'email_sent' ? '✉' :
                         inter.interaction_type === 'ai_analysis' ? '🤖' :
                         inter.interaction_type === 'proposal_generated' ? '📄' :
                         inter.interaction_type === 'meeting' ? '🤝' :
                         inter.interaction_type === 'bulk_email' ? '📨' :
                         inter.interaction_type === 'note' ? '📝' :
                         inter.interaction_type === 'opened' ? '👁' : '•'}
                      </span>
                    </div>
                    <div className="flex-1 p-4 bg-slate-50 rounded-2xl hover:bg-slate-100 transition-all">
                      <div className="flex items-center justify-between mb-1">
                        <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase ${interactionTypeColors[inter.interaction_type] || 'bg-slate-100 text-slate-500'}`}>
                          {interactionTypeLabels[inter.interaction_type] || inter.interaction_type}
                        </span>
                        <span className="text-[9px] text-slate-400 font-bold">
                          {new Date(inter.created_at).toLocaleString()}
                        </span>
                      </div>
                      {inter.content_summary && (
                        <p className="text-[11px] text-slate-600 mt-1 line-clamp-3">{inter.content_summary}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Consultations from wizard */}
            {clientDetail.consultations.length > 0 && (
              <div className="bg-white rounded-[2.5rem] border border-slate-100 p-8">
                <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.2em] mb-4">
                  {language === 'ca' ? 'Consultes del Wizard' : language === 'en' ? 'Wizard Consultations' : 'Consultas del Wizard'}
                  <span className="ml-2 px-2 py-0.5 bg-slate-100 rounded-full text-slate-500">{clientDetail.consultations.length}</span>
                </h4>
                <div className="space-y-3">
                  {clientDetail.consultations.map((con: any) => (
                    <div key={con.id} className="p-4 bg-slate-50 rounded-2xl flex items-center justify-between">
                      <div>
                        <span className="text-[11px] font-bold text-slate-700">{con.center_name}</span>
                        <span className="text-[9px] text-slate-400 ml-2">{con.product_type}</span>
                      </div>
                      <span className="text-[9px] text-slate-400">{new Date(con.created_at).toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ======= OVERVIEW TAB (original content) ======= */}
        {profileTab === 'overview' && <>
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
        </>}
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
