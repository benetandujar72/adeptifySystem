import React, { useState, useEffect } from 'react';
import { useLanguage } from '../LanguageContext';
import { supabase } from '../services/supabaseClient';
import { ProjectExample } from '../types';

const ProjectExamples: React.FC = () => {
    const { t, language } = useLanguage();
    const [projects, setProjects] = useState<ProjectExample[]>([]);
    const [loading, setLoading] = useState(true);
    const [hoveredId, setHoveredId] = useState<string | null>(null);
    const [brokenImages, setBrokenImages] = useState<Set<string>>(new Set());

    useEffect(() => {
        const fetchProjects = async () => {
            if (!supabase) {
                setLoading(false);
                return;
            }

            const { data, error } = await supabase
                .from('project_examples')
                .select('*')
                .order('created_at', { ascending: true });

            if (!error && data) {
                // Desduplicar per id — evita mostrar el mateix projecte múltiples vegades
                const seen = new Set<string>();
                const unique = data.filter((item: any) => {
                    if (seen.has(String(item.id))) return false;
                    seen.add(String(item.id));
                    return true;
                });

                // Limitar a un màxim de 9 projectes
                const mappedProjects: ProjectExample[] = unique.slice(0, 9).map((item: any) => ({
                    ...item,
                    metrics: {
                        hours: item.hours,
                        deployment: item.deployment,
                        ai_cost: item.ai_cost,
                        maintenance: item.maintenance,
                        dev_cost: item.dev_cost,
                        ownership_cost: item.ownership_cost,
                    }
                }));
                setProjects(mappedProjects);
            }
            setLoading(false);
        };

        fetchProjects();
    }, []);

    const getLocalizedField = (project: ProjectExample, field: 'title' | 'description') => {
        const key = `${field}_${language}` as keyof ProjectExample;
        const fallback = `${field}_es` as keyof ProjectExample;
        return (project[key] || project[fallback]) as string;
    };

    const handleImageError = (id: string) => {
        setBrokenImages(prev => new Set(prev).add(id));
    };

    const showImage = (project: ProjectExample) =>
        project.image_url && !brokenImages.has(String(project.id));

    if (loading) {
        return (
            <section className="w-full max-w-6xl mx-auto mb-16 md:mb-20 animate-pulse">
                <div className="h-8 w-64 bg-slate-100 rounded mx-auto mb-10" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="h-80 bg-slate-50 rounded-2xl border border-slate-100" />
                    ))}
                </div>
            </section>
        );
    }

    if (projects.length === 0) return null;

    return (
        <section className="w-full max-w-6xl mx-auto mb-16 md:mb-20">
            <div className="text-left md:text-center mb-10 px-4">
                <h2 className="text-2xl md:text-4xl font-black text-slate-900 tracking-tight">
                    {t.consultorProjectsTitle}
                </h2>
                <div className="w-20 h-1.5 bg-indigo-500 md:mx-auto mt-4 mb-6 rounded-full" />
                <p className="mt-3 text-slate-500 font-medium leading-relaxed max-w-3xl md:mx-auto text-lg">
                    {t.consultorProjectsDesc}
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10 px-4">
                {projects.map((project) => (
                    <div
                        key={project.id}
                        className="group h-[500px] [perspective:1500px]"
                        onMouseEnter={() => setHoveredId(String(project.id))}
                        onMouseLeave={() => setHoveredId(null)}
                    >
                        <div className={`relative w-full h-full transition-all duration-700 [transform-style:preserve-3d] ${hoveredId === String(project.id) ? '[transform:rotateY(180deg)]' : ''}`}>

                            {/* FRONT SIDE */}
                            <div className="absolute inset-0 w-full h-full [backface-visibility:hidden] bg-white border-2 border-slate-100 rounded-[2.5rem] shadow-[0_10px_40px_rgba(0,0,0,0.03)] overflow-hidden flex flex-col">
                                {showImage(project) ? (
                                    <div className="h-48 overflow-hidden rounded-t-[2.4rem] bg-slate-50 flex items-center justify-center">
                                        <img
                                            src={project.image_url!}
                                            alt={getLocalizedField(project, 'title')}
                                            className="w-full h-full object-cover"
                                            onError={() => handleImageError(String(project.id))}
                                        />
                                    </div>
                                ) : (
                                    <div className="h-48 bg-gradient-to-br from-indigo-50 to-slate-50 flex items-center justify-center rounded-t-[2.4rem]">
                                        <div className="p-5 bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                            </svg>
                                        </div>
                                    </div>
                                )}

                                <div className="p-8 flex-grow flex flex-col">
                                    <div className="mb-4">
                                        <span className="px-3 py-1 bg-indigo-50 text-indigo-600 text-[10px] font-black uppercase tracking-widest rounded-full">
                                            {project.category || 'Consultoria'}
                                        </span>
                                    </div>
                                    <h3 className="text-2xl font-black text-slate-900 leading-tight mb-4">
                                        {getLocalizedField(project, 'title')}
                                    </h3>
                                    <p className="text-slate-500 text-sm font-medium leading-relaxed line-clamp-4">
                                        {getLocalizedField(project, 'description')}
                                    </p>

                                    <div className="mt-auto pt-6 flex items-center text-indigo-600 font-black text-[10px] uppercase tracking-widest gap-2">
                                        {t.lpViewDetails || 'Més Detalls'}
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                        </svg>
                                    </div>
                                </div>
                            </div>

                            {/* BACK SIDE */}
                            <div className="absolute inset-0 w-full h-full [backface-visibility:hidden] [transform:rotateY(180deg)] bg-indigo-600 rounded-[2.5rem] p-8 text-white shadow-2xl flex flex-col justify-between">
                                <div>
                                    <div className="flex justify-between items-start mb-6">
                                        <div className="p-3 bg-white/20 rounded-2xl">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                            </svg>
                                        </div>
                                        {project.repo_url && (
                                            <a href={project.repo_url} target="_blank" rel="noopener noreferrer" className="p-2 bg-white/10 hover:bg-white/30 rounded-full transition-colors">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                                                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.041-1.416-4.041-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                                                </svg>
                                            </a>
                                        )}
                                    </div>
                                    <h4 className="text-xl font-black mb-6 border-b border-white/20 pb-4">Mètriques de l'Èxit</h4>

                                    <div className="grid grid-cols-2 gap-y-6 gap-x-4">
                                        <div className="space-y-1">
                                            <p className="text-[9px] font-black uppercase opacity-60 tracking-widest">{t.consultorProjectMetricHours}</p>
                                            <p className="text-lg font-black">{project.metrics.hours}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-[9px] font-black uppercase opacity-60 tracking-widest">{t.consultorProjectMetricDeployment}</p>
                                            <p className="text-lg font-black">{project.metrics.deployment}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-[9px] font-black uppercase opacity-60 tracking-widest">{t.consultorProjectMetricDevCost}</p>
                                            <p className="text-lg font-black">{project.metrics.dev_cost || 'Consultar'}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-[9px] font-black uppercase opacity-60 tracking-widest">{t.consultorProjectMetricOwnership}</p>
                                            <p className="text-lg font-black">{project.metrics.ownership_cost || 'Inclòs'}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-[9px] font-black uppercase opacity-60 tracking-widest">{t.consultorProjectMetricAiCost}</p>
                                            <p className="text-lg font-black">{project.metrics.ai_cost}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-[9px] font-black uppercase opacity-60 tracking-widest">{t.consultorProjectMetricMaintenance}</p>
                                            <p className="text-lg font-black">{project.metrics.maintenance}</p>
                                        </div>
                                    </div>
                                </div>

                                <button className="w-full py-4 bg-white text-indigo-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-50 transition-colors">
                                    {t.lpServiceCta || 'Contactar'}
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
};

export default ProjectExamples;
