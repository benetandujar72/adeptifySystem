
import React, { useState } from 'react';
import { Phase, DiagnosisState, ProposalData, ProductType } from './types';
import SelectionScreen from './components/SelectionScreen';
import DynamicConsultant from './components/DynamicConsultant';
import Proposal from './components/Proposal';
import ProcessingScreen from './components/ProcessingScreen';
import AdeptifyChat from './components/AdeptifyChat';
import DocGenerator from './components/DocGenerator';
import AdminRegistry from './components/AdminRegistry';
import { generateEducationalProposal } from './services/geminiService';
import { consultationService } from './services/consultationService';

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
    setDiagnosis(prev => ({ ...prev, selectedProduct: product, consultationHistory: [] }));
    setPhase(Phase.DYNAMIC_DIAGNOSIS);
  };

  const handleAuditComplete = async (history: { question: string; answer: string }[]) => {
    const finalDiagnosis = { ...diagnosis, consultationHistory: history };
    setDiagnosis(finalDiagnosis);
    setIsProcessing(true);
    try {
      const generated = await generateEducationalProposal(finalDiagnosis);
      await consultationService.saveConsultation(finalDiagnosis, generated);
      setProposal(generated);
      setPhase(Phase.PROPOSAL);
    } catch (error) {
      console.error(error);
      alert("Error de connexió al Núvol.");
    } finally { setIsProcessing(false); }
  };

  return (
    <div className="min-h-screen flex flex-col items-center bg-[#FDFDFD]">
      <header className="fixed top-0 w-full p-8 flex justify-between items-center z-50 glass border-b border-slate-100">
        <div 
          className="flex items-center gap-4 cursor-pointer hover:opacity-70 transition-opacity" 
          onClick={() => { setPhase(Phase.LANDING); setProposal(null); }}
        >
          <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center">
            <div className="w-3 h-3 bg-indigo-500 rounded-sm" />
          </div>
          <span className="text-sm font-bold uppercase tracking-[0.3em] text-slate-900">Adeptify Systems</span>
        </div>
        
        <div className="flex items-center gap-6">
           <div className="hidden md:flex bg-slate-100 px-4 py-1.5 rounded-full text-[9px] font-bold uppercase tracking-widest text-slate-500 items-center gap-2">
             <div className="w-1.5 h-1.5 bg-green-500 rounded-full" /> 
             Node de Supabase Enterprise
           </div>
           <button 
             onClick={() => setPhase(Phase.DOC_GENERATOR)}
             className="text-[10px] font-bold uppercase tracking-widest text-slate-900 hover:text-indigo-600 transition-colors"
           >
             Generador de Docs
           </button>
        </div>
      </header>

      <main className={`w-full px-6 md:px-12 mt-32 ${[Phase.PROPOSAL, Phase.DOC_GENERATOR, Phase.ADMIN].includes(phase) ? 'max-w-7xl' : 'max-w-4xl'}`}>
        {phase === Phase.LANDING && <SelectionScreen onChoice={handleProductChoice} />}

        {phase === Phase.DYNAMIC_DIAGNOSIS && (
          isProcessing ? (
            <ProcessingScreen centerName={diagnosis.centerName} onComplete={() => {}} />
          ) : (
            <DynamicConsultant initialDiagnosis={diagnosis} onComplete={handleAuditComplete} />
          )
        )}

        {phase === Phase.DOC_GENERATOR && <DocGenerator />}
        {phase === Phase.ADMIN && <AdminRegistry />}

        {phase === Phase.PROPOSAL && proposal && (
          <div className="space-y-12 fade-up">
            <div className="text-center space-y-4 max-w-2xl mx-auto">
              <span className="inline-block px-4 py-1 bg-green-50 text-green-700 text-[10px] font-bold rounded-full uppercase tracking-widest">Diagnòstic Validat</span>
              <h1 className="text-5xl font-serif text-slate-900 italic">Estratègia de creixement per al vostre centre</h1>
            </div>
            <Proposal data={proposal} onAccept={() => {}} />
          </div>
        )}
      </main>

      <footer className="w-full p-12 mt-auto border-t border-slate-100 flex flex-col md:flex-row justify-between items-center gap-6 opacity-40 hover:opacity-100 transition-opacity">
         <p className="text-[10px] font-medium text-slate-500 uppercase tracking-widest">© 2025 ADEPTIFY SYSTEMS SLU • BARCELONA • INFRAESTRUCTURA AL NÚVOL</p>
         <button onClick={() => setPhase(Phase.ADMIN)} className="p-3 hover:bg-slate-100 rounded-full transition-all" title="Accés Administració">
           <svg className="w-5 h-5 text-slate-900" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>
         </button>
      </footer>

      <AdeptifyChat centerId={diagnosis.centerName || 'general'} />
    </div>
  );
};

export default App;
