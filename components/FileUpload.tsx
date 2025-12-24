
import React, { useState } from 'react';
import { useLanguage } from '../LanguageContext';

const FileUpload: React.FC = () => {
  const { t } = useLanguage();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [complete, setComplete] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const simulateUpload = () => {
    if (!file) return;
    setUploading(true);
    setTimeout(() => {
      setUploading(false);
      setComplete(true);
    }, 2500);
  };

  return (
    <div className="animate-in fade-in duration-700 bg-white p-8 rounded-2xl shadow-sm border-2 border-dashed border-indigo-200 text-center">
      <div className="mb-6">
        <div className="h-16 w-16 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
        </div>
        <h3 className="text-xl font-bold text-slate-800">{t.fileUploadTitle}</h3>
        <p className="text-slate-500 mt-2 text-sm">
          {t.fileUploadDesc}
        </p>
      </div>

      {!complete ? (
        <div className="space-y-4">
          <input
            type="file"
            onChange={handleFileChange}
            className="hidden"
            id="file-input"
          />
          <label
            htmlFor="file-input"
            className="block w-full py-4 px-6 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors"
          >
            {file ? (
              <span className="text-indigo-600 font-medium">{file.name}</span>
            ) : (
              <span className="text-slate-400 italic">{t.fileUploadChooseFile}</span>
            )}
          </label>
          
          {file && !uploading && (
            <button
              onClick={simulateUpload}
              className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all"
            >
              {t.fileUploadStart}
            </button>
          )}

          {uploading && (
            <div className="flex flex-col items-center">
              <div className="w-full bg-slate-100 rounded-full h-2 mb-2">
                <div className="bg-indigo-600 h-2 rounded-full animate-[progress_2.5s_ease-in-out]" />
              </div>
              <p className="text-xs text-indigo-600 font-bold animate-pulse">{t.fileUploadProcessing}</p>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-green-50 p-6 rounded-xl border border-green-100">
          <div className="h-10 w-10 bg-green-500 text-white rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-green-800 font-bold">{t.fileUploadSuccessTitle}</p>
          <p className="text-green-700 text-sm mt-1">{t.fileUploadSuccessDesc}</p>
        </div>
      )}
    </div>
  );
};

export default FileUpload;
