import React, { useState, useEffect } from 'react';
import { useLanguage } from '../LanguageContext';
import { supabase } from '../services/supabaseClient';
import { ProjectExample } from '../types';

const ProjectExamples: React.FC = () => {
    const { t, language } = useLanguage();
    const [projects, setProjects] = useState<ProjectExample[]>([]);
    const [loading, setLoading] = useState(true);
    const [hoveredId, setHoveredId] = useState<string | null>(null);

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
                setProjects(data);
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

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 px-4">
                {projects.map((project) => (
                    <div
                        key={project.id}
                        className={`group relative bg-white border-2 rounded-[2rem] p-8 transition-all duration-500 ease-out ${hoveredId === project.id
                            ? 'border-indigo-500 shadow-[20px_20px_60px_rgba(79,70,229,0.15)] -translate-y-2'
                            : 'border-slate-100 shadow-[0_10px_30px_rgba(0,0,0,0.02)]'
                            }`}
                        onMouseEnter={() => setHoveredId(project.id)}
                        onMouseLeave={() => setHoveredId(null)}
                    >
                        {/* Interactive Background Glow */}
                        <div className={`absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-[2.1rem] blur opacity-0 transition duration-500 ${hoveredId === project.id ? 'opacity-10' : ''}`} />

                        <div className="relative z-10 flex flex-col h-full">
                            <div className="flex justify-between items-start mb-6">
                                <div className="p-3 bg-indigo-50 rounded-2xl text-indigo-600 group-hover:bg-indigo-500 group-hover:text-white transition-colors duration-300">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                    </svg>
                                </div>
                                {project.repo_url && (
                                    <a href={project.repo_url} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-indigo-500 transition-colors">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                                            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.041-1.416-4.041-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                                        </svg>
                                    </a>
                                )}
                            </div>

                            <h3 className="text-2xl font-black text-slate-900 tracking-tight mb-4">
                                {getLocalizedField(project, 'title')}
                            </h3>
                            <p className="text-slate-500 leading-relaxed font-medium mb-8 flex-grow">
                                {getLocalizedField(project, 'description')}
                            </p>

                            <div className="grid grid-cols-2 gap-y-6 pt-8 border-t border-slate-100">
                                <div className="space-y-1">
                                    <div className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
                                        {t.consultorProjectMetricHours}
                                    </div>
                                    <div className="text-base font-black text-indigo-600">
                                        {project.metrics.hours}
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <div className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
                                        {t.consultorProjectMetricDeployment}
                                    </div>
                                    <div className="text-base font-black text-slate-900">
                                        {project.metrics.deployment}
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <div className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
                                        {t.consultorProjectMetricAiCost}
                                    </div>
                                    <div className="text-base font-black text-slate-900">
                                        {project.metrics.ai_cost}
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <div className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
                                        {t.consultorProjectMetricMaintenance}
                                    </div>
                                    <div className="text-base font-black text-slate-900 border-b-2 border-indigo-100 pb-0.5">
                                        {project.metrics.maintenance}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Animated Bottom Line */}
                        <div className={`absolute bottom-0 left-0 h-1.5 bg-gradient-to-r from-indigo-500 to-purple-600 transition-all duration-700 ease-out rounded-b-full ${hoveredId === project.id ? 'w-full' : 'w-0'
                            }`} />
                    </div>
                ))}
            </div>
        </section>
    );
};

export default ProjectExamples;
