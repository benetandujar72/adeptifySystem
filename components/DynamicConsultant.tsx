
import React, { useState, useEffect, useRef } from 'react';
import { DiagnosisState } from '../types';
import { getNextConsultantQuestion, DynamicQuestion } from '../services/geminiService';

interface DynamicConsultantProps {
  initialDiagnosis: DiagnosisState;
  onComplete: (history: { question: string; answer: string }[]) => void;
}

const DynamicConsultant: React.FC<DynamicConsultantProps> = ({ initialDiagnosis, onComplete }) => {
  const [history, setHistory] = useState<{ question: string; answer: string }[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<Partial<DynamicQuestion>>({});
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [customAnswer, setCustomAnswer] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const initAudit = async () => {
      setIsLoading(true);
      try {
        const firstQuestion = await getNextConsultantQuestion([], initialDiagnosis);
        setCurrentQuestion(firstQuestion);
      } catch (e) { console.error(e); } finally { setIsLoading(false); }
    };
    initAudit();
  }, [initialDiagnosis.selectedProduct]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [history, isLoading]);

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
      if (next.isComplete || history.length >= 7) {
        onComplete(newHistory);
      } else {
        setCurrentQuestion(next);
      }
    } catch (error) { onComplete(newHistory); } finally { setIsLoading(false); }
  };

  return (
    <div className="bg-white rounded-2xl shadow-[0_30px_60px_rgba(0,0,0,0.05)] border border-slate-100 overflow-hidden flex flex-col h-[750px] fade-up">
      <div className="bg-slate-950 p-8 text-white flex justify-between items-center shrink-0 border-b border-indigo-500/20">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
             <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-[0.2em]">ENGINYERIA DE PROCESSOS</h3>
            <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest mt-0.5">Diagnòstic de Flux d'Eficiència (Target 40%)</p>
          </div>
        </div>
        <div className="text-right">
           <div className="inline-block px-3 py-1 bg-indigo-600/20 border border-indigo-500/30 rounded text-[9px] font-bold text-indigo-400 uppercase tracking-widest">
             Sessió Segura v2.5
           </div>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-10 space-y-12 bg-slate-50/30 custom-scrollbar">
        {history.map((item, i) => (
          <div key={i} className="space-y-6 fade-up">
            <div className="flex justify-start">
              <div className="bg-white p-8 rounded-2xl border border-slate-100 shadow-sm max-w-[85%] relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-slate-200" />
                <p className="text-sm font-semibold text-slate-900 leading-relaxed whitespace-pre-wrap">{item.question}</p>
              </div>
            </div>
            <div className="flex justify-end">
              <div className="bg-slate-900 p-6 rounded-2xl text-white max-w-[85%] border-r-4 border-indigo-600 shadow-xl">
                <p className="text-sm font-medium">{item.answer}</p>
              </div>
            </div>
          </div>
        ))}

        {isLoading ? (
          <div className="flex justify-start">
            <div className="flex items-center gap-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest px-8">
              <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-pulse" />
              Recalibrant Motor d'Inferència...
            </div>
          </div>
        ) : (
          <div className="fade-up pb-10">
            <div className="bg-white p-10 rounded-2xl border border-slate-100 shadow-xl space-y-10 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-600 to-slate-900" />
              <h4 className="text-2xl font-bold text-slate-900 leading-tight tracking-tight whitespace-pre-wrap">
                {currentQuestion.question}
              </h4>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {currentQuestion.options?.map((option, idx) => {
                  const isSelected = selectedOptions.includes(option);
                  return (
                    <button
                      key={idx}
                      onClick={() => {
                        if (option === 'Altres...') { setShowCustomInput(!showCustomInput); return; }
                        if (currentQuestion.isMultiSelect) {
                          setSelectedOptions(prev => prev.includes(option) ? prev.filter(o => o !== option) : [...prev, option]);
                        } else { handleFinalSubmit(option); }
                      }}
                      className={`text-left p-6 rounded-xl border transition-all duration-300 flex items-center justify-between group ${
                        isSelected 
                          ? 'bg-slate-900 border-slate-900 text-white shadow-xl scale-[1.02]' 
                          : 'bg-white border-slate-100 text-slate-600 hover:border-indigo-600 hover:bg-indigo-50/30'
                      }`}
                    >
                      <span className="text-xs font-bold uppercase tracking-tight">{option}</span>
                      <div className={`h-4 w-4 rounded-full border transition-all ${isSelected ? 'border-indigo-400 bg-indigo-400' : 'border-slate-200'}`} />
                    </button>
                  );
                })}
              </div>

              {showCustomInput && (
                <textarea
                  autoFocus
                  className="w-full p-6 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-600 transition-all font-medium text-sm text-slate-800 h-32"
                  placeholder="Detalla la teva excepció operativa..."
                  value={customAnswer}
                  onChange={(e) => setCustomAnswer(e.target.value)}
                />
              )}

              <div className="flex flex-col items-end gap-4 pt-6 border-t border-slate-100">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest italic">
                    CONFIRMACIÓ REQUERIDA: He registrat els paràmetres. ¿Procedim a la següent fase del diagnòstic?
                  </p>
                  <button
                    onClick={() => handleFinalSubmit()}
                    disabled={selectedOptions.length === 0 && !customAnswer.trim()}
                    className="bg-indigo-600 text-white px-12 py-5 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all disabled:opacity-30 shadow-xl shadow-indigo-100 btn-premium"
                  >
                    Confirmar i Continuar →
                  </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DynamicConsultant;
