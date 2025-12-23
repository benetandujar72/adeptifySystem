
import React, { useState, useEffect, useRef } from 'react';
import { createAdeptifyChat } from '../services/geminiService';
import { consultationService } from '../services/consultationService';
import { GenerateContentResponse } from '@google/genai';
import { ChatMessage } from '../types';
import { useLanguage } from '../LanguageContext';

interface AdeptifyChatProps {
  centerId?: string; 
}

const AdeptifyChat: React.FC<AdeptifyChatProps> = ({ centerId = 'general' }) => {
  const { language, t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const chatRef = useRef<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const getClientContext = async (): Promise<string> => {
    const consultations = await consultationService.getAll();
    const clientData = consultations.find(c => c.centerName === centerId) || consultations[0];
    
    if (!clientData) return language === 'ca' ? "Parlem d'ajudar l'escola." : "Hablemos de ayudar al colegio.";

    return `
      CENTRO: ${clientData.centerName}
      CONTEXTO: ${clientData.proposal?.diagnosis || 'Falta de tiempo'}
    `;
  };

  useEffect(() => {
    const initChat = async () => {
      if (isOpen) {
        const context = await getClientContext();
        chatRef.current = createAdeptifyChat(context, language);
        // Carreguem historial previ
        const history = await consultationService.getChatHistory(centerId);
        if (history.length > 0) setMessages(history);
      }
    };
    initChat();
  }, [isOpen, centerId, language]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const sendMessage = async () => {
    if (!input.trim() || isTyping) return;
    
    const userText = input.trim();
    const userMsg: ChatMessage = { role: 'user', text: userText, timestamp: new Date().toISOString() };
    
    setInput('');
    setMessages(prev => [...prev, userMsg]);
    setIsTyping(true);

    // Guardem missatge d'usuari
    await consultationService.saveChatMessage(centerId, userMsg);

    try {
      const result = await chatRef.current.sendMessage({ message: userText });
      const response = result as GenerateContentResponse;
      const modelMsg: ChatMessage = { 
        role: 'model', 
        text: response.text || (language === 'ca' ? "Ho sento, em pots repetir?" : "Lo siento, ¿me puedes repetir?"), 
        timestamp: new Date().toISOString() 
      };
      setMessages(prev => [...prev, modelMsg]);
      
      // Guardem missatge del model
      await consultationService.saveChatMessage(centerId, modelMsg);
    } catch (error) {
      const errorMsg: ChatMessage = { role: 'model', text: "Error de conexión.", timestamp: new Date().toISOString() };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      {isOpen && (
        <div className="w-80 md:w-[450px] h-[650px] bg-white rounded-[2.5rem] shadow-2xl border border-slate-200 mb-4 flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
          <div className="bg-slate-950 p-6 text-white flex justify-between items-center shrink-0 border-b border-indigo-500/20">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/40">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              </div>
              <div>
                <p className="font-black text-[11px] uppercase tracking-[0.3em] text-white">{t.chatTitle}</p>
                <p className="text-[9px] text-indigo-400 font-bold uppercase tracking-widest mt-0.5">{t.chatSubtitle}</p>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-white/10 rounded-xl transition-all">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#FDFDFD] custom-scrollbar">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                <div className={`max-w-[90%] p-6 rounded-[2rem] text-[13px] shadow-sm ${
                  m.role === 'user' ? 'bg-slate-900 text-white font-bold rounded-tr-none' : 'bg-white text-slate-700 border border-slate-100 rounded-tl-none font-medium'
                }`}>
                  {m.text}
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="flex justify-start px-6 animate-pulse">
                <div className="text-[10px] text-indigo-600 font-black uppercase tracking-widest flex items-center gap-2">
                   {t.chatThinking}
                </div>
              </div>
            )}
          </div>

          <div className="p-6 bg-white border-t border-slate-100 shadow-[0_-10px_40px_rgba(0,0,0,0.02)]">
            <div className="flex gap-3">
              <input
                type="text"
                placeholder={t.chatPlaceholder}
                className="flex-1 text-[13px] font-bold p-5 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:border-indigo-600 transition-all shadow-inner"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendMessage()}
              />
              <button onClick={sendMessage} className="bg-slate-900 text-white p-5 rounded-2xl hover:bg-indigo-600 transition-all shadow-xl active:scale-95 group">
                <svg className="w-6 h-6 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
              </button>
            </div>
          </div>
        </div>
      )}
      <button onClick={() => setIsOpen(!isOpen)} className="h-20 w-20 bg-slate-950 text-white rounded-[2rem] flex items-center justify-center shadow-2xl hover:bg-indigo-600 transition-all hover:scale-105 active:scale-95 border-4 border-white group relative">
        <svg className="w-9 h-9" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
      </button>
    </div>
  );
};

export default AdeptifyChat;
