
import React, { useState, useEffect } from 'react';

interface Phase {
  id: number;
  label: string;
  duration: number;
}

const PHASES: Phase[] = [
  { id: 1, label: "Analitzant dades del centre educatiu", duration: 800 },
  { id: 2, label: "Mapejant fluxos operatius i de gestió", duration: 1000 },
  { id: 3, label: "Arquitectura de sistemes personalitzada", duration: 1200 },
  { id: 4, label: "Càlcul de ROI i projecció d'amortització", duration: 800 },
  { id: 5, label: "Generant informe estratègic final", duration: 600 },
];

interface ProcessingScreenProps {
  centerName?: string;
  onComplete: () => void;
}

const ProcessingScreen: React.FC<ProcessingScreenProps> = ({ centerName, onComplete }) => {
  const [currentPhase, setCurrentPhase] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const runPhases = async () => {
      let currentProgress = 0;
      for (let i = 0; i < PHASES.length; i++) {
        setCurrentPhase(i);
        const phase = PHASES[i];
        const steps = 10;
        const stepTime = phase.duration / steps;
        for (let s = 0; s < steps; s++) {
          await new Promise(resolve => setTimeout(resolve, stepTime));
          currentProgress += (100 / PHASES.length) / steps;
          setProgress(Math.min(currentProgress, 100));
        }
      }
      onComplete();
    };
    runPhases();
  }, [onComplete]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[600px] fade-up">
      <div className="w-full max-w-lg space-y-12">
        <div className="text-center space-y-4">
          <div className="inline-block px-4 py-1.5 bg-indigo-50 rounded-full text-[10px] font-bold text-indigo-600 uppercase tracking-widest">
            Audit Intelligence Core
          </div>
          <h3 className="text-4xl font-serif text-slate-900 italic">Processant dades...</h3>
          <p className="text-slate-400 text-sm font-medium">L'enginyeria d'Adeptify està modelant la seva solució.</p>
        </div>

        <div className="relative pt-1">
          <div className="flex mb-4 items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Estat del processament</span>
            <span className="text-sm font-bold text-slate-900">{Math.round(progress)}%</span>
          </div>
          <div className="overflow-hidden h-1 mb-10 text-xs flex rounded bg-slate-100">
            <div 
              style={{ width: `${progress}%` }} 
              className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-indigo-600 transition-all duration-300"
            />
          </div>
        </div>

        <div className="space-y-6">
          {PHASES.map((phase, idx) => {
            const isCurrent = currentPhase === idx;
            const isPast = currentPhase > idx;
            
            return (
              <div key={idx} className={`flex items-center gap-4 transition-all duration-500 ${isCurrent ? 'translate-x-2' : ''}`}>
                <div className={`h-2 w-2 rounded-full transition-all duration-500 ${
                  isPast ? 'bg-green-500' : isCurrent ? 'bg-indigo-600 animate-pulse scale-150' : 'bg-slate-200'
                }`} />
                <span className={`text-xs font-bold uppercase tracking-widest transition-colors duration-500 ${
                  isCurrent ? 'text-slate-900' : isPast ? 'text-slate-300' : 'text-slate-200'
                }`}>
                  {phase.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ProcessingScreen;