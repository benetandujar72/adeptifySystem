
import React, { useState, useEffect } from 'react';
import { consultationService } from '../services/consultationService';
import { supabase } from '../services/supabaseClient';
import { Consultation, ChatMessage } from '../types';

type AdminTab = 'overview' | 'clients' | 'proposals' | 'chats' | 'reports';

const AdminRegistry: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [selectedClient, setSelectedClient] = useState<Consultation | null>(null);
  const [clientChats, setClientChats] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dbMode, setDbMode] = useState<'Núvol' | 'Local'>('Local');

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setIsLoading(true);
    try {
      setDbMode(supabase ? 'Núvol' : 'Local');
      const data = await consultationService.getAll();
      setConsultations(data);
      if (data.length > 0 && !selectedClient) {
        setSelectedClient(data[0]);
      }
    } catch (e) {
      console.error("Error carregant dades d'administració");
    } finally {
      setIsLoading(false);
    }
  };

  const loadClientChats = async (centerId: string) => {
    const history = await consultationService.getChatHistory(centerId);
    setClientChats(history);
  };

  useEffect(() => {
    if (selectedClient && activeTab === 'chats') {
      loadClientChats(selectedClient.centerName);
    }
  }, [selectedClient, activeTab]);

  const totalInvestment = consultations.reduce((acc, c) => acc + (c.proposal?.totalInitial || 0), 0);

  return (
    <div className="flex flex-col lg:flex-row gap-8 min-h-[80vh] animate-in fade-in duration-700">
      
      {/* SIDEBAR NAVIGATION */}
      <aside className="lg:w-64 flex flex-col gap-2 shrink-0">
        <div className="bg-slate-900 rounded-[2rem] p-6 mb-4 shadow-xl border border-white/5">
           <p className="text-[8px] font-black text-indigo-400 uppercase tracking-[0.3em] mb-1">Status</p>
           <div className="flex items-center gap-2">
             <div className={`w-2 h-2 rounded-full ${dbMode === 'Núvol' ? 'bg-green-500 animate-pulse' : 'bg-amber-500'}`} />
             <span className="text-[9px] font-black text-white uppercase tracking-widest">{dbMode} Online</span>
           </div>
        </div>

        {[
          { id: 'overview', label: 'Dashboard', icon: 'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z' },
          { id: 'clients', label: 'Clients & Centres', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z' },
          { id: 'proposals', label: 'Pressupostos', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
          { id: 'chats', label: 'Històric Xats', icon: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z' },
          { id: 'reports', label: 'Informes Global', icon: 'M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as AdminTab)}
            className={`flex items-center gap-4 p-5 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${
              activeTab === tab.id 
                ? 'bg-slate-900 text-white shadow-lg border border-white/10' 
                : 'bg-white text-slate-400 hover:bg-slate-50 border border-slate-100'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={tab.icon} />
            </svg>
            {tab.label}
          </button>
        ))}
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 space-y-8">
        
        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col justify-between h-48">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Centres en Auditoria</p>
               <h4 className="text-5xl font-serif italic text-slate-900">{consultations.length}</h4>
               <p className="text-[9px] text-green-600 font-bold">+12% vs mes anterior</p>
            </div>
            <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white shadow-2xl flex flex-col justify-between h-48 border border-white/5">
               <p className="text-[10px] font-black text-indigo-300 uppercase tracking-widest">Volum de Pressupostos</p>
               <h4 className="text-4xl font-serif italic">{totalInvestment.toLocaleString()}€</h4>
               <p className="text-[9px] text-white/40 font-bold uppercase tracking-widest italic">Actiu Adeptify Systems</p>
            </div>
            <div className="bg-indigo-600 p-8 rounded-[2.5rem] text-white shadow-xl flex flex-col justify-between h-48">
               <p className="text-[10px] font-black text-white/70 uppercase tracking-widest">Temps mig d'automatització</p>
               <h4 className="text-5xl font-serif italic">4.2<span className="text-xl ml-1 font-sans font-bold">dies</span></h4>
               <div className="h-1.5 w-full bg-white/20 rounded-full overflow-hidden">
                  <div className="h-full bg-white w-3/4" />
               </div>
            </div>

            <div className="md:col-span-3 bg-white p-10 rounded-[2.5rem] border border-slate-100">
               <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-8">Últimes Consultes Estratègiques</h3>
               <div className="overflow-x-auto">
                 <table className="w-full">
                    <thead>
                      <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-50">
                        <th className="text-left pb-4">Centre Educatiu</th>
                        <th className="text-left pb-4">Producte</th>
                        <th className="text-left pb-4">Data</th>
                        <th className="text-right pb-4">Estat</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {consultations.slice(0, 5).map(c => (
                        <tr key={c.id} className="group hover:bg-slate-50/50 transition-colors">
                          <td className="py-4 font-bold text-slate-800 text-sm">{c.centerName}</td>
                          <td className="py-4 text-[10px] font-black text-indigo-600 uppercase tracking-widest">{c.selectedProduct}</td>
                          <td className="py-4 text-xs text-slate-400 font-medium">{new Date(c.date).toLocaleDateString()}</td>
                          <td className="py-4 text-right">
                            <span className="inline-block px-3 py-1 bg-green-50 text-green-700 text-[9px] font-black uppercase rounded-lg">Validat</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                 </table>
               </div>
            </div>
          </div>
        )}

        {/* TAB 2: CLIENTS */}
        {activeTab === 'clients' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-4 space-y-3 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
               {consultations.map(c => (
                 <button
                   key={c.id}
                   onClick={() => setSelectedClient(c)}
                   className={`w-full text-left p-6 rounded-3xl border-2 transition-all ${
                     selectedClient?.id === c.id 
                       ? 'bg-slate-900 border-slate-900 text-white shadow-xl scale-[1.02]' 
                       : 'bg-white border-slate-100 hover:border-indigo-200 text-slate-800'
                   }`}
                 >
                   <h4 className="font-black text-sm uppercase truncate mb-1">{c.centerName}</h4>
                   <p className="text-[10px] text-slate-400 font-medium truncate">{c.contactEmail}</p>
                 </button>
               ))}
            </div>
            
            <div className="lg:col-span-8">
               {selectedClient ? (
                 <div className="bg-white rounded-[2.5rem] p-10 border border-slate-100 shadow-2xl space-y-8 animate-in slide-in-from-right-8">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-3xl font-black text-slate-900 mb-1">{selectedClient.centerName}</h3>
                        <p className="text-indigo-600 font-bold uppercase text-[10px] tracking-[0.3em]">{selectedClient.id}</p>
                      </div>
                      <div className="bg-slate-50 px-4 py-2 rounded-xl text-center">
                         <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Inversió</p>
                         <p className="font-serif italic font-bold text-slate-900">{(selectedClient.proposal?.totalInitial || 0).toLocaleString()}€</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-8">
                       <div className="space-y-4">
                          <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b pb-2">Diagnòstic IA</h5>
                          <p className="text-xs text-slate-600 leading-relaxed italic">"{selectedClient.proposal?.diagnosis}"</p>
                       </div>
                       <div className="space-y-4">
                          <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b pb-2">Contacte Tècnic</h5>
                          <div className="space-y-1">
                             <p className="text-xs font-bold text-slate-800">{selectedClient.contactEmail}</p>
                             <p className="text-[10px] text-slate-400">Captat via Auditoria {selectedClient.selectedProduct}</p>
                          </div>
                       </div>
                    </div>

                    <div className="pt-6 border-t border-slate-50 flex gap-4">
                       <button className="flex-1 bg-slate-900 text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-600 transition-all">Enviar Contracte</button>
                       <button className="flex-1 bg-white border border-slate-200 text-slate-400 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:border-slate-400 transition-all">Archivar</button>
                    </div>
                 </div>
               ) : (
                 <div className="h-64 flex items-center justify-center bg-slate-50 rounded-[2.5rem] border-2 border-dashed border-slate-100 text-slate-300 italic text-sm">
                    Selecciona un client per veure els detalls
                 </div>
               )}
            </div>
          </div>
        )}

        {/* TAB 4: CHATS */}
        {activeTab === 'chats' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-4 space-y-3">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-4 mb-4">Converses Recents</p>
               {consultations.map(c => (
                 <button
                   key={c.id}
                   onClick={() => setSelectedClient(c)}
                   className={`w-full text-left p-6 rounded-3xl border-2 transition-all flex items-center gap-4 ${
                     selectedClient?.id === c.id 
                       ? 'bg-indigo-600 border-indigo-600 text-white shadow-xl scale-[1.02]' 
                       : 'bg-white border-slate-100 hover:border-indigo-200 text-slate-800 shadow-sm'
                   }`}
                 >
                   <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${selectedClient?.id === c.id ? 'bg-white/20' : 'bg-slate-50 text-indigo-600'}`}>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                   </div>
                   <div className="truncate">
                      <h4 className="font-black text-xs uppercase truncate">{c.centerName}</h4>
                      <p className={`text-[9px] font-bold ${selectedClient?.id === c.id ? 'text-white/60' : 'text-slate-400'}`}>Consultoria IA Activa</p>
                   </div>
                 </button>
               ))}
            </div>

            <div className="lg:col-span-8">
               <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-2xl h-[70vh] flex flex-col overflow-hidden">
                  <div className="pb-6 border-b border-slate-50 flex justify-between items-center shrink-0">
                    <div>
                      <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Transcripció Històrica: {selectedClient?.centerName}</h3>
                      <p className="text-[9px] text-slate-400 font-bold uppercase mt-1 tracking-widest">Seguretat Adeptify Systems</p>
                    </div>
                    <button
                      type="button"
                      className="p-3 bg-slate-50 rounded-xl text-slate-400 hover:text-indigo-600 transition-colors"
                      aria-label="Descarregar transcripció"
                      title="Descarregar transcripció"
                    >
                       <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-slate-50/20">
                    {clientChats.length > 0 ? (
                      clientChats.map((m, i) => (
                        <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[80%] p-5 rounded-[1.5rem] text-[12px] shadow-sm ${
                            m.role === 'user' ? 'bg-slate-900 text-white font-bold rounded-tr-none' : 'bg-white text-slate-600 border border-slate-100 rounded-tl-none font-medium leading-relaxed'
                          }`}>
                            <p className="mb-1 opacity-40 text-[8px] uppercase tracking-widest font-black">{m.role === 'user' ? 'Directiu' : 'IA Adeptify'}</p>
                            {m.text}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center opacity-20 text-center">
                        <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                        <p className="text-xs font-black uppercase tracking-[0.4em]">No s'han trobat converses per aquest client</p>
                      </div>
                    )}
                  </div>
               </div>
            </div>
          </div>
        )}

        {/* TAB 3: PROPOSALS */}
        {activeTab === 'proposals' && (
          <div className="bg-white rounded-[2.5rem] p-10 border border-slate-100 shadow-2xl">
             <div className="flex justify-between items-center mb-10">
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Registre Global de Pressupostos</h3>
                <div className="flex bg-slate-50 p-1 rounded-xl">
                   <button className="px-4 py-2 bg-white rounded-lg text-[9px] font-black uppercase shadow-sm">Tots</button>
                   <button className="px-4 py-2 text-[9px] font-black uppercase text-slate-400">Pendent</button>
                   <button className="px-4 py-2 text-[9px] font-black uppercase text-slate-400">Aceptats</button>
                </div>
             </div>
             
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {consultations.map(c => (
                  <div key={c.id} className="bg-slate-50 p-8 rounded-[2rem] border border-slate-100 hover:border-indigo-200 transition-all group flex flex-col justify-between h-72">
                     <div>
                        <div className="flex justify-between items-start mb-4">
                           <span className="text-[8px] font-black px-2 py-0.5 bg-indigo-100 text-indigo-600 rounded uppercase tracking-widest">{c.selectedProduct}</span>
                           <span className="text-[9px] font-bold text-slate-400">{new Date(c.date).toLocaleDateString()}</span>
                        </div>
                        <h4 className="font-black text-sm text-slate-900 uppercase mb-2 truncate">{c.centerName}</h4>
                        <p className="text-[10px] text-slate-400 font-medium italic line-clamp-3">"{c.proposal?.diagnosis}"</p>
                     </div>
                     <div className="pt-6 border-t border-slate-200/50 flex justify-between items-end">
                        <div>
                           <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Inversió</p>
                           <p className="text-2xl font-serif italic font-bold text-slate-900">{(c.proposal?.totalInitial || 0).toLocaleString()}€</p>
                        </div>
                      <button
                        type="button"
                        className="p-3 bg-slate-900 text-white rounded-2xl hover:bg-indigo-600 transition-all"
                        aria-label="Ver detalles del presupuesto"
                        title="Ver detalles del presupuesto"
                      >
                           <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" /></svg>
                        </button>
                     </div>
                  </div>
                ))}
             </div>
          </div>
        )}

      </main>
      
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
      `}</style>
    </div>
  );
};

export default AdminRegistry;
