
import React, { useState, useEffect, useRef } from 'react';
import { createAdeptifyChat } from '../services/geminiService';
import { consultationService } from '../services/consultationService';
import { GenerateContentResponse } from '@google/genai';
import { ChatMessage } from '../types';

interface AdeptifyChatProps {
  centerId?: string; 
}

const AdeptifyChat: React.FC<AdeptifyChatProps> = ({ centerId = 'default_user' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const chatRef = useRef<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      const history = consultationService.getChatHistory(centerId);
      setMessages(history);
      if (!chatRef.current) {
        chatRef.current = createAdeptifyChat();
      }
    }
  }, [isOpen, centerId]);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [messages, isTyping]);

  const sendMessage = async () => {
    if (!input.trim() || isTyping) return;
    
    const userText = input.trim();
    const userMsg: ChatMessage = { role: 'user', text: userText, timestamp: new Date().toISOString() };
    
    setInput('');
    setMessages(prev => [...prev, userMsg]);
    consultationService.saveChatMessage(centerId, userMsg);
    
    setIsTyping(true);

    try {
      const result = await chatRef.current.sendMessage({ message: userText });
      const response = result as GenerateContentResponse;
      const modelMsg: ChatMessage = { 
        role: 'model', 
        text: response.text || "Estic analitzant la teva petició per donar-te la millor resposta.", 
        timestamp: new Date().toISOString() 
      };
      
      setMessages(prev => [...prev, modelMsg]);
      consultationService.saveChatMessage(centerId, modelMsg);
    } catch (error) {
      const errorMsg: ChatMessage = { role: 'model', text: "Error de connexió.", timestamp: new Date().toISOString() };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      {isOpen && (
        <div className="w-80 md:w-96 h-[550px] bg-white rounded-3xl shadow-2xl border border-slate-200 mb-4 flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
          <div className="bg-slate-900 p-4 text-white flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse shadow-lg shadow-green-500/20" />
              <div>
                <p className="font-black text-xs uppercase tracking-widest">Adeptify Systems Consultant</p>
                <p className="text-[8px] text-slate-400 font-bold uppercase">Centre: {centerId}</p>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-white/10 rounded-xl transition-all">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-50 custom-scrollbar">
            {messages.length === 0 && (
              <div className="text-center py-12 px-6">
                <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                   <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                </div>
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2">Canal Consultoria</p>
                <p className="text-sm text-slate-500 leading-relaxed font-medium">Estic aquí per ajudar-te a dissenyar el centre del futur. Pregunta'm qualsevol detall del teu pla.</p>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] p-4 rounded-2xl text-[13px] leading-relaxed ${
                  m.role === 'user' 
                    ? 'bg-indigo-600 text-white font-bold rounded-tr-none shadow-lg shadow-indigo-100' 
                    : 'bg-white text-slate-700 font-bold border border-slate-200 rounded-tl-none shadow-sm'
                }`}>
                  {m.text}
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-white p-4 rounded-2xl border border-slate-200 flex gap-1.5 shadow-sm">
                  <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" />
                  <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                  <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.4s]" />
                </div>
              </div>
            )}
          </div>

          <div className="p-4 bg-white border-t border-slate-100">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Escriu aquí..."
                className="flex-1 text-sm font-bold p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendMessage()}
              />
              <button 
                onClick={sendMessage} 
                className="bg-indigo-600 text-white p-3 rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 active:scale-90"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
              </button>
            </div>
          </div>
        </div>
      )}

      <button
        onClick={() => setIsOpen(!isOpen)}
        className="h-16 w-16 bg-slate-900 text-white rounded-2xl flex items-center justify-center shadow-2xl hover:bg-indigo-600 transition-all hover:scale-110 active:scale-95 group overflow-hidden"
      >
        <div className="relative">
          <svg className="w-7 h-7 group-hover:rotate-12 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        </div>
      </button>
      
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
      `}</style>
    </div>
  );
};

export default AdeptifyChat;
