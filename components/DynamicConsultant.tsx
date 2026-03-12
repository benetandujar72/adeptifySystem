
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
  type CurrentQuestionState = Partial<DynamicQuestion> & {
    inputMode?: 'freeText';
    placeholder?: string;
  };
  const [currentQuestion, setCurrentQuestion] = useState<CurrentQuestionState>({});
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [customAnswer, setCustomAnswer] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [wizardStepId, setWizardStepId] = useState<string | null>('audience');
  const [diagnosisForAi, setDiagnosisForAi] = useState<DiagnosisState>(initialDiagnosis);
  const scrollRef = useRef<HTMLDivElement>(null);

  const parseFreeTextAnswers = (text: string): string[] => {
    return text
      .split(/\r?\n|;/g)
      .map(x => x.trim())
      .filter(Boolean);
  };

  const getOtherLabel = () => (language === 'ca' ? 'Altres…' : language === 'eu' ? 'Besteak…' : language === 'en' ? 'Other…' : 'Otros…');

  const isOtherOption = (option: string) => /(^|\b)(altres|otros|besteak|other)(\b|\.|…|\.)/i.test(option);

  const ensureOtherOption = (options?: string[]) => {
    const base = Array.isArray(options) ? options.filter(Boolean) : [];
    if (base.some(isOtherOption)) return base;
    return [...base, getOtherLabel()];
  };

  type WizardStep = {
    id: string;
    question: { ca: string; es: string; eu: string; en: string };
    type: 'select' | 'freeText';
    options?: { ca: string; es: string; eu: string; en: string }[];
    isMultiSelect?: boolean;
    next: (answers: string[]) => string | null;
    applyToDiagnosis?: (answers: string[]) => Partial<DiagnosisState>;
  };

  const getWizardSteps = (): WizardStep[] => {
    const entryMode: WizardStep = {
      id: 'entry_mode',
      question: {
        ca: 'Com vols començar? ',
        es: '¿Cómo quieres empezar?',
        eu: 'Nola hasi nahi duzu?',
        en: 'How would you like to start?',
      },
      type: 'select',
      options: [
        { ca: 'Vull que em guieu per definir-ho', es: 'Quiero que me guiéis para definirlo', eu: 'Definitzen laguntzea nahi dut', en: 'I want you to guide me to define it' },
        { ca: 'Ho tinc clar i vull concretar requisits', es: 'Lo tengo claro y quiero concretar requisitos', eu: 'Argi daukat eta eskakizunak zehaztu nahi ditut', en: 'I know what I need and want to specify requirements' },
      ],
      isMultiSelect: false,
      next: (answers) => {
        const a = answers.join(' ').toLowerCase();
        if (a.includes('clar') || a.includes('requis') || a.includes('concret') || a.includes('know what') || a.includes('specif')) return 'clear_need_brief';
        return 'audience';
      },
      applyToDiagnosis: (answers) => {
        const a = answers.join(' ').toLowerCase();
        if (a.includes('clar') || a.includes('requis') || a.includes('concret') || a.includes('know what') || a.includes('specif')) return { intakeMode: 'clear_need' };
        return { intakeMode: 'discovery' };
      },
    };

    const audienceStep: WizardStep = {
      id: 'audience',
      question: {
        ca: "Abans de començar: qui demana ajuda avui?",
        es: "Antes de empezar: ¿quién solicita ayuda hoy?",
        eu: "Hasi aurretik: nork eskatzen du laguntza gaur?",
        en: "Before we begin: who is asking for help today?",
      },
      type: 'select',
      options: [
        { ca: 'Centre educatiu', es: 'Centro educativo', eu: 'Ikastetxea', en: 'Educational centre' },
        { ca: 'Família', es: 'Familia', eu: 'Familia', en: 'Family' },
        { ca: 'Altres…', es: 'Otros…', eu: 'Besteak…', en: 'Other…' },
      ],
      isMultiSelect: false,
      next: (answers) => {
        const a = answers.join(' ').toLowerCase();
        if (a.includes('fam')) return 'goal_family';
        if (a.includes('centre') || a.includes('coleg') || a.includes('instit') || a.includes('ikast') || a.includes('eskola') || a.includes('educational')) return 'goal_school';
        return 'goal_generic';
      },
      applyToDiagnosis: (answers) => {
        const a = answers.join(' ').toLowerCase();
        if (a.includes('fam')) return { category: 'FAMILIA' };
        if (a.includes('centre') || a.includes('coleg') || a.includes('instit') || a.includes('ikast') || a.includes('eskola') || a.includes('educational')) return { category: 'CENTRO' };
        return { category: 'OTRO' };
      },
    };

    const clearNeedBrief: WizardStep = {
      id: 'clear_need_brief',
      question: {
        ca: "Descriu què necessiteu (amb les teves paraules). Exemple: app de fitxatge + gestió de guàrdies, correus automàtics a substitut/substituït, informació d'alumnes i instruccions de guàrdia.",
        es: 'Describe lo que necesitáis (con tus palabras). Ejemplo: app de fichaje + gestión de guardias, emails automáticos a sustituto/sustituido, info del alumnado y las instrucciones de guardia.',
        eu: 'Azaldu zer behar duzuen (zure hitzekin). Adib.: fitxaketa-app + guardien kudeaketa, ordezkoari/ordezkatuari email automatikoak, ikasleen informazioa eta guardiaren jarraibideak.',
        en: 'Describe what you need (in your own words). Example: attendance app + cover management, automatic emails to substitute/covered teacher, student info and cover instructions.',
      },
      type: 'freeText',
      // After the brief, switch to fully dynamic (Gemini) requirements intake.
      next: () => null,
    };

    const goalCommon = {
      type: 'select',
      isMultiSelect: true,
      next: () => 'urgency',
    } as const;

    const goalSchool: WizardStep = {
      id: 'goal_school',
      question: {
        ca: "Què us agradaria millorar primer? (Pots marcar més d'una opció)",
        es: "¿Qué te gustaría mejorar primero? (Puedes marcar más de una opción)",
        eu: "Zer hobetu nahi zenuke lehenengo? (Aukera bat baino gehiago marka dezakezu)",
        en: "What would you like to improve first? (You can select more than one option)",
      },
      options: [
        { ca: 'Reduir paperassa i burocràcia', es: 'Reducir papeleo y burocracia', eu: 'Paper-lana eta burokrazia murriztea', en: 'Reduce paperwork and bureaucracy' },
        { ca: 'Comunicació amb famílies', es: 'Comunicación con familias', eu: 'Familiekin komunikazioa', en: 'Communication with families' },
        { ca: "Seguiment de l'alumnat", es: 'Seguimiento del alumnado', eu: 'Ikasleen jarraipena', en: 'Student tracking and follow-up' },
        { ca: 'Organitzar reunions i tasques', es: 'Organizar reuniones y tareas', eu: 'Bilerak eta zereginak antolatzea', en: 'Organise meetings and tasks' },
        { ca: 'Altres…', es: 'Otros…', eu: 'Besteak…', en: 'Other…' },
      ],
      ...goalCommon,
    };

    const goalFamily: WizardStep = {
      id: 'goal_family',
      question: {
        ca: "Quina és la necessitat principal a casa? (Pots marcar més d'una opció)",
        es: "¿Cuál es la necesidad principal en casa? (Puedes marcar más de una opción)",
        eu: "Zein da etxean dagoen behar nagusia? (Aukera bat baino gehiago marka dezakezu)",
        en: "What is the main need at home? (You can select more than one option)",
      },
      options: [
        { ca: 'Organització i rutines', es: 'Organización y rutinas', eu: 'Antolaketa eta errutinak', en: 'Organisation and routines' },
        { ca: 'Comunicació familiar', es: 'Comunicación familiar', eu: 'Familia-komunikazioa', en: 'Family communication' },
        { ca: "Acompanyament a l'estudi", es: 'Acompañamiento en el estudio', eu: 'Ikasketetan laguntza', en: 'Study support' },
        { ca: 'Gestió emocional i convivència', es: 'Gestión emocional y convivencia', eu: 'Emozioen kudeaketa eta elkarbizitza', en: 'Emotional management and coexistence' },
        { ca: 'Altres…', es: 'Otros…', eu: 'Besteak…', en: 'Other…' },
      ],
      ...goalCommon,
    };

    const goalGeneric: WizardStep = {
      id: 'goal_generic',
      question: {
        ca: "Quin objectiu voleu assolir? (Pots marcar més d'una opció)",
        es: "¿Qué objetivo queréis conseguir? (Puedes marcar más de una opción)",
        eu: "Zein helburu lortu nahi duzue? (Aukera bat baino gehiago marka dezakezu)",
        en: "What objective do you want to achieve? (You can select more than one option)",
      },
      options: [
        { ca: 'Estalviar temps', es: 'Ahorrar tiempo', eu: 'Denbora aurreztea', en: 'Save time' },
        { ca: 'Millorar organització', es: 'Mejorar organización', eu: 'Antolaketa hobetzea', en: 'Improve organisation' },
        { ca: 'Millorar comunicació', es: 'Mejorar comunicación', eu: 'Komunikazioa hobetzea', en: 'Improve communication' },
        { ca: 'Altres…', es: 'Otros…', eu: 'Besteak…', en: 'Other…' },
      ],
      ...goalCommon,
    };

    const urgency: WizardStep = {
      id: 'urgency',
      question: {
        ca: 'Quina urgència té?',
        es: '¿Qué urgencia tiene?',
        eu: 'Zer urgentzia dauka?',
        en: 'How urgent is this?',
      },
      type: 'select',
      options: [
        { ca: 'Aquesta setmana', es: 'Esta semana', eu: 'Aste honetan', en: 'This week' },
        { ca: 'Aquest mes', es: 'Este mes', eu: 'Hilabete honetan', en: 'This month' },
        { ca: 'Aquest trimestre', es: 'Este trimestre', eu: 'Hiruhileko honetan', en: 'This term' },
        { ca: 'Sense urgència', es: 'Sin urgencia', eu: 'Premiarik gabe', en: 'No urgency' },
      ],
      isMultiSelect: false,
      next: () => 'constraints',
    };

    const constraints: WizardStep = {
      id: 'constraints',
      question: {
        ca: "Hi ha alguna limitació important? (Pots marcar més d'una opció)",
        es: "¿Hay alguna limitación importante? (Puedes marcar más de una opción)",
        eu: "Badago muga garrantzitsuren bat? (Aukera bat baino gehiago marka dezakezu)",
        en: "Are there any important limitations? (You can select more than one option)",
      },
      type: 'select',
      options: [
        { ca: 'Poc temps', es: 'Poco tiempo', eu: 'Denbora gutxi', en: 'Limited time' },
        { ca: 'Pressupost ajustat', es: 'Presupuesto ajustado', eu: 'Aurrekontu estua', en: 'Tight budget' },
        { ca: 'Resistència al canvi', es: 'Resistencia al cambio', eu: 'Aldaketarekiko erresistentzia', en: 'Resistance to change' },
        { ca: 'Privacitat i dades sensibles', es: 'Privacidad y datos sensibles', eu: 'Pribatutasuna eta datu sentikorrak', en: 'Privacy and sensitive data' },
        { ca: 'Altres…', es: 'Otros…', eu: 'Besteak…', en: 'Other…' },
      ],
      isMultiSelect: true,
      next: () => null,
    };

    return [entryMode, audienceStep, clearNeedBrief, goalSchool, goalFamily, goalGeneric, urgency, constraints];
  };

  const getWizardStep = (id: string | null): WizardStep | null => {
    if (!id) return null;
    return getWizardSteps().find(s => s.id === id) || null;
  };

  const pushWizardQuestion = (step: WizardStep) => {
    const q = language === 'ca' ? step.question.ca : language === 'eu' ? step.question.eu : language === 'en' ? step.question.en : step.question.es;
    const opts = step.options?.map(o => (language === 'ca' ? o.ca : language === 'eu' ? o.eu : language === 'en' ? o.en : o.es));
    setCurrentQuestion({
      question: q,
      options: opts,
      isMultiSelect: !!step.isMultiSelect,
      isComplete: false,
      confidence: 100,
      inputMode: step.type === 'freeText' ? 'freeText' : undefined,
      placeholder: step.type === 'freeText' ? t.consultantTellMore : undefined,
    });
  };

  useEffect(() => {
    // Start with the local adaptive wizard, then continue with Gemini questions.
    setHistory([]);
    setSelectedOptions([]);
    setCustomAnswer('');
    setShowCustomInput(false);
    setDiagnosisForAi(initialDiagnosis);
    setWizardStepId('entry_mode');
    const step = getWizardStep('entry_mode');
    if (step) pushWizardQuestion(step);
    setIsLoading(false);
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

    // Wizard path (local adaptive steps)
    if (wizardStepId) {
      const step = getWizardStep(wizardStepId);
      const nextId = step?.next(answers) ?? null;
      if (step?.applyToDiagnosis) {
        setDiagnosisForAi(prev => ({ ...prev, ...step.applyToDiagnosis!(answers) }));
      }

      if (nextId) {
        setWizardStepId(nextId);
        const nextStep = getWizardStep(nextId);
        if (nextStep) pushWizardQuestion(nextStep);
        return;
      }

      // Wizard complete → switch to Gemini questions
      setWizardStepId(null);
      setIsLoading(true);
      try {
        const next = await getNextConsultantQuestion(newHistory, diagnosisForAi, language);
        setCurrentQuestion(next);
      } catch (e) {
        console.error(e);
        onComplete(newHistory);
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // Gemini path
    setIsLoading(true);
    try {
      const next = await getNextConsultantQuestion(newHistory, diagnosisForAi, language);
      const maxQuestions = diagnosisForAi?.intakeMode === 'clear_need' ? 25 : 7;
      if (next.isComplete || history.length >= maxQuestions) {
        onComplete(newHistory);
      } else {
        setCurrentQuestion(next);
      }
    } catch (error) {
      onComplete(newHistory);
    } finally {
      setIsLoading(false);
    }
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

              {currentQuestion.inputMode === 'freeText' || !(currentQuestion.options && currentQuestion.options.length) ? (
                <textarea
                  autoFocus
                  className="w-full p-6 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-600 transition-all font-medium text-sm text-slate-800 h-40"
                  placeholder={currentQuestion.placeholder || t.consultantTellMore}
                  value={customAnswer}
                  onChange={(e) => setCustomAnswer(e.target.value)}
                />
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {ensureOtherOption(currentQuestion.options)?.map((option, idx) => {
                      const other = isOtherOption(option);
                      const isSelected = selectedOptions.includes(option) || (other && showCustomInput);
                      return (
                        <button
                          key={idx}
                          onClick={() => {
                            if (other) { setShowCustomInput(!showCustomInput); return; }
                            // Multichoice: always toggle selection; advance only via "Continuar".
                            setSelectedOptions(prev => prev.includes(option) ? prev.filter(o => o !== option) : [...prev, option]);
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
                </>
              )}

              <div className="flex flex-col items-end gap-4 pt-6 border-t border-slate-100">
                  <button
                    onClick={() => {
                      if (currentQuestion.inputMode === 'freeText' || !(currentQuestion.options && currentQuestion.options.length)) {
                        handleFinalSubmit(customAnswer);
                        return;
                      }
                      handleFinalSubmit();
                    }}
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
