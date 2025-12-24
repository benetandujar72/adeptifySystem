
import React, { useState, useEffect } from 'react';
import { useLanguage } from '../LanguageContext';

interface Phase {
  id: number;
  label: string;
  duration: number;
}

interface ProcessingScreenProps {
  centerName?: string;
  onComplete: () => void;
}

const ProcessingScreen: React.FC<ProcessingScreenProps> = ({ centerName, onComplete }) => {
  const { t } = useLanguage();
  const [currentPhase, setCurrentPhase] = useState(0);
  const [progress, setProgress] = useState(0);

  const PHASES: Phase[] = [
    { id: 1, label: t.phase1, duration: 800 },
    { id: 2, label: t.phase2, duration: 1000 },
    { id: 3, label: t.phase3, duration: 1200 },
    { id: 4, label: t.phase4, duration: 800 },
    { id: 5, label: t.phase5, duration: 600 },
  ];

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
      <div className="w-full max-w-lg space-y-12 text-center">
        <div className="space-y-4">
          <div className="inline-block px-4 py-1.5 bg-indigo-50 rounded-full text-[10px] font-bold text-indigo-600 uppercase tracking-widest">
            Adeptify Intelligence
          </div>
          <h3 className="text-4xl font-serif text-slate-900 italic">{t.processingTitle}</h3>
          <p className="text-slate-400 text-sm font-medium">{t.processingDesc}</p>
        </div>

        <div className="relative pt-1">
          <progress
            className="w-full h-1.5 mb-10 rounded-full overflow-hidden bg-slate-100"
            value={progress}
            max={100}
            aria-label="progress"
          />
        </div>

        <div className="space-y-6 text-left max-w-xs mx-auto">
          {PHASES.map((phase, idx) => {
            const isCurrent = currentPhase === idx;
            const isPast = currentPhase > idx;
            
            return (
              <div key={idx} className={`flex items-center gap-4 transition-all duration-500 ${isCurrent ? 'translate-x-2' : ''}`}>
                <div className={`h-2 w-2 rounded-full transition-all duration-500 ${
                  isPast ? 'bg-green-500' : isCurrent ? 'bg-indigo-600 animate-pulse scale-150' : 'bg-slate-200'
                }`} />
                <span className={`text-[10px] font-bold uppercase tracking-widest transition-colors duration-500 ${
                  isCurrent ? 'text-slate-900' : isPast ? 'text-slate-300' : 'text-slate-100'
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
