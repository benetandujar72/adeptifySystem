import React, { useEffect, useState } from 'react';
import { CenterArtifact, CenterArtifactType } from '../types';
import { centerArtifactsService } from '../services/centerArtifactsService';
import { useLanguage } from '../LanguageContext';
import { downloadCenterReportPdf, downloadCustomProposalPdf, downloadDafoPdf } from '../services/pdfExport';

interface Props {
    tenantSlug?: string;
}

const KnowledgeBase: React.FC<Props> = ({ tenantSlug }) => {
    const { t, language } = useLanguage() as { t: any, language: any };
    const [artifacts, setArtifacts] = useState<CenterArtifact[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterType, setFilterType] = useState<CenterArtifactType | 'all'>('all');
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const loadAllArtifacts = async () => {
            setLoading(true);
            try {
                // Since listForCenter requires a centerName, we might need a more global service method
                // for "all artifacts". For now, we'll assume we can use a workaround or update the service.
                // We'll use an empty string or 'global' to signify everything if the service allows it.
                const all = await centerArtifactsService.listForCenter('', tenantSlug);
                setArtifacts(all);
            } catch (e) {
                console.error('Error loading knowledge base:', e);
            } finally {
                setLoading(false);
            }
        };
        loadAllArtifacts();
    }, [tenantSlug]);

    const filtered = artifacts.filter(a => {
        const matchesType = filterType === 'all' || a.artifactType === filterType;
        const matchesSearch = (a.centerName || '').toLowerCase().includes(searchTerm.toLowerCase());
        return matchesType && matchesSearch;
    });

    const getTypeName = (type: CenterArtifactType) => {
        switch (type) {
            case 'dafo': return 'SWOT';
            case 'report': return language === 'ca' ? 'Informe' : language === 'en' ? 'Report' : 'Informe';
            case 'custom_proposal': return language === 'ca' ? 'Proposta' : language === 'en' ? 'Proposal' : 'Propuesta';
            default: return type;
        }
    };

    return (
        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-2xl overflow-hidden flex flex-col h-[70vh]">
            <div className="p-10 pb-6 border-b border-slate-50 shrink-0">
                <h2 className="text-3xl font-black text-slate-900 mb-6">
                    {language === 'ca' ? 'Base de Coneixement' : language === 'en' ? 'Knowledge Base' : 'Base de Conocimiento'}
                </h2>

                <div className="flex flex-wrap gap-4">
                    <input
                        type="text"
                        placeholder={language === 'ca' ? "Cercar centre..." : language === 'en' ? "Search centre..." : "Buscar centro..."}
                        className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-64"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />

                    <select
                        className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none"
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value as any)}
                    >
                        <option value="all">{language === 'ca' ? 'Tots els tipus' : language === 'en' ? 'All types' : 'Todos los tipos'}</option>
                        <option value="dafo">SWOT</option>
                        <option value="report">{language === 'ca' ? 'Informes' : language === 'en' ? 'Reports' : 'Informes'}</option>
                        <option value="custom_proposal">{language === 'ca' ? 'Propostes' : language === 'en' ? 'Proposals' : 'Propuestas'}</option>
                    </select>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-10 space-y-4 custom-scrollbar">
                {loading ? (
                    <p className="text-center py-10 text-slate-400 font-bold uppercase tracking-widest animate-pulse">
                        {language === 'ca' ? 'Carregant coneixement...' : language === 'en' ? 'Loading knowledge...' : 'Cargando conocimiento...'}
                    </p>
                ) : filtered.length === 0 ? (
                    <p className="text-center py-10 text-slate-400 font-bold italic">
                        {language === 'ca' ? 'No s\'ha trobat cap solució.' : language === 'en' ? 'No solution found.' : 'No se ha encontrado ninguna solución.'}
                    </p>
                ) : (
                    <div className="grid grid-cols-1 gap-3">
                        {filtered.map(a => (
                            <div key={a.id} className="flex items-center justify-between gap-4 p-5 bg-slate-50 rounded-[1.5rem] border border-slate-100 hover:border-indigo-200 hover:shadow-lg transition-all">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className={`px-2 py-0.5 text-[8px] font-black uppercase tracking-tighter rounded-md text-white ${a.artifactType === 'dafo' ? 'bg-orange-500' : a.artifactType === 'report' ? 'bg-indigo-500' : 'bg-emerald-500'
                                            }`}>
                                            {getTypeName(a.artifactType)}
                                        </span>
                                        <p className="text-xs font-black text-slate-900 truncate">{a.centerName}</p>
                                    </div>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                                        {new Date(a.createdAt).toLocaleString()}
                                    </p>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                    <button
                                        onClick={() => {
                                            if (a.artifactType === 'dafo') downloadDafoPdf(a.centerName || 'Global', a.payload, language);
                                            if (a.artifactType === 'report') downloadCenterReportPdf(a.centerName || 'Global', a.payload, language);
                                            if (a.artifactType === 'custom_proposal') downloadCustomProposalPdf(a.centerName || 'Global', a.payload, language);
                                        }}
                                        className="px-4 py-2 bg-white text-indigo-600 border border-slate-200 rounded-xl font-black text-[10px] uppercase tracking-widest hover:border-indigo-500 transition-all shadow-sm"
                                    >
                                        PDF
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default KnowledgeBase;
