
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
  const [confidence, setConfidence] = useState(10);
  const scrollRef = useRef<HTMLDivElement>(null);

  const auditMessages = [
    "Carregant mòduls especialitzats...",
    "Sincronitzant base de dades Adeptify...",
    "Inicialitzant motor d'enginyeria...",
    "Projectant diagnòstic de producte..."
  ];

  const [currentStatus, setCurrentStatus] = useState(auditMessages[0]);

  // Carrega la primera pregunta segons el producte triat
  useEffect(() => {
    const initAudit = async () => {
      setIsLoading(true);
      try {
        const firstQuestion = await getNextConsultantQuestion([], initialDiagnosis);
        setCurrentQuestion(firstQuestion);
        setConfidence(firstQuestion.confidence);
      } catch (e) {
        console.error("Error inicialitzant auditoria");
      } finally {
        setIsLoading(false);
      }
    };
    initAudit();
  }, [initialDiagnosis.selectedProduct]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [history, isLoading]);

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
      
      if (next.isComplete || history.length >= 6) {
        onComplete(newHistory);
      } else {
        setCurrentQuestion(next);
        setConfidence(next.confidence);
      }
    } catch (error) {
      onComplete(newHistory);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-[2.5rem] shadow-premium border border-slate-200 overflow-hidden flex flex-col h-[750px] animate-in zoom-in-95 duration-700">
      <div className="bg-slate-900 p-10 text-white flex justify-between items-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-indigo-500" />
        <div className="flex items-center gap-6 relative z-10">
          <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-2xl">
             <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          </div>
          <div>
            <h3 className="text-lg font-black uppercase tracking-[0.3em]">Auditoria: {initialDiagnosis.selectedProduct}</h3>
            <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest mt-0.5">Sessió d'Enginyeria Activa</p>
          </div>
        </div>
        <div className="text-right flex flex-col items-end relative z-10">
          <div className="flex items-baseline gap-2 mb-1.5">
            <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Nivell de Detall:</span>
            <span className="text-2xl font-brand italic text-white">{confidence}%</span>
          </div>
          <div className="w-56 h-1 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-indigo-500 rounded-full transition-all duration-1000 ease-out" style={{ width: `${confidence}%` }} />
          </div>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-10 space-y-10 bg-[#FBFDFF] custom-scrollbar">
        {history.map((item, i) => (
          <div key={i} className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
            <div className="flex justify-start">
              <div className="bg-white p-8 rounded-[2rem] rounded-tl-none border border-slate-200 shadow-sm max-w-[80%]">
                <span className="text-[9px] font-black text-indigo-600 uppercase mb-2 block tracking-widest">Consultor Adeptify</span>
                <p className="text-md font-medium text-slate-800 leading-relaxed">{item.question}</p>
              </div>
            </div>
            <div className="flex justify-end">
              <div className="bg-slate-900 p-8 rounded-[2rem] rounded-tr-none text-white shadow-xl max-w-[80%] border-l-4 border-indigo-600">
                <p className="text-md font-bold leading-relaxed">{item.answer}</p>
              </div>
            </div>
          </div>
        ))}

        {isLoading ? (
          <div className="flex justify-start">
            <div className="bg-white p-8 rounded-3xl border border-slate-100 flex items-center gap-3 shadow-sm">
              <div className="w-2 h-2 bg-indigo-600 rounded-full animate-ping" />
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{currentStatus}</span>
            </div>
          </div>
        ) : (
          <div className="space-y-8 animate-in slide-in-from-left-6 pb-10">
            <div className="bg-white p-10 rounded-[2.5rem] rounded-tl-none border border-slate-200 shadow-premium">
              <h4 className="text-2xl font-black text-slate-900 leading-tight mb-10 tracking-tight">{currentQuestion.question}</h4>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {currentQuestion.options?.map((option, idx) => {
                  const isSelected = selectedOptions.includes(option);
                  return (
                    <button
                      key={idx}
                      onClick={() => toggleOption(option)}
                      className={`text-left p-6 rounded-2xl border transition-all duration-300 flex items-center justify-between group ${
                        isSelected 
                          ? 'bg-slate-900 border-slate-900 text-white shadow-xl' 
                          : 'bg-white border-slate-100 text-slate-600 hover:border-indigo-600 hover:bg-indigo-50/20'
                      }`}
                    >
                      <span className={`text-[11px] font-bold uppercase tracking-tight ${isSelected ? 'text-white' : 'text-slate-700'}`}>{option}</span>
                      <div className={`h-5 w-5 rounded-full border flex items-center justify-center transition-all ${isSelected ? 'border-indigo-400 bg-indigo-400' : 'border-slate-200'}`} />
                    </button>
                  );
                })}
              </div>

              {showCustomInput && (
                <div className="mt-8 animate-in fade-in slide-in-from-top-4">
                  <textarea
                    autoFocus
                    className="w-full p-8 bg-slate-50 border border-slate-200 rounded-[2rem] outline-none focus:border-indigo-600 transition-all font-medium text-sm text-slate-800 shadow-inner"
                    placeholder="Especifiqueu detalls addicionals..."
                    value={customAnswer}
                    onChange={(e) => setCustomAnswer(e.target.value)}
                  />
                </div>
              )}

              <div className="mt-12 flex justify-between items-center border-t border-slate-50 pt-10">
                 <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-indigo-600 rounded-full" />
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">IA Conextualitzada</span>
                 </div>
                  <button
                    onClick={() => handleFinalSubmit()}
                    disabled={selectedOptions.length === 0 && !customAnswer.trim()}
                    className="bg-slate-900 text-white px-16 py-5 rounded-2xl font-black text-[10px] uppercase tracking-[0.4em] hover:bg-indigo-600 transition-all disabled:opacity-30 shadow-2xl active:scale-95"
                  >
                    Confirmar Resposta →
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
