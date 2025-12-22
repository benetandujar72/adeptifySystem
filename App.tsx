
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Phase, DiagnosisState, ProposalData, Consultation, DiagnosisMode } from './types';
import { QUESTIONS_FLOW, SYMPTOM_OPTIONS } from './constants';
import TriageStep from './components/TriageStep';
import Proposal from './components/Proposal';
import FileUpload from './components/FileUpload';
import TaskManager from './components/TaskManager';
import AdeptifyChat from './components/AdeptifyChat';
import ProcessingScreen from './components/ProcessingScreen';
import AdminRegistry from './components/AdminRegistry';
import SelectionScreen from './components/SelectionScreen';
import DocGenerator from './components/DocGenerator';
import DynamicConsultant from './components/DynamicConsultant';
import { generateEducationalProposal } from './services/geminiService';
import { consultationService } from './services/consultationService';

const App: React.FC = () => {
  const [phase, setPhase] = useState<Phase>(Phase.LANDING);
  const [stepIndex, setStepIndex] = useState(0); 
  const [diagnosis, setDiagnosis] = useState<DiagnosisState>({
    category: '',
    categories: [],
    symptom: '',
    volume: '',
    platform: '',
    wantsMiniApp: false,
    centerName: '',
    contactEmail: '',
    specificDetails: '',
    consultationHistory: []
  });
  const [currentConsultation, setCurrentConsultation] = useState<Consultation | null>(null);
  const [proposal, setProposal] = useState<ProposalData | null>(null);
  const [isProcessingVisual, setIsProcessingVisual] = useState(false);
  const [pendingProposal, setPendingProposal] = useState<ProposalData | null>(null);
  const [isAnimationFinished, setIsAnimationFinished] = useState(false);

  useEffect(() => {
    if (isAnimationFinished && pendingProposal) {
      setProposal(pendingProposal);
      setIsProcessingVisual(false);
      setPhase(Phase.PROPOSAL);
      setIsAnimationFinished(false);
    }
  }, [isAnimationFinished, pendingProposal]);

  const filteredQuestions = useMemo(() => {
    // Si estem en mode ràpid (QUICK), potser volem filtrar més, però per ara mantenim el flux simplificat
    return QUESTIONS_FLOW.filter(q => [1, 7, 8].includes(q.id));
  }, []);

  const handleChoice = (choice: DiagnosisMode | 'DOCS') => {
    if (choice === 'DOCS') {
      setPhase(Phase.DOC_GENERATOR);
    } else {
      setStepIndex(0);
      setDiagnosis(prev => ({ ...prev, mode: choice }));
      setPhase(Phase.DIAGNOSIS);
    }
  };

  const handleStepSelect = async (value: string) => {
    const currentQuestion = filteredQuestions[stepIndex];
    let updatedDiagnosis = { ...diagnosis };

    switch(currentQuestion.id) {
      case 1: 
        updatedDiagnosis.category = value; 
        updatedDiagnosis.categories = value.split(',');
        break;
      case 7: updatedDiagnosis.centerName = value; break;
      case 8: updatedDiagnosis.contactEmail = value; break;
    }
    setDiagnosis(updatedDiagnosis);

    if (stepIndex + 1 < filteredQuestions.length) {
      setStepIndex(stepIndex + 1);
    } else {
      // Un cop tenim les àrees base i contacte, el consultor intel·ligent agafa el relleu
      setPhase(Phase.DYNAMIC_DIAGNOSIS);
    }
  };

  const handleDynamicComplete = async (history: { question: string; answer: string }[]) => {
    const finalDiagnosis = { ...diagnosis, consultationHistory: history };
    setDiagnosis(finalDiagnosis);
    setIsProcessingVisual(true);
    setIsAnimationFinished(false);
    setPendingProposal(null);
    
    try {
      const generated = await generateEducationalProposal(finalDiagnosis);
      setPendingProposal(generated);
      const cons = consultationService.saveConsultation(finalDiagnosis, generated);
      setCurrentConsultation(cons);
    } catch (error) {
      console.error("Error Gemini:", error);
      setIsProcessingVisual(false);
      alert("Error de connexió.");
    }
  };

  const onProcessingComplete = useCallback(() => {
    setIsAnimationFinished(true);
  }, []);

  const handleAcceptProposal = (planName: string) => {
    if (currentConsultation) {
      consultationService.updateConsultation(currentConsultation.id, { selectedPlanName: planName });
    }
    setPhase(Phase.ACTION);
  };

  const getCurrentQuestion = () => {
    return filteredQuestions[stepIndex];
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 md:p-8 relative">
      <header className="fixed top-0 w-full p-6 flex justify-between items-center z-10">
        <div 
          className="bg-white/90 backdrop-blur-md px-6 py-3 rounded-full border border-slate-200 shadow-2xl flex items-center gap-3 cursor-pointer hover:scale-105 transition-all" 
          onClick={() => { setPhase(Phase.LANDING); setStepIndex(0); setProposal(null); setPendingProposal(null); }}
        >
          <div className="w-2.5 h-2.5 rounded-full bg-indigo-600 animate-pulse" />
          <span className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-800">Adeptify Systems</span>
        </div>
      </header>

      <main className={`w-full ${[Phase.DASHBOARD, Phase.ADMIN, Phase.PROPOSAL, Phase.DOC_GENERATOR, Phase.DYNAMIC_DIAGNOSIS].includes(phase) ? 'max-w-6xl' : 'max-w-xl'} mt-24 mb-24`}>
        {phase === Phase.LANDING && <SelectionScreen onChoice={handleChoice} />}

        {phase === Phase.DIAGNOSIS && (
          <div className="bg-white p-10 md:p-16 rounded-[3rem] shadow-2xl shadow-indigo-100 border border-slate-100 relative overflow-hidden animate-in zoom-in-95 duration-500">
            <div className="absolute top-0 left-0 w-full h-2 bg-slate-50">
              <div 
                className="h-full bg-indigo-600 transition-all duration-700 ease-out" 
                style={{ width: `${((stepIndex + 1) / filteredQuestions.length) * 100}%` }}
              />
            </div>
            {getCurrentQuestion() && (
              <TriageStep 
                question={getCurrentQuestion()} 
                onSelect={handleStepSelect}
                isLast={false}
              />
            )}
          </div>
        )}

        {phase === Phase.DYNAMIC_DIAGNOSIS && (
          isProcessingVisual ? (
            <ProcessingScreen centerName={diagnosis.centerName} onComplete={onProcessingComplete} />
          ) : (
            <DynamicConsultant 
              initialDiagnosis={diagnosis} 
              onComplete={handleDynamicComplete} 
            />
          )
        )}

        {phase === Phase.DOC_GENERATOR && <DocGenerator />}

        {phase === Phase.PROPOSAL && proposal && (
          <div className="space-y-10">
            <div className="text-center space-y-3">
              <span className="bg-green-100 text-green-700 text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-[0.2em] shadow-sm">
                Arquitectura Predictiva Validada
              </span>
              <h1 className="text-4xl font-black text-slate-900 tracking-tight">Estratègia per a {diagnosis.centerName}</h1>
            </div>
            <Proposal data={proposal} onAccept={handleAcceptProposal} />
          </div>
        )}

        {phase === Phase.ADMIN && <AdminRegistry />}
        {phase === Phase.ACTION && <FileUpload />}
        {phase === Phase.DASHBOARD && <TaskManager />}
      </main>

      <AdeptifyChat centerId={diagnosis.centerName || 'general'} />
    </div>
  );
};

export default App;
