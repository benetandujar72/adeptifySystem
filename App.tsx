
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
    }
  }, [isAuditRoute]);

  const isConsultorRoute = (() => {
    try {
      const h = window.location.hostname || '';
      const p = window.location.pathname || '/';

      // Bypass landing if explicitly asking for /app gate
      if (p === '/app') return false;

      // Enable landing if on subdomain or explicit path
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
      } catch {
        // ignore
      }
    }
  }, []);

  // Resolve tenant from URL (supports /t/{tenantSlug}/...).
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

  // If no tenant is in the URL, try to restore it from sessionStorage (per-session).
  useEffect(() => {
    if (tenantSlug) return;
    try {
      const saved = (sessionStorage.getItem(SESSION_TENANT_KEY) || '').trim();
      if (!saved) return;
      // Route to /t/{tenantSlug} and re-resolve tenant.
      window.history.replaceState({}, '', `/t/${encodeURIComponent(saved)}`);
      window.dispatchEvent(new PopStateEvent('popstate'));

      const savedName = (sessionStorage.getItem(SESSION_TENANT_CENTER_NAME_KEY) || '').trim();
      if (savedName) {
        setDiagnosis(prev => ({
          ...prev,
          tenantSlug: saved,
          centerName: savedName,
        }));
      }
    } catch {
      // ignore
    }
  }, [tenantSlug]);

  // Recuperem registre gratuït si existeix
  useEffect(() => {
    try {
      const raw = localStorage.getItem('adeptify_registration');
      if (!raw) return;
      const parsed = JSON.parse(raw);
      setDiagnosis(prev => ({
        ...prev,
        contactName: typeof parsed?.contactName === 'string' ? parsed.contactName : prev.contactName,
        contactEmail: typeof parsed?.contactEmail === 'string' ? parsed.contactEmail : prev.contactEmail,
        centerName: typeof parsed?.centerName === 'string' ? parsed.centerName : prev.centerName,
      }));
    } catch {
      // ignore
    }
  }, []);

  const isRegistered = (d: DiagnosisState) => {
    return !!d.centerName?.trim() && !!d.contactEmail?.trim() && !!d.contactName?.trim();
  };

  const handleProductChoice = (product: ProductType | 'DOCS') => {
    if (product === 'DOCS') {
      setPhase(Phase.DOC_GENERATOR);
      return;
    }

    // Require free registration before starting the consultant.
    if (!isRegistered(diagnosis)) {
      setPendingProduct(product);
      setPhase(Phase.REGISTER);
      return;
    }

    setDiagnosis(prev => ({ ...prev, selectedProduct: product, consultationHistory: [] }));
    setPhase(Phase.DYNAMIC_DIAGNOSIS);
  };

  const handleRegistered = (reg: RegistrationData) => {
    setDiagnosis(prev => ({
      ...prev,
      contactName: reg.contactName,
      contactEmail: reg.contactEmail,
      centerName: reg.centerName,
    }));

    try {
      sessionStorage.removeItem(SESSION_FREE_ACCESS_KEY);
    } catch {
      // ignore
    }

    if (pendingProduct) {
      setDiagnosis(prev => ({ ...prev, selectedProduct: pendingProduct, consultationHistory: [] }));
      setPendingProduct(null);
      setPhase(Phase.DYNAMIC_DIAGNOSIS);
      return;
    }

    setPhase(Phase.LANDING);
  };

  const handleAuditComplete = async (history: { question: string; answer: string[] }[]) => {
    const centerNameAnswer = history
      .find(h => h.question.toLowerCase().includes('escola') || h.question.toLowerCase().includes('institut') || h.question.toLowerCase().includes('colegio'))
      ?.answer?.find(a => a && a.trim());

    const finalDiagnosis = {
      ...diagnosis,
      consultationHistory: history,
      centerName: centerNameAnswer || diagnosis.centerName
    };

    setDiagnosis(finalDiagnosis);
    setIsProcessing(true);
    try {
      const generated = await generateEducationalProposal(finalDiagnosis, language);
      await consultationService.saveConsultation(finalDiagnosis, generated, tenantSlug ?? undefined);
      setProposal(generated);
      setPhase(Phase.PROPOSAL);
    } catch (error) {
      console.error(error);
      alert(language === 'ca' ? "Error de connexió." : language === 'eu' ? "Konexio-errorea." : "Error de conexión.");
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
    try {
      setAdminScope(sessionStorage.getItem('adeptify_admin_scope') === 'all' ? 'all' : 'tenant');
    } catch {
      // ignore
    }
    setPhase(Phase.ADMIN);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem('adeptify_admin_auth');
    sessionStorage.removeItem('adeptify_admin_email');
    sessionStorage.removeItem('adeptify_admin_scope');
    sessionStorage.removeItem(SESSION_TENANT_KEY);
    sessionStorage.removeItem(SESSION_TENANT_CENTER_NAME_KEY);
    setAdminScope('tenant');
    setPhase(Phase.LANDING);
  };

  const clearTenantSession = () => {
    try {
      sessionStorage.removeItem(SESSION_TENANT_KEY);
      sessionStorage.removeItem(SESSION_TENANT_CENTER_NAME_KEY);
    } catch {
      // ignore
    }
    // Navigate to root so the InstitutionGate shows again.
    window.history.replaceState({}, '', '/');
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  // Marketing landing route: accessible without selecting a tenant.
  if (isConsultorRoute) {
    const path = (() => {
      try {
        return window.location.pathname || '/consultor';
      } catch {
        return '/consultor';
      }
    })();

    const openApp = () => {
      // If on consultor subdomain, we need to go to /app to bypass the landing page and see the center gate.
      if (window.location.hostname.startsWith('consultor.')) {
        window.location.href = '/app';
        return;
      }
      window.location.href = '/';
    };

    const openDocs = () => {
      // If a tenant is known, keep it; otherwise return to root and let the user pick.
      try {
        const saved = (sessionStorage.getItem(SESSION_TENANT_KEY) || '').trim();
        if (saved) {
          window.location.href = `/t/${encodeURIComponent(saved)}`;
          return;
        }
      } catch {
        // ignore
      }
      window.location.href = '/';
    };

    return (
      <div className="min-h-screen flex flex-col items-center bg-[#FDFDFD]">
        <header className="fixed top-0 w-full p-6 md:p-8 flex justify-between items-center z-50 glass border-b border-slate-100">
          <div
            className="flex items-center gap-4 cursor-pointer hover:opacity-70 transition-opacity"
            onClick={() => {
              try {
                window.history.replaceState({}, '', '/consultor');
              } catch {
                // ignore
              }
            }}
          >
            <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center shadow-lg">
              <div className="w-3 h-3 bg-indigo-500 rounded-sm" />
            </div>
            <span className="text-[10px] md:text-xs font-black uppercase tracking-[0.3em] text-slate-900 leading-none">{t.appTitle}</span>
          </div>

          <nav className="hidden lg:flex items-center gap-10">
            <button
              onClick={() => document.getElementById('servicios')?.scrollIntoView({ behavior: 'smooth' })}
              className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 hover:text-blue-600 transition-colors"
            >
              {t.lpNavServices}
            </button>
            <button
              onClick={() => document.getElementById('casos')?.scrollIntoView({ behavior: 'smooth' })}
              className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 hover:text-blue-600 transition-colors"
            >
              {t.lpNavCases}
            </button>
            <button
              onClick={() => document.getElementById('contacto')?.scrollIntoView({ behavior: 'smooth' })}
              className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 hover:text-blue-600 transition-colors"
            >
              {t.lpNavContact}
            </button>
          </nav>

          <div className="flex items-center gap-3 md:gap-6">

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
              <button
                onClick={() => setLanguage('eu')}
                className={`px-3 py-1 text-[9px] font-black uppercase rounded-lg transition-all ${language === 'eu' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
              >
                EU
              </button>
            </div>

            <button
              onClick={openApp}
              className="bg-slate-900 text-white px-4 py-2 rounded-xl shadow-lg hover:bg-indigo-600 transition-all text-[9px] font-black uppercase tracking-widest"
            >
              {t.consultorHeaderCta}
            </button>
          </div>
        </header>

        <main className="w-full px-6 md:px-12 mt-32 mb-20 max-w-[1600px]">
          {path === '/consultor/benet' ? (
            <BenetProfilePage
              onBack={() => {
                try {
                  window.history.replaceState({}, '', '/consultor');
                  window.dispatchEvent(new PopStateEvent('popstate'));
                } catch {
                  window.location.href = '/consultor';
                }
              }}
            />
          ) : (
            <ConsultorLanding onOpenApp={openApp} onOpenDocs={openDocs} />
          )}
        </main>

        <footer className="w-full p-12 border-t border-slate-100 flex flex-col md:flex-row justify-between items-center gap-6 opacity-40 hover:opacity-100 transition-opacity">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">{t.footerText}</p>
          <div className="flex gap-8">
            <span className="text-[9px] font-black uppercase text-slate-300 tracking-widest">AES-256 Protocol</span>
            <span className="text-[9px] font-black uppercase text-slate-300 tracking-widest">ISO 27001 Cloud</span>
          </div>
        </footer>
      </div>
    );
  }

  // Gate: require selecting which institution (tenant) this session belongs to.
  if (!tenantSlug) {
    return (
      <div className="min-h-screen flex flex-col items-center bg-[#FDFDFD]">
        <header className="fixed top-0 w-full p-6 md:p-8 flex justify-between items-center z-50 glass border-b border-slate-100">
          <div className="flex items-center gap-4 cursor-pointer hover:opacity-70 transition-opacity">
            <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center shadow-lg">
              <div className="w-3 h-3 bg-indigo-500 rounded-sm" />
            </div>
            <span className="text-[10px] md:text-xs font-black uppercase tracking-[0.3em] text-slate-900 leading-none">{t.appTitle}</span>
          </div>
          <div className="flex items-center gap-3 md:gap-6">
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
              <button
                onClick={() => setLanguage('eu')}
                className={`px-3 py-1 text-[9px] font-black uppercase rounded-lg transition-all ${language === 'eu' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
              >
                EU
              </button>
            </div>
          </div>
        </header>

        <main className="w-full px-6 md:px-12 mt-32 mb-20 max-w-4xl">
          <InstitutionGate
            onSelected={(sel) => {
              try {
                sessionStorage.setItem(SESSION_TENANT_KEY, sel.tenantSlug);
                sessionStorage.setItem(SESSION_TENANT_CENTER_NAME_KEY, sel.centerName);
                if (sel.freeAccess) sessionStorage.setItem(SESSION_FREE_ACCESS_KEY, 'true');
                else sessionStorage.removeItem(SESSION_FREE_ACCESS_KEY);
              } catch {
                // ignore
              }

              // Navigate to tenant route and let existing listener update state.
              window.history.replaceState({}, '', `/t/${encodeURIComponent(sel.tenantSlug)}`);
              window.dispatchEvent(new PopStateEvent('popstate'));

              setDiagnosis(prev => ({
                ...prev,
                tenantSlug: sel.tenantSlug,
                centerName: sel.centerName,
              }));
              // If the center was entered manually (not found in catalogue), enforce the mandatory free registration.
              setPhase(sel.needsRegistration ? Phase.REGISTER : Phase.LANDING);
            }}
          />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center bg-[#FDFDFD]">
      <header className="fixed top-0 w-full p-6 md:p-8 flex justify-between items-center z-50 glass border-b border-slate-100">
        <div
          className="flex items-center gap-4 cursor-pointer hover:opacity-70 transition-opacity"
          onClick={() => { setPhase(Phase.LANDING); setProposal(null); }}
        >
          <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center shadow-lg">
            <div className="w-3 h-3 bg-indigo-500 rounded-sm" />
          </div>
          <span className="text-[10px] md:text-xs font-black uppercase tracking-[0.3em] text-slate-900 leading-none">{t.appTitle}</span>
        </div>

        <div className="flex items-center gap-3 md:gap-6">
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
            <button
              onClick={() => setLanguage('eu')}
              className={`px-3 py-1 text-[9px] font-black uppercase rounded-lg transition-all ${language === 'eu' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            >
              EU
            </button>
          </div>

          <button
            onClick={() => setPhase(Phase.DOC_GENERATOR)}
            className="text-[9px] font-black uppercase tracking-widest text-slate-900 hover:text-indigo-600 transition-colors"
          >
            {t.navDocs}
          </button>

          {isAuthenticated && (
            <button
              onClick={() => setPhase(Phase.LEAD_MANAGEMENT)}
              className="text-[9px] font-black uppercase tracking-widest text-indigo-600 hover:text-slate-900 transition-colors"
            >
              Leads
            </button>
          )}

          <button
            onClick={clearTenantSession}
            className="text-[9px] font-black uppercase tracking-widest text-slate-500 hover:text-indigo-600 transition-colors"
            title={language === 'ca' ? 'Canviar institut' : language === 'eu' ? 'Ikastetxea aldatu' : 'Cambiar instituto'}
          >
            {language === 'ca' ? 'Canviar institut' : language === 'eu' ? 'Ikastetxea aldatu' : 'Cambiar instituto'}
          </button>

          {isAuthenticated ? (
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-red-50 text-red-600 text-[9px] font-black uppercase rounded-xl tracking-widest hover:bg-red-100 transition-all"
            >
              {t.logoutBtn}
            </button>
          ) : (
            <button
              onClick={handleAdminAccess}
              className="p-2.5 bg-slate-900 text-white rounded-xl shadow-lg hover:bg-indigo-600 transition-all group"
              title={t.navAdmin}
            >
              <svg className="w-4 h-4 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
            </button>
          )}
        </div>
      </header>

      <main className={`w-full px-6 md:px-12 mt-32 mb-20 ${[Phase.ADMIN, Phase.PROPOSAL, Phase.DOC_GENERATOR].includes(phase) ? 'max-w-[1600px]' : 'max-w-4xl'}`}>
        {phase === Phase.LANDING && (
          <SelectionScreen
            centerName={diagnosis.centerName}
            onChoice={handleProductChoice}
          />
        )}

        {phase === Phase.REGISTER && (
          <Register
            initial={{
              contactName: diagnosis.contactName || '',
              contactEmail: diagnosis.contactEmail || '',
              centerName: diagnosis.centerName || '',
            }}
            onRegistered={handleRegistered}
          />
        )}

        {phase === Phase.DYNAMIC_DIAGNOSIS && (
          isProcessing ? (
            <ProcessingScreen centerName={diagnosis.centerName} onComplete={() => { }} />
          ) : (
            <DynamicConsultant initialDiagnosis={diagnosis} onComplete={handleAuditComplete} />
          )
        )}

        {phase === Phase.DOC_GENERATOR && <DocGenerator />}
        {phase === Phase.ADMIN && <AdminRegistry tenantSlug={tenantSlug ?? undefined} adminScope={adminScope} />}
        {phase === Phase.LEAD_MANAGEMENT && <AutomatedLeadPanel />}
        {phase === Phase.INTERACTIVE_AUDIT && auditToken && (
          <InteractiveAudit 
            token={auditToken} 
            onBookConsultation={() => setPhase(Phase.LANDING)} 
          />
        )}
        {phase === Phase.LOGIN && <Login onLoginSuccess={handleLoginSuccess} />}

        {phase === Phase.PROPOSAL && proposal && (
          <div className="space-y-12 fade-up">
            <div className="text-center space-y-4 max-w-2xl mx-auto">
              <span className="inline-block px-4 py-1 bg-green-50 text-green-700 text-[10px] font-black rounded-full uppercase tracking-widest">{t.proposalBadge}</span>
              <h1 className="text-5xl font-serif text-slate-900 italic leading-tight">{t.proposalTitle}</h1>
            </div>
            <Proposal
              data={proposal}
              centerName={diagnosis.centerName}
              onAccept={() => { }}
            />
          </div>
        )}
      </main>

      {phase !== Phase.ADMIN && (
        <footer className="w-full p-12 border-t border-slate-100 flex flex-col md:flex-row justify-between items-center gap-6 opacity-40 hover:opacity-100 transition-opacity">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">{t.footerText}</p>
          <div className="flex gap-8">
            <span className="text-[9px] font-black uppercase text-slate-300 tracking-widest">AES-256 Protocol</span>
            <span className="text-[9px] font-black uppercase text-slate-300 tracking-widest">ISO 27001 Cloud</span>
          </div>
        </footer>
      )}

      <AdeptifyChat centerId={`${tenantSlug ?? 'global'}::${diagnosis.centerName || 'general'}`} />
    </div>
  );
};

const App: React.FC = () => (
  <LanguageProvider>
    <AppContent />
  </LanguageProvider>
);

export default App;
