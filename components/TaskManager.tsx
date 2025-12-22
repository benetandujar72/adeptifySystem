
import React, { useState } from 'react';
import { Task } from '../types';
import { analyzeTasksIntelligence } from '../services/geminiService';

const TaskManager: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([
    { id: '1', title: 'Revisar informes trimestrals', assignee: 'Marta G.', deadline: '2023-11-30', status: 'pendent' },
    { id: '2', title: 'Enviar circular famílies', assignee: 'Joan P.', deadline: '2023-11-25', status: 'en_proces' },
  ]);
  const [newTask, setNewTask] = useState({ title: '', assignee: '', deadline: '' });
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showValidation, setShowValidation] = useState(false);

  const addTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.title) {
      setShowValidation(true);
      return;
    }
    
    const task: Task = {
      id: Math.random().toString(36).substr(2, 9),
      title: newTask.title,
      assignee: newTask.assignee || 'Sense assignar',
      deadline: newTask.deadline || 'Sense data',
      status: 'pendent',
    };
    
    setTasks([task, ...tasks]);
    setNewTask({ title: '', assignee: '', deadline: '' });
    setShowValidation(false);
  };

  const runAiAnalysis = async () => {
    if (tasks.length === 0 || isAnalyzing) return;
    setIsAnalyzing(true);
    try {
      const suggestion = await analyzeTasksIntelligence(tasks);
      setAiAnalysis(suggestion);
    } catch (error) {
      console.error(error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const updateStatus = (id: string, status: Task['status']) => {
    setTasks(tasks.map(t => t.id === id ? { ...t, status } : t));
  };

  const deleteTask = (id: string) => {
    setTasks(tasks.filter(t => t.id !== id));
  };

  return (
    <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden transition-all duration-300">
      {/* Capçalera amb formulari de creació ràpida */}
      <div className="p-8 border-b border-slate-50 bg-slate-50/30">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div>
            <h3 className="text-2xl font-black text-slate-800 flex items-center gap-3 tracking-tight">
              <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-100">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </div>
              Tauler de Tasques
            </h3>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1 ml-11">Adeptify Efficiency Control</p>
          </div>
          
          <button 
            onClick={runAiAnalysis}
            disabled={isAnalyzing}
            className="group relative flex items-center gap-2 text-[10px] font-black px-5 py-2.5 rounded-2xl uppercase tracking-widest bg-slate-900 text-white hover:bg-indigo-600 hover:scale-105 active:scale-95 transition-all duration-300 disabled:opacity-50 disabled:pointer-events-none shadow-xl shadow-slate-200"
          >
            {isAnalyzing ? (
              <div className="h-3 w-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <svg className="w-4 h-4 text-indigo-400 group-hover:text-white transition-colors" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
              </svg>
            )}
            {isAnalyzing ? 'Processant...' : 'Consultoria IA'}
          </button>
        </div>

        {aiAnalysis && (
          <div className="mb-8 p-6 bg-indigo-600 rounded-3xl text-white shadow-2xl shadow-indigo-200 flex gap-5 items-start animate-in zoom-in-95 duration-500 relative">
            <div className="absolute top-2 right-2">
              <button onClick={() => setAiAnalysis(null)} className="p-2 hover:bg-white/20 rounded-full transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="bg-white/20 p-3 rounded-2xl shrink-0">
               <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-200 mb-1">Assistent Adeptify Intelligence</p>
              <p className="text-sm font-bold leading-relaxed">"{aiAnalysis}"</p>
            </div>
          </div>
        )}

        <form onSubmit={addTask} className="space-y-3">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex-1 relative">
              <input
                type="text"
                placeholder="Què necessites delegar a la IA?"
                className={`w-full p-4 bg-white border-2 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-bold text-sm ${
                  showValidation && !newTask.title ? 'border-red-400 shake shadow-lg shadow-red-50' : 'border-slate-100 hover:border-slate-200 focus:border-indigo-500'
                }`}
                value={newTask.title}
                onChange={e => {
                  setNewTask({...newTask, title: e.target.value});
                  if(e.target.value) setShowValidation(false);
                }}
              />
              {showValidation && !newTask.title && (
                <p className="absolute -bottom-5 left-2 text-[10px] text-red-500 font-black uppercase tracking-tighter">Camp obligatori</p>
              )}
            </div>
            
            <div className="flex flex-wrap md:flex-nowrap gap-3 shrink-0">
              <div className="flex-1 md:w-40 relative group">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                </div>
                <input
                  type="text"
                  placeholder="Responsable"
                  className="w-full pl-10 pr-4 py-4 bg-white border-2 border-slate-100 rounded-2xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all text-xs font-bold"
                  value={newTask.assignee}
                  onChange={e => setNewTask({...newTask, assignee: e.target.value})}
                />
              </div>
              
              <div className="flex-1 md:w-44 relative group">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                </div>
                <input
                  type="date"
                  className="w-full pl-10 pr-4 py-4 bg-white border-2 border-slate-100 rounded-2xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all text-xs font-bold text-slate-500"
                  value={newTask.deadline}
                  onChange={e => setNewTask({...newTask, deadline: e.target.value})}
                />
              </div>

              <button 
                type="submit"
                className="w-full md:w-auto bg-indigo-600 text-white font-black py-4 px-8 rounded-2xl hover:bg-indigo-700 hover:scale-105 active:scale-95 transition-all shadow-xl shadow-indigo-100 flex items-center justify-center gap-3 text-xs uppercase tracking-widest"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4" />
                </svg>
                Crear
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Llista de tasques */}
      <div className="p-8">
        <div className="space-y-4 max-h-[500px] overflow-y-auto pr-4 custom-scrollbar">
          {tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-300 opacity-60 italic">
              <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-7.714 2.143L11 21l-2.286-6.857L1 12l7.714-2.143L11 3z" /></svg>
              <p className="text-sm font-bold uppercase tracking-[0.2em]">Flux de treball buit</p>
              <p className="text-[10px] mt-1">L'IA t'està esperant per començar</p>
            </div>
          ) : (
            tasks.map(task => (
              <div 
                key={task.id} 
                className={`group flex items-center justify-between p-5 rounded-2xl border-2 transition-all duration-300 animate-in slide-in-from-left-4 ${
                  task.status === 'completada' 
                    ? 'bg-slate-50/50 border-slate-100 opacity-60' 
                    : 'bg-white border-slate-50 shadow-sm hover:border-indigo-200 hover:shadow-indigo-100/30'
                }`}
              >
                <div className="flex-1 min-w-0 pr-6">
                  <div className="flex items-center gap-3 mb-1.5">
                    {task.status === 'completada' ? (
                      <div className="bg-green-100 text-green-600 p-1 rounded-full">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                      </div>
                    ) : (
                      <div className={`w-3.5 h-3.5 rounded-full border-2 ${task.status === 'en_proces' ? 'border-amber-400 bg-amber-50' : 'border-slate-300'}`} />
                    )}
                    <h4 className={`font-black text-sm md:text-md truncate tracking-tight transition-all ${task.status === 'completada' ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                      {task.title}
                    </h4>
                  </div>
                  <div className="flex flex-wrap gap-4 ml-6.5 text-[10px] text-slate-400 font-black uppercase tracking-[0.1em]">
                    <span className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100/50 rounded-lg group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                      {task.assignee}
                    </span>
                    <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-colors ${
                      new Date(task.deadline) < new Date() && task.status !== 'completada' 
                        ? 'bg-red-50 text-red-500 font-black animate-pulse' 
                        : 'bg-slate-100/50 group-hover:bg-slate-200/50'
                    }`}>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      {task.deadline}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <select
                    value={task.status}
                    onChange={(e) => updateStatus(task.id, e.target.value as Task['status'])}
                    className={`text-[10px] font-black py-2 px-4 rounded-xl border-2 cursor-pointer focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none ${
                      task.status === 'completada' ? 'bg-green-50 border-green-100 text-green-700' :
                      task.status === 'en_proces' ? 'bg-amber-50 border-amber-100 text-amber-700' : 
                      'bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300'
                    }`}
                  >
                    <option value="pendent">Pendent</option>
                    <option value="en_proces">En procés</option>
                    <option value="completada">Completada</option>
                  </select>
                  
                  <button 
                    onClick={() => deleteTask(task.id)}
                    className="p-2.5 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-4px); }
          75% { transform: translateX(4px); }
        }
        .shake {
          animation: shake 0.2s ease-in-out 0s 2;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f8fafc;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #e2e8f0;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #cbd5e1;
        }
      `}</style>
    </div>
  );
};

export default TaskManager;
