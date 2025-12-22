
import React, { useState } from 'react';
import { NotificationPrefs } from '../types';

const NotificationSettings: React.FC = () => {
  const [prefs, setPrefs] = useState<NotificationPrefs>({
    push: true,
    email: true,
    dailySummary: false,
    weeklySummary: true,
  });

  const toggle = (key: keyof NotificationPrefs) => {
    setPrefs(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
      <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
        <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        Preferències de Notificació
      </h3>

      <div className="space-y-4">
        {[
          { key: 'push', label: 'Notificacions Push', desc: 'Alertes en temps real al navegador/mòbil' },
          { key: 'email', label: 'Correu Electrònic', desc: 'Notificacions de tasques noves i comentaris' },
          { key: 'dailySummary', label: 'Resum Diari', desc: 'Totes les novetats cada matí' },
          { key: 'weeklySummary', label: 'Resum Setmanal', desc: 'Anàlisi de progrés de la setmana' },
        ].map(item => (
          <div key={item.key} className="flex items-center justify-between group">
            <div className="pr-4">
              <span className="block font-bold text-slate-700 text-sm">{item.label}</span>
              <span className="text-[10px] text-slate-400 leading-tight">{item.desc}</span>
            </div>
            <button
              onClick={() => toggle(item.key as keyof NotificationPrefs)}
              className={`w-10 h-5 rounded-full shrink-0 transition-colors relative ${prefs[item.key as keyof NotificationPrefs] ? 'bg-indigo-600' : 'bg-slate-200'}`}
            >
              <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all shadow-sm ${prefs[item.key as keyof NotificationPrefs] ? 'left-5.5' : 'left-0.5'}`} />
            </button>
          </div>
        ))}
      </div>
      
      <div className="mt-6 pt-6 border-t border-slate-50">
        <p className="text-[10px] text-slate-400 text-center italic">
          Els canvis es guarden automàticament al teu perfil d'ADEPTIFY.
        </p>
      </div>
    </div>
  );
};

export default NotificationSettings;
