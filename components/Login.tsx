
import React, { useState } from 'react';
import { useLanguage } from '../LanguageContext';

interface LoginProps {
  onLoginSuccess: () => void;
}

const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  /**
   * CREDENCIALS ESTRATÈGIQUES VERIFICADES
   * Correu: bandujar@edutac.es
   * Pass: 23@2705BEAngu
   */
  const TARGET_EMAIL = "bandujar@edutac.es";
  const TARGET_PASS = "23@2705BEAngu";

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    // Esperem un moment per simular latència de seguretat i evitar atacs de força bruta
    await new Promise(resolve => setTimeout(resolve, 500));

    try {
      // 1. Normalització dades d'entrada
      const inputEmail = email.trim().toLowerCase();
      const inputPassword = password.trim(); // CRÍTIC: Elimina espais accidentals al copiar

      console.debug("Intent d'accés per a:", inputEmail);

      // 2. Validació de correu
      if (inputEmail !== TARGET_EMAIL.toLowerCase()) {
        throw new Error("USUARI_NOT_FOUND");
      }

      // 3. Validació de contrasenya (Cadena exacta)
      if (inputPassword === TARGET_PASS) {
        console.info("Protocol de seguretat validat. Benvingut, Consultor.");
        onLoginSuccess();
      } else {
        throw new Error("INVALID_PASSWORD");
      }
    } catch (err: any) {
      console.error("Login Error:", err.message);
      setError(t.loginError);
      setPassword(''); // Netejem pass per seguretat en fallar
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] fade-up px-4">
      <div className="bg-white p-12 rounded-[2.5rem] shadow-2xl border border-slate-100 w-full max-w-md space-y-8 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1.5 bg-indigo-600" />
        
        <div className="text-center space-y-2">
          <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl">
             <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
             </svg>
          </div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight uppercase">{t.loginTitle}</h2>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em]">{t.loginSubtitle}</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-2">
            <label htmlFor="login-email" className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">{t.loginEmail}</label>
            <input 
              id="login-email"
              type="email" 
              required
              autoFocus
              autoComplete="username"
              className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:border-indigo-600 transition-all font-bold text-sm text-slate-700"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="bandujar@edutac.es"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="login-password" className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">{t.loginPass}</label>
            <input 
              id="login-password"
              type="password" 
              required
              autoComplete="current-password"
              className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:border-indigo-600 transition-all font-bold text-sm text-slate-700"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-xl text-[10px] font-black uppercase text-center animate-shake">
              {error}
            </div>
          )}

          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black text-xs uppercase tracking-[0.3em] hover:bg-indigo-600 transition-all shadow-xl active:scale-95 flex items-center justify-center gap-3 btn-premium"
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              t.loginBtn
            )}
          </button>
        </form>

        <div className="pt-6 border-t border-slate-50 text-center">
           <p className="text-[8px] text-slate-300 font-bold uppercase tracking-widest">
             {t.loginSecureSession}
           </p>
        </div>
      </div>
      
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
        .animate-shake {
          animation: shake 0.2s ease-in-out 0s 2;
        }
      `}</style>
    </div>
  );
};

export default Login;
