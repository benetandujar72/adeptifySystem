
import React, { useState } from 'react';
import { useLanguage } from '../LanguageContext';

const ReportCenter: React.FC = () => {
  const { t } = useLanguage();
  const [generating, setGenerating] = useState<string | null>(null);
  const [scheduled, setScheduled] = useState(true);

  const mockPreviewData = [
    { metric: t.reportMetricGlobalAverage, value: '7.8' },
    { metric: t.reportMetricTasksDelivered, value: '92%' },
    { metric: t.reportMetricAttendanceAvg, value: '94.5%' },
    { metric: t.reportMetricIssuesResolved, value: '14' },
  ];

  const generateReport = (format: 'PDF' | 'CSV') => {
    setGenerating(format);
    setTimeout(() => {
      setGenerating(null);
      alert(t.reportAlertGenerated.replace('{format}', format));
    }, 2000);
  };

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
      <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
        <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        {t.reportCenterTitle}
      </h3>
      
      {/* Secció de Previsualització */}
      <div className="mb-6 p-4 bg-slate-50 rounded-xl border border-slate-100">
        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">{t.reportPreviewTitle}</h4>
        <div className="grid grid-cols-2 gap-3">
          {mockPreviewData.map((item, idx) => (
            <div key={idx} className="bg-white p-2 rounded-lg border border-slate-100 shadow-sm">
              <span className="block text-[10px] text-slate-400 truncate">{item.metric}</span>
              <span className="block text-sm font-bold text-slate-700">{item.value}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {/* Botó PDF */}
        <button
          onClick={() => generateReport('PDF')}
          disabled={!!generating}
          className={`w-full flex items-center justify-center gap-2 py-3 px-6 rounded-xl font-bold transition-all text-sm ${
            generating === 'PDF' ? 'bg-slate-100 text-slate-400' : 'bg-slate-900 text-white hover:bg-slate-800 shadow-lg'
          }`}
        >
          {generating === 'PDF' ? (
            <>
              <div className="h-4 w-4 border-2 border-slate-300 border-t-slate-500 rounded-full animate-spin" />
              {t.reportGeneratingPdf}
            </>
          ) : (
            <>{t.reportDownloadPdf}</>
          )}
        </button>

        {/* Botó CSV */}
        <button
          onClick={() => generateReport('CSV')}
          disabled={!!generating}
          className={`w-full flex items-center justify-center gap-2 py-3 px-6 rounded-xl font-bold transition-all text-sm border-2 ${
            generating === 'CSV' 
              ? 'bg-slate-50 border-slate-100 text-slate-300' 
              : 'border-slate-200 text-slate-700 hover:border-indigo-500 hover:text-indigo-600'
          }`}
        >
          {generating === 'CSV' ? (
            <>
              <div className="h-4 w-4 border-2 border-slate-300 border-t-slate-500 rounded-full animate-spin" />
              {t.reportGeneratingCsv}
            </>
          ) : (
            <>{t.reportExportCsv}</>
          )}
        </button>

        <div className="flex items-center justify-between p-4 bg-indigo-50 rounded-xl border border-indigo-100 mt-4">
          <div>
            <span className="block text-sm font-bold text-indigo-900">{t.reportScheduleTitle}</span>
            <span className="text-[10px] text-indigo-700">{t.reportScheduleDesc}</span>
          </div>
          <label className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${scheduled ? 'bg-indigo-600' : 'bg-slate-300'}`}>
            <input
              type="checkbox"
              className="sr-only"
              checked={scheduled}
              onChange={() => setScheduled(!scheduled)}
              aria-label={t.reportScheduleToggleAria}
            />
            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${scheduled ? 'left-7' : 'left-1'}`} />
          </label>
        </div>
      </div>
    </div>
  );
};

export default ReportCenter;
