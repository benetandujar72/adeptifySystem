
import React, { useState, useEffect, useRef } from 'react';
import { DiagnosisState } from '../types';
import { getNextConsultantQuestion, DynamicQuestion } from '../services/geminiService';
import { useLanguage } from '../LanguageContext';

interface DynamicConsultantProps {
  initialDiagnosis: DiagnosisState;
  onComplete: (history: { question: string; answer: string[] }[]) => void;
}

const DynamicConsultant: React.FC<DynamicConsultantProps> = ({ initialDiagnosis, onComplete }) => {
  const { language, t } = useLanguage();
  const [history, setHistory] = useState<{ question: string; answer: string[] }[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<Partial<DynamicQuestion>>({});
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [customAnswer, setCustomAnswer] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const parseFreeTextAnswers = (text: string): string[] => {
    return text
      .split(/\r?\n|;/g)
      .map(x => x.trim())
      .filter(Boolean);
  };

  useEffect(() => {
    const initAudit = async () => {
      setIsLoading(true);
      try {
        const firstQuestion = await getNextConsultantQuestion([], initialDiagnosis, language);
        setCurrentQuestion(firstQuestion);
      } catch (e) { console.error(e); } finally { setIsLoading(false); }
    };
    initAudit();
  }, [initialDiagnosis.selectedProduct, language]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [history, isLoading]);

  const handleFinalSubmit = async (finalAnswer?: string) => {
    let answers: string[] = [];
    if (finalAnswer) {
      answers = [finalAnswer];
    } else {
      answers = [...selectedOptions];
      if (customAnswer.trim()) answers.push(...parseFreeTextAnswers(customAnswer));
    }
    answers = answers.map(a => a.trim()).filter(Boolean);
    if (answers.length === 0 || isLoading) return;

    const newHistory = [...history, { question: currentQuestion.question!, answer: answers }];
    setHistory(newHistory);
    setSelectedOptions([]);
    setCustomAnswer('');
    setShowCustomInput(false);
    setIsLoading(true);

    try {
      const next = await getNextConsultantQuestion(newHistory, initialDiagnosis, language);
      if (next.isComplete || history.length >= 7) {
        onComplete(newHistory);
      } else {
        setCurrentQuestion(next);
      }
    } catch (error) { onComplete(newHistory); } finally { setIsLoading(false); }
  };

  return (
    <div className="bg-white rounded-[2rem] shadow-[0_30px_60px_rgba(0,0,0,0.05)] border border-slate-100 overflow-hidden flex flex-col h-[750px] fade-up">
      <div className="bg-slate-950 p-8 text-white flex justify-between items-center shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
             <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-[0.2em]">{t.consultantTitle}</h3>
            <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest mt-0.5">{t.consultantSubtitle}</p>
            {!!currentQuestion.modelUsed && (
              <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-1">{t.modelLabel}: {currentQuestion.modelUsed}</p>
            )}
          </div>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-10 space-y-12 bg-slate-50/30 custom-scrollbar">
        {history.map((item, i) => (
          <div key={i} className="space-y-6 fade-up">
            <div className="flex justify-start">
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm max-w-[85%] relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500" />
                <p className="text-sm font-medium text-slate-700 leading-relaxed whitespace-pre-wrap">{item.question}</p>
              </div>
            </div>
            <div className="flex justify-end">
              <div className="bg-slate-900 p-5 rounded-2xl text-white max-w-[85%] shadow-xl">
                <p className="text-sm font-medium whitespace-pre-wrap">{item.answer.join('\n')}</p>
              </div>
            </div>
          </div>
        ))}

        {isLoading ? (
          <div className="flex justify-start">
            <div className="flex items-center gap-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest px-8">
              <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-pulse" />
              {t.consultantPreparing}
            </div>
          </div>
        ) : (
          <div className="fade-up pb-10">
            <div className="bg-white p-10 rounded-2xl border border-slate-100 shadow-xl space-y-8 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-indigo-600" />
              <h4 className="text-2xl font-serif italic text-slate-900 leading-tight tracking-tight">
                {currentQuestion.question}
              </h4>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {currentQuestion.options?.map((option, idx) => {
                  const isSelected = selectedOptions.includes(option);
                  return (
                    <button
                      key={idx}
                      onClick={() => {
                        if (option.includes('Altres') || option.includes('Otros')) { setShowCustomInput(!showCustomInput); return; }
                        if (currentQuestion.isMultiSelect) {
                          setSelectedOptions(prev => prev.includes(option) ? prev.filter(o => o !== option) : [...prev, option]);
                        } else { handleFinalSubmit(option); }
                      }}
                      className={`text-left p-6 rounded-xl border transition-all duration-300 flex items-center justify-between group ${
                        isSelected 
                          ? 'bg-indigo-600 border-indigo-600 text-white shadow-xl scale-[1.02]' 
                          : 'bg-white border-slate-100 text-slate-600 hover:border-indigo-600 hover:bg-indigo-50'
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
                  placeholder={t.consultantTellMore}
                  value={customAnswer}
                  onChange={(e) => setCustomAnswer(e.target.value)}
                />
              )}

              <div className="flex flex-col items-end gap-4 pt-6 border-t border-slate-100">
                  <button
                    onClick={() => handleFinalSubmit()}
                    disabled={selectedOptions.length === 0 && !customAnswer.trim()}
                    className="bg-slate-950 text-white px-12 py-5 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all disabled:opacity-30 shadow-xl"
                  >
                      {t.consultantContinue}
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
