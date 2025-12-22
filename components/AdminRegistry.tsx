
import React, { useState, useEffect } from 'react';
import { consultationService } from '../services/consultationService';
import { Consultation, ChatMessage } from '../types';

const AdminRegistry: React.FC = () => {
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [selectedLead, setSelectedLead] = useState<Consultation | null>(null);

  useEffect(() => {
    setConsultations(consultationService.getAll());
  }, []);

  const calculateIACost = (consultation: Consultation) => {
    // Estimació: 0.0005€ per pregunta + 0.01€ per proposta
    const questionsCount = consultation.consultationHistory?.length || 0;
    return (questionsCount * 0.0005 + 0.01).toFixed(4);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in duration-500">
      <div className="lg:col-span-4 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Dashboard Admin</h2>
          <div className="bg-indigo-600 text-white px-4 py-1 rounded-full text-[10px] font-black">{consultations.length} Leads</div>
        </div>

        <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
          {consultations.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedLead(c)}
              className={`w-full text-left p-5 rounded-3xl border-2 transition-all ${
                selectedLead?.id === c.id 
                  ? 'bg-slate-900 border-slate-900 text-white shadow-2xl scale-[1.02]' 
                  : 'bg-white border-slate-100 hover:border-indigo-200 text-slate-800'
              }`}
            >
              <h4 className="font-black text-xs uppercase mb-1 truncate">{c.centerName}</h4>
              <div className="flex justify-between items-center mt-2">
                 <span className={`text-[9px] font-bold ${selectedLead?.id === c.id ? 'text-indigo-400' : 'text-slate-400'}`}>{new Date(c.date).toLocaleDateString()}</span>
                 <span className="text-[9px] font-black bg-green-100 text-green-700 px-2 py-0.5 rounded-md">Cost IA: {calculateIACost(c)}€</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="lg:col-span-8">
        {selectedLead ? (
          <div className="bg-white rounded-[2.5rem] p-10 border border-slate-100 shadow-2xl animate-in slide-in-from-right-8 duration-500">
            <h3 className="text-3xl font-black text-slate-900 mb-2">{selectedLead.centerName}</h3>
            <p className="text-indigo-600 font-bold mb-8">{selectedLead.contactEmail}</p>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Marge Estimat</p>
                <p className="text-lg font-black text-slate-800">99.9%</p>
              </div>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Cost IA Tòkens</p>
                <p className="text-lg font-black text-indigo-600">{calculateIACost(selectedLead)}€</p>
              </div>
            </div>

            <section className="mb-10">
              <h4 className="text-[11px] font-black text-slate-900 uppercase mb-4 tracking-widest border-b pb-2">Auditoria Transcrita</h4>
              <div className="space-y-4 max-h-[300px] overflow-y-auto pr-4 custom-scrollbar">
                {selectedLead.consultationHistory?.map((h, i) => (
                  <div key={i} className="text-xs space-y-1">
                    <p className="font-black text-indigo-600">Q: {h.question}</p>
                    <p className="font-bold text-slate-600">A: {h.answer}</p>
                  </div>
                ))}
              </div>
            </section>

            <div className="flex gap-4">
              <button className="flex-1 bg-slate-900 text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest">Descarregar PDF Lead</button>
              <button className="flex-1 bg-indigo-600 text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest">Activar CRM</button>
            </div>
          </div>
        ) : (
          <div className="h-full min-h-[500px] flex flex-col items-center justify-center bg-white rounded-[2.5rem] border-2 border-dashed border-slate-100 text-slate-300">
            <p className="text-xs font-black uppercase tracking-[0.3em]">Selecciona un lead per veure el desglossament</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminRegistry;
