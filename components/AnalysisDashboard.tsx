
import React, { useState, useEffect } from 'react';
import { AnalysisResult, SavedJob, Message, JobStatus, ProposalTone } from '../types';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  Cell, RadarChart, PolarGrid, PolarAngleAxis, Radar, 
  Legend, CartesianGrid 
} from 'recharts';
import { suggestFollowUpMessage, regenerateProposal } from '../services/geminiService';

interface AnalysisDashboardProps {
  result: AnalysisResult;
  onReset: () => void;
  savedJob?: SavedJob;
  onUpdateJob?: (job: SavedJob) => void;
  userBio?: string;
  userSamples?: string;
}

const CustomRadarTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl border border-white/10 text-[10px] font-bold">
        <p className="uppercase tracking-widest opacity-50 mb-1">{payload[0].payload.subject}</p>
        <p className="text-lg font-black text-indigo-400">{payload[0].value}%</p>
      </div>
    );
  }
  return null;
};

const AnalysisDashboard: React.FC<AnalysisDashboardProps> = ({ result, onReset, savedJob, onUpdateJob, userBio, userSamples }) => {
  const [activeTab, setActiveTab] = useState<'report' | 'proposal' | 'conversation'>(savedJob && savedJob.messages.length > 0 ? 'conversation' : 'report');
  const [clientMsg, setClientMsg] = useState('');
  const [suggestion, setSuggestion] = useState('');
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [editableProposal, setEditableProposal] = useState(savedJob?.editedProposal || result.proposal?.cover_letter || '');

  const {
    apply_recommendation,
    opportunity_score,
    confidence,
    red_flags,
    green_flags,
    opinion,
    detailed_report,
    proposal,
    analytics,
  } = result;

  useEffect(() => {
    if (savedJob && onUpdateJob && editableProposal !== savedJob.editedProposal) {
      const timeout = setTimeout(() => {
        onUpdateJob({ ...savedJob, editedProposal: editableProposal });
      }, 1000);
      return () => clearTimeout(timeout);
    }
  }, [editableProposal]);

  const handleUpdateStatus = (newStatus: JobStatus) => {
    if (!savedJob || !onUpdateJob) return;
    onUpdateJob({ ...savedJob, status: newStatus });
  };

  const handleRegenerate = async (tone: ProposalTone) => {
    if (!savedJob || !onUpdateJob) return;
    setIsRegenerating(true);
    try {
      const newText = await regenerateProposal(savedJob, tone, userBio, userSamples);
      setEditableProposal(newText);
      onUpdateJob({ ...savedJob, editedProposal: newText });
    } catch (e) {
      console.error(e);
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleAddClientMessage = async () => {
    if (!clientMsg || !savedJob || !onUpdateJob) return;
    const newMessage: Message = { role: 'client', text: clientMsg, timestamp: Date.now() };
    const updatedJob: SavedJob = { ...savedJob, messages: [...savedJob.messages, newMessage] };
    onUpdateJob(updatedJob);
    setClientMsg('');
    
    setIsSuggesting(true);
    const aiSuggestion = await suggestFollowUpMessage(updatedJob);
    setSuggestion(aiSuggestion);
    setIsSuggesting(false);
  };

  const handleAcceptSuggestion = () => {
    if (!suggestion || !savedJob || !onUpdateJob) return;
    const newMessage: Message = { role: 'me', text: suggestion, timestamp: Date.now() };
    const updatedJob: SavedJob = { ...savedJob, messages: [...savedJob.messages, newMessage] };
    onUpdateJob(updatedJob);
    setSuggestion('');
  };

  const getRecommendationStyle = () => {
    switch (apply_recommendation) {
      case 'apply': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'maybe_apply': return 'bg-amber-100 text-amber-700 border-amber-200';
      default: return 'bg-rose-100 text-rose-700 border-rose-200';
    }
  };

  const getStatusStyle = (status: JobStatus) => {
    switch (status) {
      case 'hired': return 'bg-emerald-500 text-white';
      case 'applied': return 'bg-indigo-500 text-white';
      case 'interviewing': return 'bg-amber-500 text-white';
      case 'declined': return 'bg-rose-500 text-white';
      default: return 'bg-slate-200 text-slate-700';
    }
  };

  const radarData = [
    { subject: 'Responsiveness', A: analytics.client_metrics?.responsiveness || 50 },
    { subject: 'Generosity', A: analytics.client_metrics?.generosity || 50 },
    { subject: 'Clarity', A: analytics.client_metrics?.clarity || 50 },
    { subject: 'Stability', A: analytics.flag_counts?.red > 0 ? (100 - (analytics.flag_counts.red * 20)) : 95 },
    { subject: 'Match Fit', A: opportunity_score },
  ];

  const riskData = analytics.risk_factors || [];

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20">
      {/* Header Recommendation Card */}
      <div className={`p-10 rounded-[2.5rem] border-2 shadow-2xl shadow-slate-100 flex flex-col md:flex-row items-center justify-between gap-8 ${getRecommendationStyle()}`}>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-current opacity-40 animate-pulse"></span>
            <p className="text-xs font-black uppercase tracking-widest opacity-70">Strategic Assessment</p>
          </div>
          <h1 className="text-4xl md:text-6xl font-black capitalize tracking-tight">{apply_recommendation.replace('_', ' ')}</h1>
          <p className="text-lg opacity-90 max-w-xl font-bold leading-relaxed">{opinion}</p>
        </div>
        <div className="flex flex-col gap-4">
          <div className="flex gap-4">
            <div className="bg-white/40 backdrop-blur-xl p-6 rounded-3xl text-center min-w-[140px] border border-white/40 shadow-sm">
              <p className="text-[10px] font-black uppercase opacity-60 tracking-widest mb-1">Fit Score</p>
              <p className="text-4xl font-black">{opportunity_score}<span className="text-lg opacity-40">/100</span></p>
            </div>
            <div className="bg-white/40 backdrop-blur-xl p-6 rounded-3xl text-center min-w-[140px] border border-white/40 shadow-sm">
              <p className="text-[10px] font-black uppercase opacity-60 tracking-widest mb-1">AI Confidence</p>
              <p className="text-4xl font-black">{(confidence * 100).toFixed(0)}<span className="text-lg opacity-40">%</span></p>
            </div>
          </div>
          
          {savedJob && (
            <div className="relative group">
              <select 
                value={savedJob.status}
                onChange={(e) => handleUpdateStatus(e.target.value as JobStatus)}
                className={`w-full py-4 px-6 rounded-2xl font-black text-[10px] uppercase tracking-widest appearance-none outline-none cursor-pointer transition-all shadow-lg text-center ${getStatusStyle(savedJob.status)}`}
              >
                <option value="lead">Pipeline: Lead</option>
                <option value="applied">Pipeline: Applied</option>
                <option value="interviewing">Pipeline: Interviewing</option>
                <option value="hired">Pipeline: Hired! 🎉</option>
                <option value="declined">Pipeline: Lost/Declined</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-8 overflow-x-auto no-scrollbar px-2">
        {['report', 'proposal', 'conversation'].map((tab) => (
          (tab !== 'conversation' || savedJob) && (
            <button 
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`pb-4 px-4 text-[10px] font-black uppercase tracking-[0.2em] transition-all relative ${activeTab === tab ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
            >
              {tab === 'conversation' ? 'Coach' : tab}
              {activeTab === tab && <span className="absolute bottom-0 left-0 w-full h-1 bg-indigo-600 rounded-full animate-in fade-in slide-in-from-bottom-1 duration-300"></span>}
            </button>
          )
        ))}
      </div>

      {activeTab === 'report' && (
        <div className="space-y-8 px-2 animate-in fade-in slide-in-from-bottom-4 duration-500">
          
          {/* 1. TOP: Red Flags and Green Flags Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="text-[10px] font-black text-rose-500 uppercase tracking-widest ml-1">Red Flags & Friction</h3>
              <div className="space-y-4">
                {red_flags.map((flag, i) => (
                  <div key={i} className="p-6 bg-rose-50 border-2 border-rose-100/50 rounded-[2rem] flex gap-5 transition-transform hover:scale-[1.01]">
                    <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-2xl shadow-sm border border-rose-100 shrink-0">⚠️</div>
                    <div>
                      <h4 className="font-black text-rose-900 text-xs uppercase tracking-tight">{flag.title}</h4>
                      <p className="text-xs text-rose-700/80 mt-1 font-medium leading-relaxed">{flag.explanation}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-4">
              <h3 className="text-[10px] font-black text-emerald-500 uppercase tracking-widest ml-1">Green Flags & Leverage</h3>
              <div className="space-y-4">
                {green_flags.map((flag, i) => (
                  <div key={i} className="p-6 bg-emerald-50 border-2 border-emerald-100/50 rounded-[2rem] flex gap-5 transition-transform hover:scale-[1.01]">
                    <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-2xl shadow-sm border border-emerald-100 shrink-0">✅</div>
                    <div>
                      <h4 className="font-black text-emerald-900 text-xs uppercase tracking-tight">{flag.title}</h4>
                      <p className="text-xs text-emerald-700/80 mt-1 font-medium leading-relaxed">{flag.explanation}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 2. MIDDLE: Expertise Convergence and Risk Assessment */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <section className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Expertise Convergence</h3>
              <div className="space-y-5">
                {analytics.skill_match?.map((sm, i) => (
                  <div key={i} className="space-y-2 group">
                    <div className="flex justify-between text-[9px] font-black uppercase tracking-tight">
                      <span className="text-slate-600 group-hover:text-indigo-600 transition-colors">{sm.skill}</span>
                      <span className={sm.match_score > 70 ? 'text-emerald-500' : 'text-amber-500'}>{sm.match_score}%</span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-50 rounded-full overflow-hidden border border-slate-100">
                      <div 
                        className={`h-full transition-all duration-1000 ease-out rounded-full shadow-inner ${sm.match_score > 70 ? 'bg-gradient-to-r from-emerald-400 to-emerald-500' : 'bg-gradient-to-r from-amber-400 to-amber-500'}`} 
                        style={{ width: `${sm.match_score}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {riskData.length > 0 && (
              <section className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Internal Risk Map</h3>
                </div>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={riskData} layout="vertical" margin={{ left: 20, right: 30 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                      <XAxis type="number" hide />
                      <YAxis dataKey="factor" type="category" tick={{ fontSize: 9, fontWeight: 900, fill: '#64748b' }} width={100} />
                      <Tooltip 
                        cursor={{ fill: '#f8fafc' }}
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-2xl border border-white/10 max-w-xs">
                                <p className="text-[9px] font-black uppercase text-indigo-400 mb-2">{payload[0].payload.factor}</p>
                                <p className="text-xs font-medium text-slate-300 leading-relaxed">{payload[0].payload.notes}</p>
                                <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between">
                                   <span className="text-[8px] font-black text-slate-500 uppercase">Impact</span>
                                   <span className="text-sm font-black text-rose-400">{payload[0].value}/100</span>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar dataKey="score" radius={[0, 4, 4, 0]} barSize={20}>
                        {riskData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.score > 60 ? '#f43f5e' : entry.score > 30 ? '#fb923c' : '#6366f1'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>
            )}
          </div>

          {/* 3. LAST BEFORE SUMMARY: Client DNA profile chart */}
          <section className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 overflow-hidden relative group">
            <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-50 rounded-full -mr-24 -mt-24 opacity-50 group-hover:scale-110 transition-transform duration-700"></div>
            <div className="flex items-center justify-between mb-8 relative">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Client DNA Profile</h3>
              <div className="flex items-center gap-1.5 text-[9px] font-black uppercase text-indigo-500 bg-indigo-50 px-3 py-1.5 rounded-full border border-indigo-100">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span> Strategic Breakdown
              </div>
            </div>
            <div className="h-80 w-full relative">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                  <PolarGrid stroke="#f1f5f9" />
                  <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fontWeight: 900, fill: '#64748b' }} />
                  <Tooltip content={<CustomRadarTooltip />} />
                  <Radar 
                    name="Client" 
                    dataKey="A" 
                    stroke="#4f46e5" 
                    strokeWidth={3}
                    fill="url(#radarGradient)" 
                    fillOpacity={0.6}
                    animationBegin={200}
                    animationDuration={1500}
                  />
                  <defs>
                    <linearGradient id="radarGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0.2}/>
                    </linearGradient>
                  </defs>
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* 4. FINAL: Executive Intelligence */}
          <section className="bg-white p-12 rounded-[3rem] shadow-sm border border-slate-100 relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-2 h-full bg-slate-900 group-hover:bg-indigo-600 transition-colors duration-500"></div>
            <h3 className="text-3xl font-black mb-10 text-slate-900 tracking-tight flex items-center gap-4">
              Executive Intelligence
              <span className="text-xs font-bold text-slate-300 uppercase tracking-widest px-3 py-1 bg-slate-50 rounded-full border border-slate-100">Deep Insights</span>
            </h3>
            <div className="prose prose-slate max-w-none text-slate-600 leading-loose whitespace-pre-wrap text-base font-medium">
              {detailed_report}
            </div>
          </section>

        </div>
      )}

      {activeTab === 'proposal' && proposal && (
        <section className="bg-slate-900 p-10 rounded-[3rem] shadow-2xl text-white animate-in zoom-in-95 duration-500">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
               <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-2xl">✍️</div>
               <div>
                  <h3 className="text-xl font-black tracking-tight">Drafting Suite</h3>
                  <p className="text-xs text-white/40 font-bold uppercase tracking-widest">Tone-Adjustable Plain Text</p>
               </div>
            </div>
            
            <div className="flex items-center gap-4">
               <div className="relative group">
                  <p className="absolute -top-6 left-0 text-[8px] font-black uppercase text-white/40">Regenerate Tone</p>
                  <select 
                    disabled={isRegenerating}
                    onChange={(e) => handleRegenerate(e.target.value as ProposalTone)}
                    defaultValue="professional"
                    className="bg-white/10 hover:bg-white/20 border border-white/10 py-2 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest outline-none cursor-pointer transition-all"
                  >
                    <option value="" className="text-slate-900">Select Tone...</option>
                    <option value="like_myself" className="text-slate-900">👤 Mimic My Samples</option>
                    <option value="bold" className="text-slate-900">🚀 Bold & Punchy</option>
                    <option value="professional" className="text-slate-900">💼 Professional</option>
                    <option value="friendly" className="text-slate-900">👋 Friendly</option>
                    <option value="minimalist" className="text-slate-900">✂️ Minimalist</option>
                    <option value="detailed" className="text-slate-900">📊 Deeply Detailed</option>
                  </select>
               </div>
               <div className="px-4 py-2 bg-white/5 rounded-xl text-[10px] font-black text-indigo-300 uppercase tracking-widest border border-white/5">
                 {isRegenerating ? 'Regenerating...' : 'Auto-Saving'}
               </div>
            </div>
          </div>
          
          <div className="mb-8 bg-white/5 border border-white/10 p-6 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-1">
              <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-1">Recommended Hook</p>
              <p className="italic text-lg font-medium leading-relaxed">"{proposal.suggested_first_message}"</p>
            </div>
            <button onClick={() => { navigator.clipboard.writeText(proposal.suggested_first_message || ''); alert('Hook copied!'); }} className="px-6 py-3 bg-white/10 hover:bg-white/20 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">Copy Hook</button>
          </div>

          <textarea
            className="w-full h-[450px] bg-white text-slate-900 p-8 rounded-[2rem] mb-8 font-mono text-[13px] leading-loose outline-none focus:ring-8 focus:ring-indigo-500/20 shadow-inner scrollbar-hide"
            value={editableProposal}
            onChange={(e) => setEditableProposal(e.target.value)}
            placeholder="AI generating cover letter..."
          />

          <div className="flex flex-wrap items-center justify-between gap-6">
            <div className="flex items-center gap-8">
              <div className="flex flex-col">
                <span className="text-[10px] text-white/30 font-black uppercase tracking-widest">Recommended Rate</span>
                <span className="font-black text-xl text-indigo-400">{proposal.proposed_rate_text || 'Premium Rate'}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-white/30 font-black uppercase tracking-widest">Word Count</span>
                <span className="font-black text-xl">{editableProposal.split(/\s+/).filter(x => x).length} <span className="text-xs opacity-40">Words</span></span>
              </div>
            </div>
            <button 
              onClick={() => {
                navigator.clipboard.writeText(editableProposal);
                alert('Full Proposal Copied to Clipboard!');
              }}
              className="px-10 py-5 bg-indigo-500 hover:bg-indigo-600 rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all active:scale-95 shadow-2xl shadow-indigo-500/30 flex items-center gap-3"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2v2"></path></svg>
              Copy Full Proposal
            </button>
          </div>
        </section>
      )}

      {activeTab === 'conversation' && savedJob && (
        <section className="space-y-8 animate-in slide-in-from-right-4 duration-500">
          <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 space-y-8">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center text-2xl">💡</div>
              <div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">Closing Assistant</h3>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Turn replies into contracts</p>
              </div>
            </div>
            
            <div className="space-y-6 bg-slate-50/80 p-8 rounded-[2rem] max-h-[500px] overflow-y-auto border border-slate-100 scrollbar-hide shadow-inner">
              {savedJob.messages.length === 0 ? (
                <div className="text-center py-20">
                   <div className="text-6xl mb-4 opacity-10">💬</div>
                   <p className="text-slate-400 text-xs font-black uppercase tracking-widest">Awaiting Client Reply</p>
                   <p className="text-[10px] text-slate-300 font-bold mt-2">Paste what they said below to begin coaching</p>
                </div>
              ) : (
                savedJob.messages.map((m, i) => (
                  <div key={i} className={`flex ${m.role === 'client' ? 'justify-start' : 'justify-end'} animate-in fade-in zoom-in-95`}>
                    <div className={`max-w-[85%] p-5 rounded-[2rem] text-sm font-medium shadow-sm leading-relaxed ${m.role === 'client' ? 'bg-white text-slate-800 rounded-tl-none border border-slate-200/50' : 'bg-slate-900 text-white rounded-tr-none'}`}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${m.role === 'client' ? 'bg-indigo-50 text-indigo-500' : 'bg-white/10 text-white/50'}`}>
                          {m.role === 'client' ? 'From Client' : 'Me'}
                        </span>
                        <span className="text-[8px] opacity-30 font-bold">{new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      {m.text}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center ml-1">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Client's Latest Response</label>
                 <span className="text-[10px] text-indigo-400 font-bold">Paste exactly what they said</span>
              </div>
              <textarea 
                className="w-full p-6 rounded-[2rem] border-2 border-slate-50 focus:border-indigo-500/20 focus:bg-white outline-none text-sm min-h-[140px] bg-slate-50/50 transition-all font-medium"
                placeholder="Paste here..."
                value={clientMsg}
                onChange={e => setClientMsg(e.target.value)}
              />
              <button 
                onClick={handleAddClientMessage}
                disabled={!clientMsg || isSuggesting}
                className="w-full py-5 bg-slate-900 text-white rounded-[1.5rem] font-black text-xs uppercase tracking-[0.2em] disabled:bg-slate-200 transition-all shadow-xl shadow-slate-900/10 active:scale-[0.99] flex items-center justify-center gap-3"
              >
                {isSuggesting ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    Synthesizing Strategy...
                  </>
                ) : 'Generate Best Next Response'}
              </button>
            </div>

            {suggestion && (
              <div className="p-8 bg-indigo-500 rounded-[2.5rem] text-white space-y-6 animate-in zoom-in-95 duration-500 shadow-2xl shadow-indigo-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center">⚡</span>
                    <h4 className="font-black text-xs uppercase tracking-widest">Strategic Next Move</h4>
                  </div>
                  <button onClick={() => setSuggestion('')} className="p-2 hover:bg-white/10 rounded-full transition-all">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
                  </button>
                </div>
                <div className="bg-white/10 p-6 rounded-2xl text-[13px] font-medium leading-loose whitespace-pre-wrap border border-white/5 shadow-inner">
                  {suggestion}
                </div>
                <div className="flex gap-4">
                   <button 
                    onClick={handleAcceptSuggestion}
                    className="flex-1 py-4 bg-white text-indigo-600 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-50 transition-all shadow-lg active:scale-[0.98]"
                  >
                    Add to Thread
                  </button>
                   <button 
                    onClick={() => { navigator.clipboard.writeText(suggestion); alert('Suggestion copied!'); }}
                    className="px-8 py-4 bg-white/10 text-white border border-white/20 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-white/20 transition-all active:scale-[0.98]"
                  >
                    Copy
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      <div className="flex justify-center pt-12 animate-in fade-in duration-1000">
        <button
          onClick={onReset}
          className="px-12 py-5 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-2xl font-black text-[10px] uppercase tracking-[0.3em] transition-all hover:text-slate-900 flex items-center gap-2 group"
        >
          <svg className="w-4 h-4 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
          Back to Analysis Hub
        </button>
      </div>
    </div>
  );
};

export default AnalysisDashboard;
