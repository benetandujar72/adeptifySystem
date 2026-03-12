
import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Language, translations } from './translations';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: typeof translations.ca;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>(() => {
    try {
      const saved = (localStorage.getItem('adeptify_language') || '').trim() as Language;
      if (saved === 'ca' || saved === 'es' || saved === 'eu' || saved === 'en') return saved;
    } catch {
      // ignore
    }
    return 'en';
  });

  React.useEffect(() => {
    try {
      localStorage.setItem('adeptify_language', language);
    } catch {
      // ignore
    }
  }, [language]);

  const t = translations[language];

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used within a LanguageProvider');
  return context;
};
