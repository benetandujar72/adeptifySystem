import React, { useState, useEffect } from 'react';
import { useLanguage } from '../LanguageContext';

interface InteractiveAuditProps {
  token: string;
  onBookConsultation: () => void;
}

const InteractiveAudit: React.FC<InteractiveAuditProps> = ({ token, onBookConsultation }) => {
  const { t } = useLanguage();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // ROI Simulator State
  const [staffCount, setStaffCount] = useState(30);
  const [hourlyRate, setHourlyRate] = useState(25);
  const [hoursLostPerWeek, setHoursLostPerWeek] = useState(15);

  useEffect(() => {
    fetch(`/api/leads/audit/${token}`)
      .then(res => res.json())
      .then(json => {
        if (!json.error) {
          setData(json);
          const analysis = json.ai_needs_analysis;
          if (analysis?.estimated_hours_lost_per_week) {
            setHoursLostPerWeek(Number(analysis.estimated_hours_lost_per_week));
          }
          
          // Inteligencia de Precios Dinámicos
          const econ = analysis?.economic_profile;
          if (econ) {
            // Estimar staff basado en alumnos (aprox 1 cada 12 alumnos en centros premium, 1 cada 18 en públicos)
            const ratio = econ.economic_tier === 'high' ? 12 : 18;
            const students = parseInt(econ.estimated_student_count) || 500;
            setStaffCount(Math.round(students / ratio));

            // Ajustar coste hora según Tier
            if (econ.economic_tier === 'low') setHourlyRate(22);
            else if (econ.economic_tier === 'medium') setHourlyRate(35);
            else if (econ.economic_tier === 'high') setHourlyRate(58);
          }
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [token]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500">Analizando datos criptográficos...</div>;
  }

  if (!data) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500">Auditoría no encontrada o expirada.</div>;
  }

  const analysis = data.ai_needs_analysis;
  const econ = analysis?.economic_profile || { economic_tier: 'medium' };
  
  // Coste dinámico de Adeptify (estimado para el ROI)
  const setupFee = econ.economic_tier === 'high' ? 15000 : (econ.economic_tier === 'medium' ? 7500 : 3500);
  const monthlyFee = econ.economic_tier === 'high' ? 950 : (econ.economic_tier === 'medium' ? 450 : 190);

  // ROI Math
  const totalHoursLostMonth = staffCount * (hoursLostPerWeek * 4);
  const totalCostLostMonth = totalHoursLostMonth * hourlyRate;
  const automatedCostMonth = totalCostLostMonth * 0.15; // Reducción del 85%
  const monthlySavings = totalCostLostMonth - automatedCostMonth;
  const netMonthlyBenefit = monthlySavings - monthlyFee;
  
  // Payback Period (meses para recuperar la inversión inicial)
  const paybackMonths = Math.ceil(setupFee / netMonthlyBenefit);

  return (
    <div className="min-h-screen bg-[#FDFDFD] pb-20">
      <header className="w-full p-8 border-b border-slate-100 flex justify-between items-center glass sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center shadow-lg">
            <div className="w-3 h-3 bg-indigo-500 rounded-sm" />
          </div>
          <span className="text-xs font-black uppercase tracking-[0.3em] text-slate-900">Adeptify Zero-Touch</span>
        </div>
        <span className="px-4 py-1.5 bg-green-50 text-green-700 rounded-full text-[9px] font-black uppercase tracking-widest">
          Auditoría Confidencial
        </span>
      </header>

      <main className="max-w-5xl mx-auto px-6 mt-12 fade-in">
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-6xl font-serif text-slate-900 italic leading-tight mb-4">
            Auditoría Digital de {data.company_name}
          </h1>
          <p className="text-slate-500 max-w-2xl mx-auto">
            Nuestro motor de IA ha analizado vuestro ecosistema público. Hemos detectado fricciones operativas que están consumiendo presupuesto y energía de vuestro equipo.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Columna Izquierda: Auditoría IA */}
          <div className="space-y-8">
            <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-2 h-full bg-red-500"></div>
              <h3 className="text-xs font-black text-red-500 uppercase tracking-widest mb-2">Cuello de Botella Principal</h3>
              <p className="text-xl font-medium text-slate-800">{analysis.main_bottleneck}</p>
            </div>

            <div className="bg-slate-900 p-8 rounded-3xl text-white shadow-2xl">
              <h3 className="text-xs font-black text-indigo-400 uppercase tracking-widest mb-6">Oportunidades de Mejora</h3>
              <ul className="space-y-4">
                {analysis.detected_needs.map((need: string, i: number) => (
                  <li key={i} className="flex gap-4 items-start">
                    <span className="text-indigo-500 mt-1">✦</span>
                    <span className="text-slate-300 text-sm leading-relaxed">{need}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-8 pt-8 border-t border-slate-800">
                <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4">La Solución Adeptify</h3>
                <p className="text-indigo-200 italic">"{analysis.recommended_solution}"</p>
              </div>
            </div>
          </div>

          {/* Columna Derecha: Simulador ROI */}
          <div className="bg-white p-8 rounded-3xl shadow-xl border border-indigo-50">
            <h3 className="text-2xl font-bold text-slate-900 mb-2">Simulador de Fugas de Capital</h3>
            <p className="text-sm text-slate-500 mb-8">Ajusta los valores para ver cuánto estáis perdiendo por no automatizar procesos.</p>
            
            <div className="space-y-6 mb-8">
              <div>
                <div className="flex justify-between mb-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Personal / Docentes</label>
                  <span className="font-bold text-indigo-600">{staffCount} personas</span>
                </div>
                <input type="range" min="5" max="200" value={staffCount} onChange={(e) => setStaffCount(Number(e.target.value))} className="w-full accent-indigo-600" />
              </div>

              <div>
                <div className="flex justify-between mb-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Horas perdidas / semana (por persona)</label>
                  <span className="font-bold text-indigo-600">{hoursLostPerWeek}h / sem</span>
                </div>
                <input type="range" min="1" max="25" value={hoursLostPerWeek} onChange={(e) => setHoursLostPerWeek(Number(e.target.value))} className="w-full accent-indigo-600" />
              </div>

              <div>
                <div className="flex justify-between mb-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Costo hora promedio (€)</label>
                  <span className="font-bold text-indigo-600">{hourlyRate} €/h</span>
                </div>
                <input type="range" min="10" max="60" value={hourlyRate} onChange={(e) => setHourlyRate(Number(e.target.value))} className="w-full accent-indigo-600" />
              </div>
            </div>

            <div className="bg-red-50 p-6 rounded-2xl mb-4 border border-red-100">
              <p className="text-xs font-black text-red-500 uppercase tracking-widest mb-1">Pérdida Mensual Actual Estimada</p>
              <p className="text-4xl font-black text-red-700">{totalCostLostMonth.toLocaleString('es-ES')} €</p>
            </div>

            <div className="bg-green-50 p-6 rounded-2xl mb-8 border border-green-100">
              <p className="text-xs font-black text-green-600 uppercase tracking-widest mb-1">Ahorro Mensual con Adeptify (85%)</p>
              <p className="text-4xl font-black text-green-700">+{monthlySavings.toLocaleString('es-ES')} €</p>
            </div>

            <button 
              onClick={onBookConsultation}
              className="w-full py-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black uppercase tracking-widest transition-all shadow-lg shadow-indigo-200 flex justify-center items-center gap-3"
            >
              Frenar Pérdidas y Automatizar
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default InteractiveAudit;
