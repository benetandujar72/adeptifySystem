
import React, { useState, useCallback, useEffect } from 'react';
import { Phase, DiagnosisState, ProposalData, ProductType } from './types';
import SelectionScreen from './components/SelectionScreen';
import DynamicConsultant from './components/DynamicConsultant';
import Proposal from './components/Proposal';
import ProcessingScreen from './components/ProcessingScreen';
import AdeptifyChat from './components/AdeptifyChat';
import DocGenerator from './components/DocGenerator';
import { generateEducationalProposal } from './services/geminiService';

const App: React.FC = () => {
  const [phase, setPhase] = useState<Phase>(Phase.LANDING);
  const [diagnosis, setDiagnosis] = useState<DiagnosisState>({
    centerName: '',
    contactEmail: '',
    consultationHistory: []
  });
  const [proposal, setProposal] = useState<ProposalData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleProductChoice = (product: ProductType | 'DOCS') => {
    if (product === 'DOCS') {
      setPhase(Phase.DOC_GENERATOR);
      return;
    }
    
    // Inicialitzem el diagnòstic amb el producte escollit
    setDiagnosis(prev => ({ 
      ...prev, 
      selectedProduct: product,
      consultationHistory: [] 
    }));
    setPhase(Phase.DYNAMIC_DIAGNOSIS);
  };

  const handleAuditComplete = async (history: { question: string; answer: string }[]) => {
    const finalDiagnosis = { ...diagnosis, consultationHistory: history };
    setDiagnosis(finalDiagnosis);
    setIsProcessing(true);
    
    try {
      const generated = await generateEducationalProposal(finalDiagnosis);
      setProposal(generated);
      setPhase(Phase.PROPOSAL);
    } catch (error) {
      console.error("Error generant proposta:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 md:p-8 relative">
      <header className="fixed top-0 w-full p-6 flex justify-between items-center z-10">
        <div 
          className="bg-white/90 backdrop-blur-md px-6 py-3 rounded-full border border-slate-200 shadow-2xl flex items-center gap-3 cursor-pointer" 
          onClick={() => { setPhase(Phase.LANDING); setProposal(null); }}
        >
          <div className="w-2.5 h-2.5 rounded-full bg-indigo-600 animate-pulse" />
          <span className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-800 tracking-tighter">Adeptify Systems</span>
        </div>
        <div className="hidden md:flex gap-4">
           <div className="bg-slate-900 text-white px-4 py-2 rounded-xl text-[8px] font-black uppercase tracking-widest flex items-center gap-2">
             <div className="w-1.5 h-1.5 bg-green-500 rounded-full" /> 
             AES-256 Secure Audit
           </div>
        </div>
      </header>

      <main className={`w-full ${[Phase.PROPOSAL, Phase.DOC_GENERATOR, Phase.DYNAMIC_DIAGNOSIS].includes(phase) ? 'max-w-6xl' : 'max-w-xl'} mt-24 mb-24`}>
        {phase === Phase.LANDING && <SelectionScreen onChoice={handleProductChoice} />}

        {phase === Phase.DYNAMIC_DIAGNOSIS && (
          isProcessing ? (
            <ProcessingScreen centerName={diagnosis.centerName} onComplete={() => {}} />
          ) : (
            <DynamicConsultant 
              initialDiagnosis={diagnosis} 
              onComplete={handleAuditComplete} 
            />
          )
        )}

        {phase === Phase.DOC_GENERATOR && <DocGenerator />}

        {phase === Phase.PROPOSAL && proposal && (
          <div className="space-y-10">
            <div className="text-center space-y-3">
              <span className="bg-green-100 text-green-700 text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-[0.2em]">Diagnòstic Finalitzat</span>
              <h1 className="text-4xl font-black text-slate-900 tracking-tight">Estratègia d'Enginyeria per al vostre Centre</h1>
            </div>
            <Proposal data={proposal} onAccept={() => setPhase(Phase.ACTION)} />
          </div>
        )}
      </main>

      <footer className="fixed bottom-0 w-full p-4 bg-white/80 backdrop-blur-md border-t border-slate-100 flex justify-center items-center gap-8">
         <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">© 2025 Adeptify Systems • Privacitat Garantida per LOPD</p>
      </footer>

      <AdeptifyChat centerId={diagnosis.centerName || 'general'} />
    </div>
  );
};

export default App;
