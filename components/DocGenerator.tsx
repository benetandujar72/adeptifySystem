
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
              <svg className="w-8 h-8 mx-auto mb-2 text-slate-300 group-hover:text-indigo-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
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
                    <div className="w-12 h-12 bg-indigo-500 text-white rounded-2xl flex items-center justify-center mx-auto shadow-lg">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
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
              <svg className="w-24 h-24 mb-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <p className="font-black text-xs uppercase tracking-[0.5em]">Motor de Redacció Offline</p>
            </div>
          )}
        </div>
      </div>

      {/* Secció d'Estructura (Professional Icons) */}
      <div className="lg:col-span-12 mt-12">
        <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-xl overflow-hidden relative">
          <div className="absolute top-0 right-0 p-10 opacity-5">
             <svg className="w-64 h-64" fill="currentColor" viewBox="0 0 24 24">
               <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
             </svg>
          </div>
          <div className="relative z-10">
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-8 italic">Estructura de Recollida Professional</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
              {[
                { 
                  title: "Objectius PEC", 
                  desc: "Mapeig de competències clau per curs en format dades estructurades.", 
                  icon: (
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10" strokeWidth="1.5"/><circle cx="12" cy="12" r="6" strokeWidth="1.5"/><circle cx="12" cy="12" r="2" strokeWidth="1.5"/>
                    </svg>
                  )
                },
                { 
                  title: "Dashboard Indicadors", 
                  desc: "Base de dades centralitzada de notes, absentisme i conducta.", 
                  icon: (
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
                    </svg>
                  )
                },
                { 
                  title: "Feedback Famílies", 
                  desc: "Enquestes anuals via Forms estructurades per a mineria de dades.", 
                  icon: (
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                    </svg>
                  )
                },
                { 
                  title: "Pla de Millora", 
                  desc: "Accions derivades del claustre amb traçabilitat completa de tasques.", 
                  icon: (
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  )
                }
              ].map((item, idx) => (
                <div key={idx} className="space-y-4 group">
                  <div className="w-14 h-14 bg-slate-50 text-indigo-600 rounded-2xl flex items-center justify-center transition-all group-hover:bg-indigo-600 group-hover:text-white group-hover:scale-110 shadow-sm border border-slate-100">
                    {item.icon}
                  </div>
                  <div>
                    <h4 className="font-black text-xs text-slate-800 uppercase tracking-widest mb-1">{item.title}</h4>
                    <p className="text-[10px] text-slate-500 font-medium leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-12 p-8 bg-slate-900 rounded-[2.5rem] text-white flex flex-col md:flex-row items-center justify-between gap-8 group">
              <div className="space-y-2 text-center md:text-left">
                <p className="text-sm font-black uppercase tracking-[0.2em] text-indigo-400">Vols optimitzar la recollida de dades?</p>
                <p className="text-[11px] text-slate-400 font-medium italic">Dissenyem els teus fluxos de treball per a una automatització del 100%.</p>
              </div>
              <button className="bg-white text-slate-900 px-10 py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.4em] hover:bg-indigo-50 hover:scale-105 active:scale-95 transition-all shadow-2xl">
                Sol·licitar Consultoria
              </button>
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
