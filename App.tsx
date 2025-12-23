
import React, { useState, useCallback, useEffect } from 'react';
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
      // 1. Generar la propuesta técnica vía IA
      const generated = await generateEducationalProposal(finalDiagnosis);
      
      // 2. Persistir en la Base de Datos (Supabase real)
      await consultationService.saveConsultation(finalDiagnosis, generated);
      
      setProposal(generated);
      setPhase(Phase.PROPOSAL);
    } catch (error) {
      console.error("Error en el procés de diagnòstic:", error);
      alert("Error crític de sincronització amb el clúster. Les dades s'han guardat localment.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 md:p-8 relative">
      <header className="fixed top-0 w-full p-6 flex justify-between items-center z-10">
        <div 
          className="bg-white/90 backdrop-blur-md px-6 py-3 rounded-full border border-slate-200 shadow-2xl flex items-center gap-3 cursor-pointer hover:scale-105 transition-transform" 
          onClick={() => { setPhase(Phase.LANDING); setProposal(null); }}
        >
          <div className="w-2.5 h-2.5 rounded-full bg-indigo-600 animate-pulse" />
          <span className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-800 tracking-tighter">Adeptify Systems</span>
        </div>
        <div className="hidden md:flex gap-4">
           <div className="bg-slate-900 text-white px-4 py-2 rounded-xl text-[8px] font-black uppercase tracking-widest flex items-center gap-2">
             <div className="w-1.5 h-1.5 bg-green-500 rounded-full" /> 
             Supabase Cloud Connected
           </div>
        </div>
      </header>

      <main className={`w-full ${[Phase.PROPOSAL, Phase.DOC_GENERATOR, Phase.DYNAMIC_DIAGNOSIS, Phase.ADMIN].includes(phase) ? 'max-w-6xl' : 'max-w-xl'} mt-24 mb-24`}>
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
        
        {phase === Phase.ADMIN && <AdminRegistry />}

        {phase === Phase.PROPOSAL && proposal && (
          <div className="space-y-10">
            <div className="text-center space-y-3">
              <span className="bg-green-100 text-green-700 text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-[0.2em]">Sincronització Real-Time Ok</span>
              <h1 className="text-4xl font-black text-slate-900 tracking-tight">Estratègia d'Enginyeria per al vostre Centre</h1>
            </div>
            <Proposal data={proposal} onAccept={() => setPhase(Phase.ACTION)} />
          </div>
        )}
      </main>

      <footer className="fixed bottom-0 w-full p-4 bg-white/80 backdrop-blur-md border-t border-slate-100 flex justify-center items-center gap-8 z-20">
         <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">© 2025 Adeptify Systems • PostgreSQL Cloud Node</p>
         <button 
           onClick={() => setPhase(Phase.ADMIN)}
           className="p-2 hover:bg-slate-100 rounded-lg transition-colors group"
           title="Accés Administració"
         >
           <svg className="w-4 h-4 text-slate-300 group-hover:text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
           </svg>
         </button>
      </footer>

      <AdeptifyChat centerId={diagnosis.centerName || 'general'} />
    </div>
  );
};

export default App;
