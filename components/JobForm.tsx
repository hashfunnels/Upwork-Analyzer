
import React, { useState } from 'react';
import { JobInput } from '../types';

interface JobFormProps {
  onAnalyze: (rawText: string) => void;
  isLoading: boolean;
}

const JobForm: React.FC<JobFormProps> = ({ onAnalyze, isLoading }) => {
  const [rawText, setRawText] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAnalyze(rawText);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100 max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3">
            <span className="p-3 bg-indigo-600 rounded-2xl text-white shadow-lg shadow-indigo-100">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path></svg>
            </span>
            Analyze Job Page
          </h2>
          <div className="flex flex-col items-end">
             <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Step 01</span>
             <span className="text-xs font-bold text-indigo-500">Capture everything</span>
          </div>
        </div>
        
        <div className="space-y-3">
          <p className="text-sm font-bold text-slate-500 ml-1 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
            Ctrl+A → Ctrl+C from Upwork Job Page, then Paste here
          </p>
          <textarea
            required
            rows={12}
            className="w-full px-5 py-5 rounded-2xl border-2 border-slate-50 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 transition-all outline-none bg-slate-50 font-mono text-xs leading-relaxed"
            placeholder="[Title] [Client Feedback] [Budget] [Job Description]..."
            value={rawText}
            onChange={e => setRawText(e.target.value)}
          />
        </div>
      </div>

      <div className="max-w-4xl mx-auto">
        <button
          disabled={isLoading || !rawText}
          type="submit"
          className={`w-full py-6 rounded-3xl font-black text-xl text-white shadow-2xl transition-all active:scale-[0.98] flex items-center justify-center gap-4 ${
            isLoading || !rawText ? 'bg-slate-300 cursor-not-allowed shadow-none' : 'bg-slate-900 hover:bg-slate-800 shadow-slate-200'
          }`}
        >
          {isLoading ? (
            <>
              <svg className="animate-spin h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
              Strategizing...
            </>
          ) : (
            <>
              <span>🚀</span> Run Full Assessment
            </>
          )}
        </button>
      </div>
    </form>
  );
};

export default JobForm;
