
import React, { useState, useRef } from 'react';
import { generateOfficialDocument } from '../services/geminiService';

const DocGenerator: React.FC = () => {
  const [docType, setDocType] = useState<'PGA' | 'MEMORIA'>('PGA');
  const [pecContext, setPecContext] = useState('');
  const [indicators, setIndicators] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState('');
  const [isPreview, setIsPreview] = useState(true);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setUploadedFiles(Array.from(e.target.files));
      // En un entorn real, aquí processaríem el PDF per extreure text
      alert("Documents rebuts. La IA analitzarà el contingut dels PDFs per context.");
    }
  };

  const handleGenerate = async (preview: boolean) => {
    if (!pecContext && uploadedFiles.length === 0) {
      alert("Si us plau, omple el context o puja un document de referència.");
      return;
    }
    setIsGenerating(true);
    setIsPreview(preview);
    try {
      const draft = await generateOfficialDocument(docType, pecContext, indicators, preview);
      setResult(draft);
    } catch (e) {
      alert("Error generant el document.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in slide-in-from-bottom-8 duration-500">
      
      {/* Columna de Configuració */}
      <div className="lg:col-span-5 bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-2xl space-y-8">
        <div>
          <h3 className="text-2xl font-black text-slate-800 mb-2 uppercase tracking-tight">Redactor Estratègic</h3>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">PGA & Memòria Anual Assistida per IA</p>
        </div>
        
        <div className="space-y-6">
          {/* Selector de document */}
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">1. Tipus de Document</label>
            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={() => setDocType('PGA')}
                className={`py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all ${docType === 'PGA' ? 'bg-indigo-600 text-white shadow-xl scale-105' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}
              >
                PGA (Inici)
              </button>
              <button 
                onClick={() => setDocType('MEMORIA')}
                className={`py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all ${docType === 'MEMORIA' ? 'bg-indigo-600 text-white shadow-xl scale-105' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}
              >
                Memòria (Final)
              </button>
            </div>
          </div>

          {/* Càrrega de dades */}
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">2. Context Pedagògic (PEC/PDF)</label>
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="group cursor-pointer p-6 border-2 border-dashed border-slate-200 rounded-3xl hover:border-indigo-500 hover:bg-indigo-50/50 transition-all text-center mb-4"
            >
              <input type="file" ref={fileInputRef} onChange={handleFileChange} multiple hidden accept=".pdf,.doc,.docx" />
              <svg className="w-8 h-8 mx-auto mb-2 text-slate-300 group-hover:text-indigo-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
              <p className="text-[10px] font-black text-slate-400 uppercase group-hover:text-indigo-600 transition-colors">
                {uploadedFiles.length > 0 ? `${uploadedFiles.length} fitxers pujats` : "Pujar PEC o Documents Oficials (PDF)"}
              </p>
            </div>
            <textarea 
              className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-3xl h-32 outline-none focus:border-indigo-600 transition-all font-bold text-xs"
              placeholder="Copia aquí els objectius o anota idees clau si no tens fitxer..."
              value={pecContext}
              onChange={e => setPecContext(e.target.value)}
            />
          </div>

          {/* Indicadors */}
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">3. Indicadors de Rendiment</label>
            <textarea 
              className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-3xl h-32 outline-none focus:border-indigo-600 transition-all font-bold text-xs"
              placeholder="Ex: Resultats de competències, absentisme, ús del pati, dades de satisfacció..."
              value={indicators}
              onChange={e => setIndicators(e.target.value)}
            />
          </div>

          <div className="flex gap-4">
            <button 
              onClick={() => handleGenerate(true)}
              disabled={isGenerating}
              className="flex-1 bg-slate-100 text-slate-600 py-5 rounded-3xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all disabled:opacity-50"
            >
              Previsualitzar
            </button>
            <button 
              onClick={() => handleGenerate(false)}
              disabled={isGenerating}
              className="flex-[2] bg-indigo-600 text-white py-5 rounded-3xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 disabled:opacity-50"
            >
              Generar Proposta Completa
            </button>
          </div>
        </div>
      </div>

      {/* Columna de Resultat */}
      <div className="lg:col-span-7 bg-slate-900 rounded-[2.5rem] p-10 text-white flex flex-col relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-600/10 rounded-full blur-3xl -mr-40 -mt-40" />
        
        <div className="flex justify-between items-center mb-10 relative z-10">
          <div>
            <h3 className="text-sm font-black text-indigo-400 uppercase tracking-widest">Esborrany de Treball</h3>
            <p className="text-[10px] text-slate-500 font-bold uppercase mt-1">Adeptify Docs Engine v2.0</p>
          </div>
          {result && (
            <div className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${isPreview ? 'bg-amber-500/10 text-amber-500' : 'bg-green-500/10 text-green-500'}`}>
              {isPreview ? "Mode Previsualització" : "Document Final"}
            </div>
          )}
        </div>
        
        <div className="flex-1 relative z-10">
          {isGenerating ? (
            <div className="h-full flex flex-col items-center justify-center space-y-4">
              <div className="w-12 h-12 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 animate-pulse">La IA està analitzant els indicadors...</p>
            </div>
          ) : result ? (
            <div className="h-full flex flex-col">
              <div className="prose prose-invert prose-sm max-h-[500px] overflow-y-auto pr-6 custom-scrollbar whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-slate-300">
                {result}
                {isPreview && (
                  <div className="mt-8 p-8 bg-gradient-to-b from-indigo-900/50 to-slate-800/80 border border-indigo-500/30 rounded-3xl text-center space-y-4">
                    <div className="w-10 h-10 bg-indigo-500 text-white rounded-2xl flex items-center justify-center mx-auto shadow-lg">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                    </div>
                    <h4 className="text-lg font-black tracking-tight">Vols el document complet?</h4>
                    <p className="text-[10px] text-slate-400 font-medium leading-relaxed max-w-xs mx-auto">
                      Aquest esborrany és només una previsualització. Per descarregar les 1.500 paraules completes i la memòria d'indicadors detallada, cal actualitzar al Pla PRO.
                    </p>
                    <button className="bg-indigo-600 text-white px-8 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-900/50">
                      Actualitzar a PRO (99€/mes)
                    </button>
                  </div>
                )}
              </div>
              {!isPreview && (
                <div className="mt-8 flex gap-4 pt-8 border-t border-white/5">
                  <button className="flex-1 bg-white text-slate-900 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:scale-105 transition-all">Descarregar .DOCX</button>
                  <button className="flex-1 bg-indigo-600 text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:scale-105 transition-all">Exportar a PDF</button>
                </div>
              )}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center opacity-10">
              <svg className="w-24 h-24 mb-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
              <p className="font-black text-xs uppercase tracking-[0.5em]">Motor de Redacció Offline</p>
            </div>
          )}
        </div>
      </div>

      {/* Secció d'Estructura (Data Governance) */}
      <div className="lg:col-span-12 mt-12">
        <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-xl overflow-hidden relative">
          <div className="absolute top-0 right-0 p-10 opacity-5">
             <svg className="w-64 h-64" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" /></svg>
          </div>
          <div className="relative z-10">
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-8">Estructura Recomanada de Recollida</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
              {[
                { title: "Objectius PEC", desc: "Mapeig de competències clau per curs en format JSON o Excel.", icon: "🎯" },
                { title: "Dashboard Indicadors", desc: "Base de dades centralitzada de notes, absentisme i conducta.", icon: "📊" },
                { title: "Feedback Famílies", desc: "Enquestes anuals via Forms/Forms365 estructurades.", icon: "🏠" },
                { title: "Pla de Millora", desc: "Accions derivades del claustre amb traçabilitat de tasques.", icon: "🛠️" }
              ].map((item, idx) => (
                <div key={idx} className="space-y-3">
                  <span className="text-3xl">{item.icon}</span>
                  <h4 className="font-black text-xs text-indigo-600 uppercase tracking-widest">{item.title}</h4>
                  <p className="text-[10px] text-slate-500 font-medium leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
            <div className="mt-10 p-6 bg-slate-900 rounded-3xl text-white flex flex-col md:flex-row items-center justify-between gap-6">
              <div>
                <p className="text-[11px] font-black uppercase tracking-widest text-indigo-400">Vols que t'ajudem a muntar l'estructura?</p>
                <p className="text-[10px] text-slate-400 mt-1">Dissenyem els teus fluxos de dades per a una recollida 100% automatitzada.</p>
              </div>
              <button className="bg-white text-slate-900 px-8 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-50 transition-all">Sol·licitar Consultoria</button>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
      `}</style>
    </div>
  );
};

export default DocGenerator;
