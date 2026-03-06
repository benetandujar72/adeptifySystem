import React, { useState, useEffect } from 'react';
import { Phase, DiagnosisState, ProposalData, ProductType } from './types';
import SelectionScreen from './components/SelectionScreen';
import DynamicConsultant from './components/DynamicConsultant';
import Proposal from './components/Proposal';
import ProcessingScreen from './components/ProcessingScreen';
import AdeptifyChat from './components/AdeptifyChat';
import DocGenerator from './components/DocGenerator';
import AdminRegistry from './components/AdminRegistry';
import AutomatedLeadPanel from './components/AutomatedLeadPanel';
import InteractiveAudit from './components/InteractiveAudit';
import AutoOnboarding from './components/AutoOnboarding';
import DigitalTwinDashboard from './components/DigitalTwinDashboard';
import CustomerSuccessPanel from './components/CustomerSuccessPanel';
import NetworkExpansion from './components/NetworkExpansion';
import CenterMapExplorer from './components/CenterMapExplorer';
import CRMDashboard from './components/CRMDashboard';
import Login from './components/Login';
import Register, { RegistrationData } from './components/Register';
import InstitutionGate from './components/InstitutionGate';
import ConsultorLanding from './components/ConsultorLanding';
import BenetProfilePage from './components/BenetProfilePage';
import { generateEducationalProposal } from './services/geminiService';
import { consultationService } from './services/consultationService';
import { LanguageProvider, useLanguage } from './LanguageContext';
import { getTenantSlugFromWindow } from './services/tenant';

const SESSION_TENANT_KEY = 'adeptify_active_tenant_slug';
const SESSION_TENANT_CENTER_NAME_KEY = 'adeptify_active_tenant_center_name';
const SESSION_FREE_ACCESS_KEY = 'adeptify_free_access';

