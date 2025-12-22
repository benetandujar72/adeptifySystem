
import React, { useState, useEffect, useRef } from 'react';
import { DiagnosisState } from '../types';
import { getNextConsultantQuestion, DynamicQuestion } from '../services/geminiService';

interface DynamicConsultantProps {
  initialDiagnosis: DiagnosisState;
  onComplete: (history: { question: string; answer: string }[]) => void;
}

const DynamicConsultant: React.FC<DynamicConsultantProps> = ({ initialDiagnosis, onComplete }) => {
  const [history, setHistory] = useState<{ question: string; answer: string }[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<Partial<DynamicQuestion>>({
    question: "Identificació de plataforma: quins sistemes de dades i gestió formen el nucli actual del centre?",
    options: ["Google Workspace", "Microsoft 365 / Teams", "Alexia / Clickedu", "Sistemes Territorials (Gestib/Seneque)", "Excel & Gestió Analògica", "Moodle / Canvas"],
    isMultiSelect: true
  });
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [customAnswer, setCustomAnswer] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [confidence, setConfidence] = useState(15);
  const scrollRef = useRef<HTMLDivElement>(null);

  const auditMessages = [
    "Analitzant correlació...",
    "Optimitzant flux de dades...",
    "Validant arquitectures...",
    "Projectant reducció de càrrega...",
    "Identificant punts de fricció..."
  ];

  const [currentStatus, setCurrentStatus] = useState(auditMessages[0]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    if (!isLoading) {
        const randomMsg = auditMessages[Math.floor(Math.random() * auditMessages.length)];
        setCurrentStatus(randomMsg);
    }
  }, [history, currentQuestion, isLoading]);

  const toggleOption = (option: string) => {
    if (option === 'Altres...') {
      setShowCustomInput(!showCustomInput);
      return;
    }

    if (currentQuestion.isMultiSelect) {
      setSelectedOptions(prev => 
        prev.includes(option) ? prev.filter(o => o !== option) : [...prev, option]
      );
    } else {
      handleFinalSubmit(option);
    }
  };

  const handleFinalSubmit = async (finalAnswer?: string) => {
    let answerText = finalAnswer || '';
    
    if (!finalAnswer) {
      const parts = [...selectedOptions];
      if (customAnswer.trim()) parts.push(customAnswer.trim());
      answerText = parts.join(', ');
    }

    if (!answerText.trim() || isLoading) return;

    const newHistory = [...history, { question: currentQuestion.question!, answer: answerText }];
    setHistory(newHistory);
    setSelectedOptions([]);
    setCustomAnswer('');
    setShowCustomInput(false);
    setIsLoading(true);

    try {
      const next = await getNextConsultantQuestion(newHistory, initialDiagnosis);
      
      if (next.isComplete || next.confidence > 94 || newHistory.length >= 4) {
        onComplete(newHistory);
      } else {
        setCurrentQuestion({
          ...next,
          options: next.options.length > 0 ? next.options : ["Continuar", "Veure Proposta", "Altres..."]
        });
        setConfidence(Math.min(next.confidence, 98));
      }
    } catch (error) {
      onComplete(newHistory);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-[1.5rem] md:rounded-[2.5rem] shadow-premium border border-slate-200 overflow-hidden flex flex-col h-[85vh] md:h-[750px] animate-in zoom-in-95 duration-700">
      {/* Consola Header */}
      <div className="bg-slate-900 p-6 md:p-10 text-white flex flex-col md:flex-row justify-between items-start md:items-center relative overflow-hidden shrink-0">
        <div className="absolute top-0 left-0 w-full h-1 bg-indigo-500" />
        <div className="flex items-center gap-4 md:gap-6 relative z-10 mb-4 md:mb-0">
          <div className="w-10 h-10 md:w-14 md:h-14 bg-indigo-600 rounded-xl md:rounded-2xl flex items-center justify-center shadow-2xl">
             <svg className="w-6 h-6 md:w-8 md:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
          </div>
          <div>
            <h3 className="text-sm md:text-lg font-black uppercase tracking-[0.2em] md:tracking-[0.3em]">Auditoria de Sistemes</h3>
            <p className="text-[8px] md:text-[10px] text-indigo-400 font-bold uppercase tracking-widest mt-0.5">Adeptify Engine</p>
          </div>
        </div>
        <div className="text-right flex flex-col items-start md:items-end relative z-10 w-full md:w-auto">
          <div className="flex items-baseline gap-2 mb-1.5">
            <span className="text-[8px] md:text-[10px] font-black uppercase text-slate-500 tracking-widest">Comprensió:</span>
            <span className="text-lg md:text-2xl font-brand italic text-white">{confidence}%</span>
          </div>
          <div className="w-full md:w-56 h-1 bg-white/10 rounded-full overflow-hidden">
            <div 
              className="h-full bg-indigo-500 rounded-full transition-all duration-1000 ease-out" 
              style={{ width: `${confidence}%` }}
            />
          </div>
        </div>
      </div>

      {/* Terminal de Diàleg */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 md:p-10 space-y-8 md:space-y-10 bg-[#FBFDFF] custom-scrollbar">
        {history.map((item, i) => (
          <div key={i} className="space-y-4 md:space-y-6 animate-in fade-in slide-in-from-bottom-4">
            <div className="flex justify-start">
              <div className="bg-white p-6 md:p-8 rounded-2xl md:rounded-[2rem] rounded-tl-none border border-slate-200 shadow-sm max-w-[90%] md:max-w-[80%]">
                <span className="text-[8px] md:text-[9px] font-black text-indigo-600 uppercase mb-2 block tracking-widest">Adeptify Partner</span>
                <p className="text-sm md:text-md font-medium text-slate-800 leading-relaxed">{item.question}</p>
              </div>
            </div>
            <div className="flex justify-end">
              <div className="bg-slate-900 p-6 md:p-8 rounded-2xl md:rounded-[2rem] rounded-tr-none text-white shadow-xl max-w-[90%] md:max-w-[80%] border-l-4 border-indigo-600">
                <p className="text-sm md:text-md font-bold leading-relaxed">{item.answer}</p>
              </div>
            </div>
          </div>
        ))}

        {isLoading ? (
          <div className="flex justify-start">
            <div className="bg-white p-4 md:p-8 rounded-2xl md:rounded-3xl border border-slate-100 flex items-center gap-3 shadow-sm">
              <div className="flex gap-1">
                <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-bounce" />
                <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-bounce [animation-delay:0.2s]" />
              </div>
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{currentStatus}</span>
            </div>
          </div>
        ) : (
          <div className="space-y-6 md:space-y-8 animate-in slide-in-from-left-6 pb-10">
            <div className="bg-white p-6 md:p-10 rounded-2xl md:rounded-[2.5rem] rounded-tl-none border border-slate-200 shadow-premium">
              <h4 className="text-lg md:text-2xl font-black text-slate-900 leading-tight mb-8 md:mb-10 tracking-tight">{currentQuestion.question}</h4>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                {currentQuestion.options?.map((option, idx) => {
                  const isSelected = selectedOptions.includes(option);
                  return (
                    <button
                      key={idx}
                      onClick={() => toggleOption(option)}
                      className={`text-left p-4 md:p-6 rounded-xl md:rounded-2xl border transition-all duration-300 flex items-center justify-between group ${
                        isSelected 
                          ? 'bg-slate-900 border-slate-900 text-white shadow-xl' 
                          : 'bg-white border-slate-100 text-slate-600 hover:border-indigo-600 hover:bg-indigo-50/20'
                      }`}
                    >
                      <span className={`text-[10px] md:text-[11px] font-bold uppercase tracking-tight ${isSelected ? 'text-white' : 'text-slate-700'}`}>{option}</span>
                      <div className={`h-4 w-4 md:h-5 md:w-5 rounded-full border flex items-center justify-center transition-all ${
                        isSelected ? 'border-indigo-400 bg-indigo-400' : 'border-slate-200'
                      }`}>
                         <svg className={`w-3 h-3 text-white transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7" />
                         </svg>
                      </div>
                    </button>
                  );
                })}
              </div>

              {showCustomInput && (
                <div className="mt-6 md:mt-8 animate-in fade-in slide-in-from-top-4">
                  <p className="text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-2">Contextualització Adicional</p>
                  <textarea
                    autoFocus
                    className="w-full p-4 md:p-8 bg-slate-50 border border-slate-200 rounded-xl md:rounded-[2rem] outline-none focus:border-indigo-600 transition-all font-medium text-sm text-slate-800 shadow-inner"
                    placeholder="Detalli aquí..."
                    value={customAnswer}
                    onChange={(e) => setCustomAnswer(e.target.value)}
                  />
                </div>
              )}

              <div className="mt-8 md:mt-12 flex flex-col md:flex-row justify-between items-center gap-6 border-t border-slate-50 pt-6 md:pt-10">
                 <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-indigo-600 rounded-full" />
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                        Pas {history.length + 1} de 4
                    </span>
                 </div>
                  <button
                    onClick={() => handleFinalSubmit()}
                    disabled={selectedOptions.length === 0 && !customAnswer.trim()}
                    className="w-full md:w-auto bg-slate-900 text-white px-10 md:px-16 py-4 md:py-5 rounded-xl md:rounded-2xl font-black text-[9px] md:text-[10px] uppercase tracking-[0.3em] md:tracking-[0.4em] hover:bg-indigo-600 transition-all disabled:opacity-30 shadow-2xl active:scale-95"
                  >
                    Següent →
                  </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-center shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
          <span className="text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Servidors Segurs • Adeptify Datacenter</span>
        </div>
      </div>
    </div>
  );
};

export default DynamicConsultant;
