
import React, { useState, useEffect } from 'react';
import { consultationService } from '../services/consultationService';
import { supabase } from '../services/supabaseClient';
import { Consultation } from '../types';

const AdminRegistry: React.FC = () => {
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [selectedLead, setSelectedLead] = useState<Consultation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [dbMode, setDbMode] = useState<'Núvol' | 'Local'>('Local');

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        setDbMode(supabase ? 'Núvol' : 'Local');
        const data = await consultationService.getAll();
        setConsultations(data);
      } catch (e) {
        console.error("Error carregant dades de registre");
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in duration-500">
      {/* Sidebar de Leads */}
      <div className="lg:col-span-4 space-y-6">
        <div className="flex items-center justify-between bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
          <div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight uppercase">Centre de Control</h2>
            <div className="flex items-center gap-2 mt-1">
              <div className={`w-2 h-2 rounded-full ${dbMode === 'Núvol' ? 'bg-green-500 animate-pulse' : 'bg-amber-500'}`} />
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
                Emmagatzematge: {dbMode} {dbMode === 'Local' ? '(Mode Fora de Línia)' : 'Base de Dades'}
              </span>
            </div>
          </div>
          <div className="bg-slate-900 text-white px-4 py-2 rounded-2xl text-[10px] font-black">
            {isLoading ? '...' : `${consultations.length} CONTACTES`}
          </div>
        </div>

        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
          {isLoading ? (
            <div className="space-y-3">
              {[1,2,3].map(i => (
                <div key={i} className="h-32 bg-slate-100 rounded-[2rem] animate-pulse" />
              ))}
            </div>
          ) : (
            consultations.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedLead(c)}
                className={`w-full text-left p-6 rounded-[2rem] border-2 transition-all group ${
                  selectedLead?.id === c.id 
                    ? 'bg-slate-900 border-slate-900 text-white shadow-2xl scale-[1.02]' 
                    : 'bg-white border-slate-100 hover:border-indigo-200 text-slate-800'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className={`text-[8px] font-black px-2 py-0.5 rounded uppercase ${selectedLead?.id === c.id ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
                    {c.selectedProduct}
                  </span>
                  <span className="text-[9px] font-bold opacity-40">{new Date(c.date).toLocaleDateString()}</span>
                </div>
                <h4 className="font-black text-sm uppercase truncate mb-1">{c.centerName}</h4>
                <p className={`text-[10px] truncate ${selectedLead?.id === c.id ? 'text-indigo-300' : 'text-slate-400'}`}>{c.contactEmail}</p>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Detalle del Lead */}
      <div className="lg:col-span-8 space-y-6">
        {selectedLead ? (
          <div className="bg-white rounded-[2.5rem] p-10 border border-slate-100 shadow-2xl animate-in slide-in-from-right-8 duration-500">
            <div className="flex justify-between items-start mb-8">
              <div>
                <h3 className="text-3xl font-black text-slate-900 mb-1">{selectedLead.centerName}</h3>
                <p className="text-indigo-600 font-bold uppercase text-xs tracking-widest">{selectedLead.id}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Inversió Estimada</p>
                <p className="text-3xl font-brand italic text-slate-900">{(selectedLead.proposal?.totalInitial || 0).toLocaleString()}€</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
              <div className="space-y-4">
                <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em] border-b pb-2">Diagnòstic IA (Estructurat)</h4>
                <div className="bg-slate-50 p-6 rounded-3xl text-xs font-medium text-slate-600 leading-relaxed italic border border-slate-100">
                  "{selectedLead.proposal?.diagnosis}"
                </div>
              </div>
              <div className="space-y-4">
                <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em] border-b pb-2">Full de Ruta Tècnic</h4>
                <div className="space-y-2">
                  {selectedLead.proposal?.phases?.map((p, i) => (
                    <div key={i} className="flex items-center gap-3 text-[10px] font-bold text-slate-500">
                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                      <span>S{p.startWeek}: {p.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-slate-900 rounded-3xl p-6 text-indigo-300 font-mono text-[10px] mb-8 overflow-hidden">
              <p className="mb-2 text-white border-b border-white/10 pb-2 uppercase tracking-widest opacity-50">Protocol de Connectivitat de Dades</p>
              <pre className="opacity-80">
                {dbMode === 'Núvol' 
                  ? `-- Connectat al Clúster de Supabase \nSELECT * FROM consultations WHERE id = '${selectedLead.id}';`
                  : `-- Operant en Sandbox de LocalStorage \nlocalStorage.getItem('adeptify_fallback_consultations');`}
              </pre>
            </div>

            <div className="flex gap-4">
              <button className="flex-1 bg-slate-900 text-white py-5 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:scale-[1.02] transition-all">Exportar Contacte Principal</button>
              <button className="flex-1 bg-indigo-600 text-white py-5 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:scale-[1.02] transition-all">Notificar Centre</button>
            </div>
          </div>
        ) : (
          <div className="h-full min-h-[500px] flex flex-col items-center justify-center bg-white rounded-[2.5rem] border-2 border-dashed border-slate-100 text-slate-300">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
            </div>
            <p className="text-xs font-black uppercase tracking-[0.4em]">Esperant selecció de dades</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminRegistry;