const AppContent: React.FC = () => {
  const { language, setLanguage, t } = useLanguage();
  const [tenantSlug, setTenantSlug] = useState<string | null>(() => getTenantSlugFromWindow());
  const [phase, setPhase] = useState<Phase>(Phase.LANDING);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [adminScope, setAdminScope] = useState<'tenant' | 'all'>(() => {
    try {
      return sessionStorage.getItem('adeptify_admin_scope') === 'all' ? 'all' : 'tenant';
    } catch {
      return 'tenant';
    }
  });
  const [diagnosis, setDiagnosis] = useState<DiagnosisState>({
    tenantSlug: getTenantSlugFromWindow() ?? undefined,
    centerName: '',
    contactEmail: '',
    contactName: '',
    consultationHistory: []
  });
  const [proposal, setProposal] = useState<ProposalData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [pendingProduct, setPendingProduct] = useState<ProductType | null>(null);
  const [auditToken, setAuditToken] = useState<string | null>(null);

  const isAuditRoute = (() => {
    try {
      const p = window.location.pathname || '/';
      if (p.startsWith('/audit/')) {
        return p.split('/audit/')[1] || null;
      }
      return null;
    } catch {
      return null;
    }
  })();

  useEffect(() => {
    if (isAuditRoute) {
      setAuditToken(isAuditRoute);
      setPhase(Phase.INTERACTIVE_AUDIT);
    } else {
      // Soporte para deep-links admin
      const p = window.location.pathname || '/';
      if (p.includes('/admin')) {
        setPhase(Phase.ADMIN);
      }
    }
  }, [isAuditRoute]);

  const isConsultorRoute = (() => {
    try {
      const h = window.location.hostname || '';
      const p = window.location.pathname || '/';
      if (p === '/app') return false;
      if (h.startsWith('consultor.')) {
        return !p.startsWith('/t/') && !p.startsWith('/admin') && !p.startsWith('/login');
      }
      return p === '/consultor' || p.startsWith('/consultor/');
    } catch {
      return false;
    }
  })();

  // Recuperem sessió d'admin si existeix
  useEffect(() => {
    const sessionAuth = sessionStorage.getItem('adeptify_admin_auth');
    if (sessionAuth === 'true') {
      setIsAuthenticated(true);
      try {
        setAdminScope(sessionStorage.getItem('adeptify_admin_scope') === 'all' ? 'all' : 'tenant');
      } catch { }
    }
  }, []);

  // Resolve tenant from URL
  useEffect(() => {
    const updateFromLocation = () => {
      const next = getTenantSlugFromWindow();
      setTenantSlug(next);
      setDiagnosis(prev => ({ ...prev, tenantSlug: next ?? undefined }));
    };
    updateFromLocation();
    window.addEventListener('popstate', updateFromLocation);
    return () => window.removeEventListener('popstate', updateFromLocation);
  }, []);

  // Restore tenant from sessionStorage
  useEffect(() => {
    if (tenantSlug) return;
    try {
      const saved = (sessionStorage.getItem(SESSION_TENANT_KEY) || '').trim();
      if (!saved) return;
      window.history.replaceState({}, '', `/t/${encodeURIComponent(saved)}`);
      window.dispatchEvent(new PopStateEvent('popstate'));
    } catch { }
  }, [tenantSlug]);

  const handleProductChoice = (product: ProductType | 'DOCS') => {
    if (product === 'DOCS') { setPhase(Phase.DOC_GENERATOR); return; }
    if (!diagnosis.centerName || !diagnosis.contactEmail) {
      setPendingProduct(product);
      setPhase(Phase.REGISTER);
      return;
    }
    setDiagnosis(prev => ({ ...prev, selectedProduct: product, consultationHistory: [] }));
    setPhase(Phase.DYNAMIC_DIAGNOSIS);
  };

  const handleRegistered = (reg: RegistrationData) => {
    setDiagnosis(prev => ({ ...prev, ...reg }));
    if (pendingProduct) {
      setDiagnosis(prev => ({ ...prev, selectedProduct: pendingProduct, consultationHistory: [] }));
      setPendingProduct(null);
      setPhase(Phase.DYNAMIC_DIAGNOSIS);
      return;
    }
    setPhase(Phase.LANDING);
  };

  const handleAuditComplete = async (history: { question: string; answer: string[] }[]) => {
    const finalDiagnosis = { ...diagnosis, consultationHistory: history };
    setDiagnosis(finalDiagnosis);
    setIsProcessing(true);
    try {
      const generated = await generateEducationalProposal(finalDiagnosis, language);
      await consultationService.saveConsultation(finalDiagnosis, generated, tenantSlug ?? undefined);
      setProposal(generated);
      setPhase(Phase.PROPOSAL);
    } catch (error) {
      alert("Error de connexió.");
    } finally { setIsProcessing(false); }
  };

  const handleAdminAccess = () => {
    if (isAuthenticated) setPhase(Phase.ADMIN);
    else setPhase(Phase.LOGIN);
  };

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
    sessionStorage.setItem('adeptify_admin_auth', 'true');
    setPhase(Phase.ADMIN);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    sessionStorage.clear();
    setPhase(Phase.LANDING);
  };

  const clearTenantSession = () => {
    sessionStorage.removeItem(SESSION_TENANT_KEY);
    window.history.replaceState({}, '', '/');
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  if (isConsultorRoute) {
    const path = window.location.pathname;
    return (
      <div className="min-h-screen flex flex-col items-center bg-[#FDFDFD]">
        <header className="fixed top-0 w-full p-6 md:p-8 flex justify-between items-center z-50 glass border-b border-slate-100">
          <div className="flex items-center gap-4 cursor-pointer hover:opacity-70 transition-opacity" onClick={() => window.location.href = '/consultor'}>
            <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center shadow-lg"><div className="w-3 h-3 bg-indigo-500 rounded-sm" /></div>
            <span className="text-[10px] md:text-xs font-black uppercase tracking-[0.3em] text-slate-900 leading-none">{t.appTitle}</span>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
              {['ca', 'es', 'eu'].map(l => (
                <button key={l} onClick={() => setLanguage(l as any)} className={`px-3 py-1 text-[9px] font-black uppercase rounded-lg transition-all ${language === l ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>{l.toUpperCase()}</button>
              ))}
            </div>
            <button onClick={() => window.location.href = '/app'} className="bg-slate-900 text-white px-4 py-2 rounded-xl shadow-lg hover:bg-indigo-600 transition-all text-[9px] font-black uppercase tracking-widest">{t.consultorHeaderCta}</button>
          </div>
        </header>
        <main className="w-full px-6 md:px-12 mt-32 mb-20 max-w-[1600px]">
          {path === '/consultor/benet' ? <BenetProfilePage onBack={() => window.location.href = '/consultor'} /> : <ConsultorLanding onOpenApp={() => window.location.href = '/app'} onOpenDocs={() => window.location.href = '/app'} />}
        </main>
      </div>
    );
  }

  if (!tenantSlug) {
    return (
      <div className="min-h-screen flex flex-col items-center bg-[#FDFDFD]">
        <header className="fixed top-0 w-full p-6 md:p-8 flex justify-between items-center z-50 glass border-b border-slate-100">
          <div className="flex items-center gap-4 cursor-pointer hover:opacity-70 transition-opacity"><div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center shadow-lg"><div className="w-3 h-3 bg-indigo-500 rounded-sm" /></div><span className="text-[10px] md:text-xs font-black uppercase tracking-[0.3em] text-slate-900 leading-none">{t.appTitle}</span></div>
          <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
            {['ca', 'es', 'eu'].map(l => (
              <button key={l} onClick={() => setLanguage(l as any)} className={`px-3 py-1 text-[9px] font-black uppercase rounded-lg transition-all ${language === l ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>{l.toUpperCase()}</button>
            ))}
          </div>
        </header>
        <main className="w-full px-6 md:px-12 mt-32 mb-20 max-w-4xl"><InstitutionGate onSelected={(sel) => { sessionStorage.setItem(SESSION_TENANT_KEY, sel.tenantSlug); window.history.replaceState({}, '', `/t/${encodeURIComponent(sel.tenantSlug)}`); window.dispatchEvent(new PopStateEvent('popstate')); setPhase(sel.needsRegistration ? Phase.REGISTER : Phase.LANDING); }} /></main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center bg-[#FDFDFD]">
      <header className="fixed top-0 w-full p-6 md:p-8 flex justify-between items-center z-50 glass border-b border-slate-100">
        <div className="flex items-center gap-4 cursor-pointer hover:opacity-70 transition-opacity" onClick={() => { setPhase(Phase.LANDING); setProposal(null); }}>
          <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center shadow-lg"><div className="w-3 h-3 bg-indigo-500 rounded-sm" /></div>
          <span className="text-[10px] md:text-xs font-black uppercase tracking-[0.3em] text-slate-900 leading-none">{t.appTitle}</span>
        </div>

        <div className="flex items-center gap-3 md:gap-6">
          <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
            {['ca', 'es', 'eu'].map(l => (
              <button key={l} onClick={() => setLanguage(l as any)} className={`px-3 py-1 text-[9px] font-black uppercase rounded-lg transition-all ${language === l ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>{l.toUpperCase()}</button>
            ))}
          </div>

          <button onClick={() => setPhase(Phase.DOC_GENERATOR)} className="text-[9px] font-black uppercase tracking-widest text-slate-900 hover:text-indigo-600 transition-colors">{t.navDocs}</button>

          {isAuthenticated && (
            <div className="flex items-center gap-4 border-l border-slate-200 pl-4">
              <button onClick={() => setPhase(Phase.LEAD_MANAGEMENT)} className="text-[9px] font-black uppercase tracking-widest text-indigo-600 hover:text-slate-900 transition-colors">Leads</button>
              <button onClick={() => setPhase(Phase.CRM)} className="text-[9px] font-black uppercase tracking-widest text-indigo-600 hover:text-slate-900 transition-colors">CRM</button>
              <button onClick={() => setPhase(Phase.AUTO_ONBOARDING)} className="text-[9px] font-black uppercase tracking-widest text-slate-500 hover:text-indigo-600 transition-colors">Migració</button>
              <button onClick={() => setPhase(Phase.DIGITAL_TWIN)} className="text-[9px] font-black uppercase tracking-widest text-slate-500 hover:text-indigo-600 transition-colors">Twin</button>
              <button onClick={() => setPhase(Phase.NETWORK_EXPANSION)} className="text-[9px] font-black uppercase tracking-widest text-cyan-600 hover:text-slate-900 transition-colors">Expansió</button>
              <button onClick={() => setPhase(Phase.CENTER_MAP)} className="text-[9px] font-black uppercase tracking-widest text-emerald-600 hover:text-slate-900 transition-colors">{t.centerMapNav}</button>
            </div>
          )}

          <button onClick={clearTenantSession} className="text-[9px] font-black uppercase tracking-widest text-slate-500 hover:text-indigo-600 transition-colors" title="Canviar institut">Canviar</button>

          {isAuthenticated ? (
            <button onClick={handleLogout} className="px-4 py-2 bg-red-50 text-red-600 text-[9px] font-black uppercase rounded-xl tracking-widest hover:bg-red-100 transition-all">{t.logoutBtn}</button>
          ) : (
            <button onClick={handleAdminAccess} className="p-2.5 bg-slate-900 text-white rounded-xl shadow-lg hover:bg-indigo-600 transition-all group" title={t.navAdmin}><svg className="w-4 h-4 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg></button>
          )}
        </div>
      </header>

      <main className={`w-full px-6 md:px-12 mt-32 mb-20 ${[Phase.ADMIN, Phase.PROPOSAL, Phase.DOC_GENERATOR, Phase.CRM, Phase.CENTER_MAP].includes(phase) ? 'max-w-[1600px]' : 'max-w-4xl'}`}>
        {phase === Phase.LANDING && <SelectionScreen centerName={diagnosis.centerName} onChoice={handleProductChoice} />}
        {phase === Phase.REGISTER && <Register initial={diagnosis} onRegistered={handleRegistered} />}
        {phase === Phase.DYNAMIC_DIAGNOSIS && (isProcessing ? <ProcessingScreen centerName={diagnosis.centerName} onComplete={() => { }} /> : <DynamicConsultant initialDiagnosis={diagnosis} onComplete={handleAuditComplete} />)}
        {phase === Phase.DOC_GENERATOR && <DocGenerator />}
        {phase === Phase.ADMIN && <AdminRegistry tenantSlug={tenantSlug ?? undefined} adminScope={adminScope} />}
        {phase === Phase.LEAD_MANAGEMENT && <AutomatedLeadPanel />}
        {phase === Phase.AUTO_ONBOARDING && <AutoOnboarding />}
        {phase === Phase.DIGITAL_TWIN && <DigitalTwinDashboard />}
        {phase === Phase.CUSTOMER_SUCCESS && <CustomerSuccessPanel />}
        {phase === Phase.NETWORK_EXPANSION && <NetworkExpansion />}
        {phase === Phase.CENTER_MAP && <CenterMapExplorer />}
        {phase === Phase.CRM && <CRMDashboard />}
        {phase === Phase.INTERACTIVE_AUDIT && auditToken && <InteractiveAudit token={auditToken} onBookConsultation={() => setPhase(Phase.LANDING)} />}
        {phase === Phase.LOGIN && <Login onLoginSuccess={handleLoginSuccess} />}
        {phase === Phase.PROPOSAL && proposal && <div className="space-y-12 fade-up"><div className="text-center space-y-4 max-w-2xl mx-auto"><span className="inline-block px-4 py-1 bg-green-50 text-green-700 text-[10px] font-black rounded-full uppercase tracking-widest">{t.proposalBadge}</span><h1 className="text-5xl font-serif text-slate-900 italic leading-tight">{t.proposalTitle}</h1></div><Proposal data={proposal} centerName={diagnosis.centerName} onAccept={() => { }} /></div>}
      </main>
      <footer className="w-full p-12 border-t border-slate-100 flex justify-between items-center opacity-40 transition-opacity hover:opacity-100"><p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">{t.footerText}</p></footer>
      <AdeptifyChat centerId={`${tenantSlug ?? 'global'}::${diagnosis.centerName || 'general'}`} />
    </div>
  );
};

const App: React.FC = () => (<LanguageProvider><AppContent /></LanguageProvider>);
export default App;
