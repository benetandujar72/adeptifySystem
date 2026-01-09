import React, { useState } from 'react';
import { useLanguage } from '../LanguageContext';

interface ProjectExample {
    id: number;
    title: { [key: string]: string };
    description: { [key: string]: string };
    metrics: {
        hours: string;
        deployment: string;
        aiCost: string;
        maintenance: string;
    };
}

const ProjectExamples: React.FC = () => {
    const { t, language } = useLanguage();
    const [hoveredId, setHoveredId] = useState<number | null>(null);

    // Placeholder projects as requested
    const projects: ProjectExample[] = [
        {
            id: 1,
            title: {
                ca: "Automatització de Matrícules",
                es: "Automatización de Matrículas",
                eu: "Matrikulazioen Automatizazioa"
            },
            description: {
                ca: "Digitalització completa del procés d'inscripció amb validació documental automàtica.",
                es: "Digitalización completa del proceso de inscripción con validación documental automática.",
                eu: "Izena emateko prozesuaren digitalizazio osoa, dokumentuen baliozkotze automatikoarekin."
            },
            metrics: {
                hours: "40h",
                deployment: "1 setmana",
                aiCost: "0.02€ / doc",
                maintenance: "15€/mes"
            }
        },
        {
            id: 2,
            title: {
                ca: "Assistent IA per a Docents",
                es: "Asistente IA para Docentes",
                eu: "Irakasleentzako IA Laguntzailea"
            },
            description: {
                ca: "Generació automàtica de rúbriques i feedback personalitzat per a l'alumne basat en objectius.",
                es: "Generación automática de rúbricas y feedback personalizado para el alumno basado en objetivos.",
                eu: "Rubriken sorkuntza automatikoa eta ikaslearentzako feedback pertsonalizatua helburuetan oinarrituta."
            },
            metrics: {
                hours: "25h",
                deployment: "3 dies",
                aiCost: "0.10€ / grup",
                maintenance: "10€/mes"
            }
        },
        {
            id: 3,
            title: {
                ca: "Gestió de Menjador Intel·ligent",
                es: "Gestión de Comedor Inteligente",
                eu: "Jantoki Kudeaketa Adimentsua"
            },
            description: {
                ca: "Previsió de consums i gestió d'al·lèrgies en temps real connectat amb l'app de famílies.",
                es: "Previsión de consumos y gestión de alergias en tiempo real conectado con la app de familias.",
                eu: "Kontsumoen aurreikuspena eta alergien kudeaketa denbora errealean familientzako aplikazioarekin lotuta."
            },
            metrics: {
                hours: "60h",
                deployment: "2 setmanes",
                aiCost: "< 1€ / mes",
                maintenance: "25€/mes"
            }
        }
    ];

    return (
        <section className="w-full max-w-6xl mx-auto mb-16 md:mb-20">
            <div className="text-left md:text-center mb-10">
                <h2 className="text-2xl md:text-3xl font-serif text-slate-900 italic">
                    {t.consultorProjectsTitle}
                </h2>
                <p className="mt-3 text-slate-500 font-medium leading-relaxed max-w-3xl md:mx-auto">
                    {t.consultorProjectsDesc}
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {projects.map((project) => (
                    <div
                        key={project.id}
                        className={`relative group bg-white border rounded-2xl p-8 transition-all duration-500 overflow-hidden ${hoveredId === project.id
                                ? 'border-indigo-400 shadow-[0_20px_40px_rgba(79,70,229,0.1)] -translate-y-1'
                                : 'border-slate-100 shadow-[0_4px_20px_rgba(0,0,0,0.03)]'
                            }`}
                        onMouseEnter={() => setHoveredId(project.id)}
                        onMouseLeave={() => setHoveredId(null)}
                    >
                        {/* Background Accent */}
                        <div className={`absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-full -mr-16 -mt-16 transition-transform duration-700 ${hoveredId === project.id ? 'scale-150 opacity-40' : 'scale-100 opacity-20'
                            }`} />

                        <div className="relative z-10">
                            <h3 className="text-xl font-black text-slate-900 tracking-tight mb-3">
                                {project.title[language] || project.title['es']}
                            </h3>
                            <p className="text-sm text-slate-500 leading-relaxed font-medium mb-8">
                                {project.description[language] || project.description['es']}
                            </p>

                            <div className="grid grid-cols-2 gap-4 pt-6 border-t border-slate-50">
                                <div className="space-y-1">
                                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                        {t.consultorProjectMetricHours}
                                    </div>
                                    <div className="text-sm font-black text-indigo-600">
                                        {project.metrics.hours}
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                        {t.consultorProjectMetricDeployment}
                                    </div>
                                    <div className="text-sm font-black text-slate-900">
                                        {project.metrics.deployment}
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                        {t.consultorProjectMetricAiCost}
                                    </div>
                                    <div className="text-sm font-black text-slate-900">
                                        {project.metrics.aiCost}
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                        {t.consultorProjectMetricMaintenance}
                                    </div>
                                    <div className="text-sm font-black text-slate-900">
                                        {project.metrics.maintenance}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Subtle Hover Indicator */}
                        <div className={`absolute bottom-0 left-0 h-1 bg-indigo-500 transition-all duration-500 ${hoveredId === project.id ? 'w-full' : 'w-0'
                            }`} />
                    </div>
                ))}
            </div>
        </section>
    );
};

export default ProjectExamples;
