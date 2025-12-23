
import React, { useState, useEffect } from 'react';
import { Phase, DiagnosisState, ProposalData, ProductType } from './types';
import SelectionScreen from './components/SelectionScreen';
import DynamicConsultant from './components/DynamicConsultant';
import Proposal from './components/Proposal';
import ProcessingScreen from './components/ProcessingScreen';
import AdeptifyChat from './components/AdeptifyChat';
import DocGenerator from './components/DocGenerator';
import AdminRegistry from './components/AdminRegistry';
import Login from './components/Login';
import { generateEducationalProposal } from './services/geminiService';
import { consultationService } from './services/consultationService';
import { LanguageProvider, useLanguage } from './LanguageContext';

const AppContent: React.FC = () => {
  const { language, setLanguage, t } = useLanguage();
  const [phase, setPhase] = useState<Phase>(Phase.LANDING);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [diagnosis, setDiagnosis] = useState<DiagnosisState>({
    centerName: '',
    contactEmail: '',
    consultationHistory: []
  });
  const [proposal, setProposal] = useState<ProposalData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Recuperem sessió d'admin si existeix (només durant la sessió actual)
  useEffect(() => {
    const sessionAuth = sessionStorage.getItem('adeptify_admin_auth');
    if (sessionAuth === 'true') setIsAuthenticated(true);
  }, []);

  const handleProductChoice = (product: ProductType | 'DOCS') => {
    if (product === 'DOCS') {
      setPhase(Phase.DOC_GENERATOR);
      return;
    }
    setDiagnosis(prev => ({ ...prev, selectedProduct: product, consultationHistory: [] }));
    setPhase(Phase.DYNAMIC_DIAGNOSIS);
  };

  const handleAuditComplete = async (history: { question: string; answer: string }[]) => {
    const centerNameAnswer = history.find(h => h.question.toLowerCase().includes('escola') || h.question.toLowerCase().includes('institut') || h.question.toLowerCase().includes('colegio'))?.answer;
    
    const finalDiagnosis = { 
      ...diagnosis, 
      consultationHistory: history,
      centerName: centerNameAnswer || diagnosis.centerName 
    };
    
    setDiagnosis(finalDiagnosis);
    setIsProcessing(true);
    try {
      const generated = await generateEducationalProposal(finalDiagnosis, language);
      await consultationService.saveConsultation(finalDiagnosis, generated);
      setProposal(generated);
      setPhase(Phase.PROPOSAL);
    } catch (error) {
      console.error(error);
      alert(language === 'ca' ? "Error de connexió." : "Error de conexión.");
    } finally { setIsProcessing(false); }
  };

  const handleAdminAccess = () => {
    if (isAuthenticated) {
      setPhase(Phase.ADMIN);
    } else {
      setPhase(Phase.LOGIN);
    }
  };

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
    sessionStorage.setItem('adeptify_admin_auth', 'true');
    setPhase(Phase.ADMIN);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem('adeptify_admin_auth');
    setPhase(Phase.LANDING);
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
          <span className="text-sm font-bold uppercase tracking-[0.3em] text-slate-900">{t.appTitle}</span>
        </div>
        
        <div className="flex items-center gap-6">
           <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
             <button 
               onClick={() => setLanguage('ca')}
               className={`px-3 py-1 text-[9px] font-black uppercase rounded-lg transition-all ${language === 'ca' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
             >
               CAT
             </button>
             <button 
               onClick={() => setLanguage('es')}
               className={`px-3 py-1 text-[9px] font-black uppercase rounded-lg transition-all ${language === 'es' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
             >
               ESP
             </button>
           </div>
           
           <button 
             onClick={() => setPhase(Phase.DOC_GENERATOR)}
             className="text-[10px] font-bold uppercase tracking-widest text-slate-900 hover:text-indigo-600 transition-colors"
           >
             {t.navDocs}
           </button>

           {isAuthenticated && (
             <button 
               onClick={handleLogout}
               className="text-[10px] font-bold uppercase tracking-widest text-red-500 hover:text-red-700 transition-colors"
             >
               {t.logoutBtn}
             </button>
           )}
        </div>
      </header>

      <main className={`w-full px-6 md:px-12 mt-32 ${[Phase.PROPOSAL, Phase.DOC_GENERATOR, Phase.ADMIN, Phase.LOGIN].includes(phase) ? 'max-w-7xl' : 'max-w-4xl'}`}>
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
        {phase === Phase.LOGIN && <Login onLoginSuccess={handleLoginSuccess} />}

        {phase === Phase.PROPOSAL && proposal && (
          <div className="space-y-12 fade-up">
            <div className="text-center space-y-4 max-w-2xl mx-auto">
              <span className="inline-block px-4 py-1 bg-green-50 text-green-700 text-[10px] font-bold rounded-full uppercase tracking-widest">{t.proposalBadge}</span>
              <h1 className="text-5xl font-serif text-slate-900 italic">{t.proposalTitle}</h1>
            </div>
            <Proposal 
              data={proposal} 
              centerName={diagnosis.centerName}
              onAccept={() => {}} 
            />
          </div>
        )}
      </main>

      <footer className="w-full p-12 mt-auto border-t border-slate-100 flex flex-col md:flex-row justify-between items-center gap-6 opacity-60 hover:opacity-100 transition-opacity">
         <p className="text-[10px] font-medium text-slate-500 uppercase tracking-widest">{t.footerText}</p>
         <button 
           onClick={handleAdminAccess} 
           className="group flex items-center gap-3 p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl transition-all border border-slate-200 shadow-sm"
           title={t.navAdmin}
         >
           <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] group-hover:text-indigo-600 transition-colors">Admin Access</span>
           <svg className="w-5 h-5 text-slate-900 group-hover:text-indigo-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
           </svg>
         </button>
      </footer>

      <AdeptifyChat centerId={diagnosis.centerName || 'general'} />
    </div>
  );
};

const App: React.FC = () => (
  <LanguageProvider>
    <AppContent />
  </LanguageProvider>
);

export default App;
