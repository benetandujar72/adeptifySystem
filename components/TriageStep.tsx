
import React, { useState } from 'react';
import { Question } from '../types';
import { useLanguage } from '../LanguageContext';

interface TriageStepProps {
  question: Question;
  onSelect: (value: string) => void;
  isLast?: boolean;
}

const TriageStep: React.FC<TriageStepProps> = ({ question, onSelect, isLast }) => {
  const { t } = useLanguage();
  const [textValue, setTextValue] = useState('');
  const [selectedValues, setSelectedValues] = useState<string[]>([]);

  const handleSubmitText = (e: React.FormEvent) => {
    e.preventDefault();
    if (textValue.trim()) {
      onSelect(textValue);
      setTextValue('');
    }
  };

  const toggleOption = (val: string) => {
    if (question.isMultiSelect) {
      setSelectedValues(prev => 
        prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]
      );
    } else {
      onSelect(val);
    }
  };

  const handleConfirmMulti = () => {
    if (selectedValues.length > 0) {
      onSelect(selectedValues.join(','));
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-6 duration-700">
      <div className="mb-10">
        <span className="text-[9px] font-black text-indigo-600 uppercase tracking-[0.4em] mb-4 block">{t.triageStepBadge}</span>
        <h2 className="text-3xl font-black text-slate-900 leading-tight">
          {question.text}
        </h2>
      </div>
      
      {question.type === 'select' ? (
        <div className="grid gap-4">
          {question.options?.map((option) => {
            const isSelected = selectedValues.includes(option.value);
            return (
              <button
                key={option.value}
                onClick={() => toggleOption(option.value)}
                className={`w-full text-left p-6 rounded-2xl border transition-all duration-300 flex items-center justify-between group ${
                  isSelected 
                    ? 'border-indigo-600 bg-indigo-50/30 ring-1 ring-indigo-600' 
                    : 'border-slate-200 bg-white hover:border-slate-400 hover:bg-slate-50'
                }`}
              >
                <span className={`text-[13px] font-bold uppercase tracking-tight ${isSelected ? 'text-indigo-900' : 'text-slate-700'}`}>
                  {option.label}
                </span>
                <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center transition-all ${
                  isSelected ? 'border-indigo-600 bg-indigo-600' : 'border-slate-200 bg-slate-50'
                }`}>
                  <svg className={`w-3 h-3 text-white transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </button>
            );
          })}

          {question.isMultiSelect && (
            <button
              onClick={handleConfirmMulti}
              disabled={selectedValues.length === 0}
              className="mt-10 w-full bg-slate-900 text-white font-black py-5 rounded-2xl hover:bg-indigo-600 transition-all disabled:opacity-30 shadow-2xl shadow-slate-200 uppercase text-[10px] tracking-[0.3em] active:scale-95"
            >
              {t.triageConfirm}
            </button>
          )}
        </div>
      ) : (
        <form onSubmit={handleSubmitText} className="space-y-6">
          {question.type === 'textarea' ? (
            <textarea
              autoFocus
              className="w-full p-6 rounded-2xl border border-slate-200 focus:border-indigo-600 outline-none text-sm font-medium transition-all h-40 bg-white shadow-inner"
              placeholder={question.placeholder}
              aria-label={question.text}
              value={textValue}
              onChange={(e) => setTextValue(e.target.value)}
            />
          ) : (
            <input
              type={question.type === 'email' ? 'email' : 'text'}
              autoFocus
              className="w-full p-6 rounded-2xl border border-slate-200 focus:border-indigo-600 outline-none text-lg font-black tracking-tight transition-all bg-white"
              placeholder={question.placeholder}
              aria-label={question.text}
              value={textValue}
              onChange={(e) => setTextValue(e.target.value)}
            />
          )}
          <button 
            type="submit"
            disabled={!textValue.trim()}
            className="w-full bg-slate-900 text-white font-black py-5 rounded-2xl hover:bg-indigo-600 transition-all disabled:opacity-50 shadow-2xl shadow-slate-200 uppercase text-[10px] tracking-[0.3em]"
          >
            {t.triageNext}
          </button>
        </form>
      )}

      <div className="mt-16 pt-8 border-t border-slate-100 flex items-center justify-between">
        <p className="text-[9px] text-slate-400 font-black uppercase tracking-[0.2em]">
          {isLast ? t.triageFooterLast : t.triageFooterProgress}
        </p>
        <div className="flex gap-1">
            <div className="w-1 h-1 bg-slate-200 rounded-full" />
            <div className="w-1 h-1 bg-slate-200 rounded-full" />
            <div className="w-1 h-1 bg-indigo-500 rounded-full" />
        </div>
      </div>
    </div>
  );
};

export default TriageStep;
