
import React, { useState, useEffect } from 'react';

interface Phase {
  id: number;
  label: string;
  duration: number;
}

const PHASES: Phase[] = [
  { id: 1, label: "Analitzant dades del centre i diagnòstic operacional", duration: 800 },
  { id: 2, label: "Mapejant fluxos de treball i arquitectura de sistemes", duration: 1000 },
  { id: 3, label: "Dissenyan l'estructura del backend i servidors dedicats", duration: 1200 },
  { id: 4, label: "Calculant quotes d'amortització i projecció de ROI", duration: 800 },
  { id: 5, label: "Finalitzant pressupost tècnic i calendari d'execució", duration: 600 },
];

interface ProcessingScreenProps {
  centerName?: string;
  onComplete: () => void;
}

const ProcessingScreen: React.FC<ProcessingScreenProps> = ({ centerName, onComplete }) => {
  const [currentPhase, setCurrentPhase] = useState(0);
  const [completedPhases, setCompletedPhases] = useState<number[]>([]);
  const [progress, setProgress] = useState(0);
  const [isWaitingForAI, setIsWaitingForAI] = useState(false);

  useEffect(() => {
    const runPhases = async () => {
      let currentProgress = 0;
      for (let i = 0; i < PHASES.length; i++) {
        setCurrentPhase(i);
        const phase = PHASES[i];
        
        const steps = 15;
        const stepTime = phase.duration / steps;
        for (let s = 0; s < steps; s++) {
          await new Promise(resolve => setTimeout(resolve, stepTime));
          currentProgress += (100 / PHASES.length) / steps;
          setProgress(Math.min(currentProgress, 99));
        }
        
        setCompletedPhases(prev => [...prev, i]);
      }
      
      setIsWaitingForAI(true);
      setProgress(100);
      onComplete();
    };

    runPhases();
  }, [onComplete]);

  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 animate-in fade-in duration-500 min-h-[600px]">
      <div className="w-full max-w-md bg-white rounded-[3.5rem] p-12 shadow-[0_20px_50px_rgba(0,0,0,0.05)] border border-slate-50 relative">
        <div className="flex justify-center mb-8">
          <div className="w-20 h-20 bg-indigo-600 rounded-[1.8rem] flex items-center justify-center shadow-2xl shadow-indigo-200 relative">
             <div className="absolute inset-0 bg-white/10 rounded-[1.8rem] animate-pulse" />
             <svg className="w-10 h-10 text-white relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
             </svg>
          </div>
        </div>

        <div className="text-center mb-10">
          <h3 className="text-[1.75rem] font-black text-slate-800 tracking-tight mb-1 uppercase">Processant Auditoria</h3>
          <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.2em]">Adeptify Consulting SLU • Systems Intelligence</p>
        </div>

        <div className="mb-10 px-2">
          <div className="flex justify-between items-baseline mb-3">
            <span className="text-[11px] font-black text-indigo-600 uppercase tracking-widest">Estat de l'Enginyeria</span>
            <span className="text-3xl font-black text-slate-900 tracking-tighter">{Math.round(progress)}%</span>
          </div>
          <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden p-0.5">
            <div 
              className="h-full bg-indigo-600 rounded-full transition-all duration-300 ease-out shadow-[0_0_15px_rgba(79,70,229,0.4)]"
              style={{ width: `${progress}%` }}
            />
          </div>
          {isWaitingForAI && (
            <p className="text-center text-[9px] font-black text-indigo-500 uppercase tracking-widest mt-3 animate-pulse">
              Finalitzant validació de sistemes...
            </p>
          )}
        </div>

        <div className="space-y-4 px-2">
          {PHASES.map((phase, idx) => {
            const isCompleted = completedPhases.includes(idx);
            const isCurrent = currentPhase === idx && !isCompleted;
            
            return (
              <div key={phase.id} className={`flex items-center gap-5 transition-all duration-500 ${isCurrent ? 'translate-x-2' : ''}`}>
                <div className={`flex-shrink-0 h-7 w-7 rounded-full flex items-center justify-center transition-all ${
                  isCompleted ? 'bg-[#22c55e] text-white' : 
                  isCurrent ? 'bg-indigo-50 text-indigo-600 border-2 border-indigo-600 border-t-transparent animate-spin' : 'bg-slate-50 border-2 border-slate-100'
                }`}>
                  {isCompleted && (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3.5" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <span className={`text-[12px] font-bold tracking-tight transition-colors duration-500 ${
                  isCompleted ? 'text-slate-400' : isCurrent ? 'text-indigo-600' : 'text-slate-300'
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
