import React, { useState } from 'react';

interface MicroAppProps {
  config: {
    type: 'substitutions_planner' | 'document_wizard' | 'staff_hours_calc';
    title: string;
    description: string;
  };
}

const DynamicMicroApp: React.FC<MicroAppProps> = ({ config }) => {
  const [active, setActive] = useState(false);

  return (
    <div className="mt-12 bg-white rounded-3xl shadow-2xl border-2 border-indigo-500 overflow-hidden fade-in">
      <div className="bg-indigo-600 p-6 text-white flex justify-between items-center">
        <div>
          <h3 className="text-xl font-bold">{config.title}</h3>
          <p className="text-xs text-indigo-100 opacity-80">{config.description}</p>
        </div>
        {!active && (
          <button 
            onClick={() => setActive(true)}
            className="bg-white text-indigo-600 px-6 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-50 transition-all"
          >
            Activar Herramienta
          </button>
        )}
      </div>

      {active ? (
        <div className="p-8 bg-slate-50">
          {config.type === 'substitutions_planner' && <SubstitutionsPlanner />}
          {config.type === 'staff_hours_calc' && <StaffHoursCalc />}
          {config.type === 'document_wizard' && <DocumentWizard />}
          
          <div className="mt-8 pt-6 border-t border-slate-200 text-center">
            <p className="text-xs text-slate-400 mb-4 italic">Esta es una versión simplificada. La App completa de Adeptify incluye IA predictiva y automatización total.</p>
            <button className="text-indigo-600 font-bold text-sm hover:underline">Solicitar acceso a la suite completa →</button>
          </div>
        </div>
      ) : (
        <div className="p-12 text-center bg-slate-50 opacity-50 grayscale">
          <p className="text-sm text-slate-500">Haz clic en activar para probar esta solución diseñada para vuestro centro.</p>
        </div>
      )}
    </div>
  );
};

// --- MINI TOOLS IMPLEMENTATIONS ---

const SubstitutionsPlanner = () => {
  const [rows, setRows] = useState([{ id: 1, prof: '', reason: 'Baja', status: 'Pendiente' }]);
  return (
    <div className="space-y-4">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="text-slate-400 uppercase text-[10px] font-black">
            <th className="pb-4">Profesor/a</th>
            <th className="pb-4">Motivo</th>
            <th className="pb-4">Sustituto/a</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id} className="border-t border-slate-200">
              <td className="py-4"><input className="bg-transparent border-none focus:ring-0" placeholder="Nombre..." /></td>
              <td className="py-4">
                <select className="bg-transparent border-none text-xs">
                  <option>Enfermedad</option>
                  <option>Permiso</option>
                  <option>Formación</option>
                </select>
              </td>
              <td className="py-4"><span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-[10px] font-bold">IA BUSCANDO...</span></td>
            </tr>
          ))}
        </tbody>
      </table>
      <button onClick={() => setRows([...rows, { id: Date.now(), prof: '', reason: 'Baja', status: 'Pendiente' }])} className="text-indigo-600 text-xs font-bold">+ Añadir Incidencia</button>
    </div>
  );
};

const StaffHoursCalc = () => {
  const [h, setH] = useState(10);
  return (
    <div className="p-4 bg-white rounded-xl shadow-sm border border-slate-200">
      <p className="text-sm font-bold mb-4">Calculadora de Impacto en Claustro</p>
      <input type="range" className="w-full" value={h} onChange={(e) => setH(parseInt(e.target.value))} />
      <p className="mt-4 text-xs text-slate-500 font-medium">Si ahorramos {h}h/semana a 40 profesores, el centro gana <span className="text-indigo-600 font-bold">{h * 40 * 4} horas de calidad</span> al mes.</p>
    </div>
  );
};

const DocumentWizard = () => (
  <div className="space-y-4">
    <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100">
      <p className="text-[10px] font-black text-indigo-600 uppercase mb-2">IA Sugiere Párrafo para Memoria:</p>
      <p className="text-sm italic text-slate-700">"Durante el presente curso, el centro ha priorizado la optimización de flujos administrativos mediante el uso de inteligencia artificial, logrando una reducción del 30% en tiempos de respuesta..."</p>
    </div>
    <button className="w-full py-3 bg-indigo-600 text-white rounded-xl text-xs font-bold">Exportar a Memoria Anual</button>
  </div>
);

export default DynamicMicroApp;
