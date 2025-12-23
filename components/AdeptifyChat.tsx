
import React, { useState, useEffect, useRef } from 'react';
import { createAdeptifyChat } from '../services/geminiService';
import { consultationService } from '../services/consultationService';
import { GenerateContentResponse } from '@google/genai';
import { ChatMessage, Consultation } from '../types';

interface AdeptifyChatProps {
  centerId?: string; 
}

const AdeptifyChat: React.FC<AdeptifyChatProps> = ({ centerId = 'general' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const chatRef = useRef<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Funció per construir el context del client des de la base de dades local
  const getClientContext = (): string => {
    const consultations = consultationService.getAll();
    // Busquem l'última consulta que coincideixi amb el nom del centre o l'ID
    const clientData = consultations.find(c => c.centerName === centerId) || consultations[consultations.length - 1];
    
    if (!clientData) return "Client nou sense dades d'auditoria prèvies.";

    return `
      DADES DEL CENTRE:
      - Nom: ${clientData.centerName}
      - Email: ${clientData.contactEmail}
      - Producte d'Interès: ${clientData.selectedProduct}
      
      DIAGNÒSTIC DETECTAT EN L'AUDITORIA:
      ${clientData.proposal?.diagnosis || 'Pendent de generar'}
      
      SOLUCIÓ PROPOSADA:
      ${clientData.proposal?.solution || 'Pendent de generar'}
      
      DETALLS DEL PRESSUPOST:
      ${clientData.proposal?.items?.map(i => `- ${i.concept}: ${i.price}€`).join('\n') || 'Pendent'}
      Total Inicial: ${clientData.proposal?.totalInitial}€
      
      HISTORIAL DE PREGUNTES DE L'AUDITORIA:
      ${clientData.consultationHistory?.map(h => `Q: ${h.question} | A: ${h.answer}`).join('\n') || 'Cap'}
    `;
  };

  useEffect(() => {
    if (isOpen) {
      const history = consultationService.getChatHistory(centerId);
      setMessages(history);
      
      // Inicialitzem el xat amb el context actualitzat del client
      const context = getClientContext();
      chatRef.current = createAdeptifyChat(context);
    }
  }, [isOpen, centerId]);

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
      const errorMsg: ChatMessage = { role: 'model', text: "Error de connexió o sessió caducada.", timestamp: new Date().toISOString() };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  const renderFormattedText = (text: string) => {
    return text.split('\n').map((line, index) => {
      let content: React.ReactNode = line;
      let className = "mb-2 block";

      if (line.startsWith('###') || line.startsWith('##')) {
        content = line.replace(/#/g, '').replace(/\*/g, '').trim();
        className = "text-[14px] font-black uppercase tracking-tight text-indigo-600 mt-6 mb-3 border-l-4 border-indigo-600 pl-3";
      } 
      else if (line.includes('**')) {
        const parts = line.split('**');
        content = parts.map((part, i) => i % 2 === 1 ? <strong key={i} className="font-black text-slate-900">{part}</strong> : part);
      }
      
      if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
        const cleanLine = line.trim().replace(/^[\-\*]\s?/, '');
        const parts = cleanLine.split('**');
        content = (
          <span className="flex items-start gap-3">
            <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
            <span className="text-slate-700">
              {parts.map((part, i) => i % 2 === 1 ? <strong key={i} className="font-black text-slate-900">{part}</strong> : part)}
            </span>
          </span>
        );
        className = "mb-3 pl-2";
      }

      if (line.trim() === '---') {
        return <div key={index} className="h-px bg-slate-200 w-full my-6" />;
      }

      if (/^\d+\.\s/.test(line.trim())) {
        const cleanLine = line.trim().replace(/^\d+\.\s?/, '');
        const parts = cleanLine.split('**');
        content = (
          <span className="flex items-start gap-3">
            <span className="text-indigo-600 font-black italic">{line.match(/^\d+/)?.[0]}.</span>
            <span className="text-slate-700">
              {parts.map((part, i) => i % 2 === 1 ? <strong key={i} className="font-black text-slate-900">{part}</strong> : part)}
            </span>
          </span>
        );
        className = "mb-4 bg-indigo-50/30 p-3 rounded-xl border-l-2 border-indigo-200";
      }

      if (!line.trim()) return <div key={index} className="h-2" />;

      return <span key={index} className={className}>{content}</span>;
    });
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      {isOpen && (
        <div className="w-80 md:w-[450px] h-[650px] bg-white rounded-[2.5rem] shadow-2xl border border-slate-200 mb-4 flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
          <div className="bg-slate-900 p-6 text-white flex justify-between items-center shrink-0">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              </div>
              <div>
                <p className="font-black text-[11px] uppercase tracking-[0.3em] text-white">Consultor Adeptify</p>
                <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">Base de dades del projecte activa</p>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-white/10 rounded-xl transition-all">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#F8FAFC] custom-scrollbar">
            {messages.length === 0 && (
              <div className="text-center py-16 px-10">
                <div className="w-20 h-20 bg-white border border-slate-100 text-indigo-600 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-xl">
                   <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                </div>
                <p className="text-[10px] font-black uppercase text-indigo-500 tracking-[0.3em] mb-3 italic">Centre: {centerId}</p>
                <p className="text-sm text-slate-500 leading-relaxed font-bold italic">Hola! He analitzat el context del teu centre. Tens alguna pregunta sobre el pressupost, les fases o els punts crítics detectats?</p>
              </div>
            )}
            
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                <div className={`max-w-[90%] p-6 rounded-[2rem] text-[13px] leading-relaxed shadow-sm ${
                  m.role === 'user' 
                    ? 'bg-slate-900 text-white font-bold rounded-tr-none border-l-4 border-indigo-600' 
                    : 'bg-white text-slate-700 border border-slate-200 rounded-tl-none font-medium'
                }`}>
                  {m.role === 'model' ? renderFormattedText(m.text) : m.text}
                </div>
              </div>
            ))}
            
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-white p-5 rounded-[1.5rem] border border-slate-200 flex gap-1.5 shadow-sm">
                  <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" />
                  <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                  <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.4s]" />
                </div>
              </div>
            )}
          </div>

          <div className="p-6 bg-white border-t border-slate-100 shrink-0 shadow-[0_-10px_40px_rgba(0,0,0,0.03)]">
            <div className="flex gap-3">
              <input
                type="text"
                placeholder="Pregunta sobre el teu projecte..."
                className="flex-1 text-[13px] font-bold p-5 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:border-indigo-600 transition-all shadow-inner"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendMessage()}
              />
              <button 
                onClick={sendMessage} 
                className="bg-slate-900 text-white p-5 rounded-2xl hover:bg-indigo-600 transition-all shadow-xl active:scale-95 flex items-center justify-center shrink-0"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
              </button>
            </div>
            <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest mt-3 text-center opacity-60 italic">Personalitzat amb dades del teu centre</p>
          </div>
        </div>
      )}

      <button
        onClick={() => setIsOpen(!isOpen)}
        className="h-20 w-20 bg-slate-900 text-white rounded-[2rem] flex items-center justify-center shadow-[0_20px_60px_rgba(0,0,0,0.2)] hover:bg-indigo-600 transition-all hover:scale-110 active:scale-95 group relative border-4 border-white"
      >
        <div className="absolute -top-1 -right-1 w-5 h-5 bg-indigo-500 rounded-full border-2 border-white animate-pulse" />
        <svg className="w-9 h-9" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      </button>
      
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
      `}</style>
    </div>
  );
};

export default AdeptifyChat;
