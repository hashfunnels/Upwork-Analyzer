
import React, { useState, useEffect } from 'react';
import JobForm from './components/JobForm';
import AnalysisDashboard from './components/AnalysisDashboard';
import { JobInput, AnalysisResult, SavedJob, UserAccount, ProposalTone, JobStatus, UserProfile, UserIdentity } from './types';
import { analyzeJobPosting, extractProfileDetails } from './services/geminiService';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [isSignUp, setIsSignUp] = useState(false);
  const [loginForm, setLoginForm] = useState({ user: '', pass: '' });
  const [authError, setAuthError] = useState<string | null>(null);

  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [currentJob, setCurrentJob] = useState<SavedJob | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);

  const [selectedJobIds, setSelectedJobIds] = useState<Set<string>>(new Set());
  const [isManagingArchive, setIsManagingArchive] = useState(false);
  const [isBioEditing, setIsBioEditing] = useState(false);
  const [isProposalsEditing, setIsProposalsEditing] = useState(false);
  const [historySearchTerm, setHistorySearchTerm] = useState('');

  const defaultIdentity: UserIdentity = {
    profiles: [{ id: 'main', label: 'General Profile', your_profile_skills: [] }],
    activeProfileId: 'main',
    portfolio_links: [],
    preferred_tone: 'professional'
  };

  useEffect(() => {
    const loggedInUser = localStorage.getItem('upwork_assessor_session');
    if (loggedInUser) {
      const users = JSON.parse(localStorage.getItem('upwork_assessor_users') || '{}');
      if (users[loggedInUser]) {
        setCurrentUser({ ...users[loggedInUser], username: loggedInUser });
      }
    }
  }, []);

  useEffect(() => {
    if (currentUser) {
      const users = JSON.parse(localStorage.getItem('upwork_assessor_users') || '{}');
      users[currentUser.username] = { ...currentUser };
      localStorage.setItem('upwork_assessor_users', JSON.stringify(users));
    }
  }, [currentUser]);

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    const users = JSON.parse(localStorage.getItem('upwork_assessor_users') || '{}');

    if (isSignUp) {
      if (users[loginForm.user]) {
        setAuthError("Username already exists.");
        return;
      }
      const newUser: UserAccount = {
        username: loginForm.user,
        password: loginForm.pass,
        identity: { ...defaultIdentity },
        history: []
      };
      users[loginForm.user] = newUser;
      localStorage.setItem('upwork_assessor_users', JSON.stringify(users));
      setCurrentUser(newUser);
      localStorage.setItem('upwork_assessor_session', loginForm.user);
    } else {
      const user = users[loginForm.user];
      if (user && user.password === loginForm.pass) {
        setCurrentUser({ ...user, username: loginForm.user });
        localStorage.setItem('upwork_assessor_session', loginForm.user);
      } else {
        setAuthError("Invalid username or password.");
      }
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('upwork_assessor_session');
    setResult(null);
    setCurrentJob(null);
  };

  const updateIdentity = (updates: Partial<UserIdentity>) => {
    if (!currentUser) return;
    setCurrentUser(prev => prev ? ({
      ...prev,
      identity: { ...prev.identity, ...updates }
    }) : null);
  };

  const activeProfile = currentUser?.identity.profiles.find(p => p.id === currentUser.identity.activeProfileId) || currentUser?.identity.profiles[0];

  const updateActiveProfile = (updates: Partial<UserProfile>) => {
    if (!currentUser || !activeProfile) return;
    const newProfiles = currentUser.identity.profiles.map(p => 
      p.id === currentUser.identity.activeProfileId ? { ...p, ...updates } : p
    );
    updateIdentity({ profiles: newProfiles });
  };

  const handleAddProfile = () => {
    if (!currentUser) return;
    const id = Math.random().toString(36).substr(2, 9);
    const newProfile: UserProfile = {
      id,
      label: 'Specialized Profile',
      your_profile_skills: []
    };
    updateIdentity({ 
      profiles: [...currentUser.identity.profiles, newProfile],
      activeProfileId: id 
    });
    setIsBioEditing(true);
  };

  const handleRemoveProfile = (id: string) => {
    if (!currentUser) return;
    if (currentUser.identity.profiles.length <= 1) {
      alert("You must have at least one profile.");
      return;
    }
    if (!confirm('Permanently delete this specialized profile context?')) return;
    
    const newProfiles = currentUser.identity.profiles.filter(p => p.id !== id);
    let nextActiveId = currentUser.identity.activeProfileId;
    
    // If the active profile is being deleted, switch to the first remaining one
    if (id === currentUser.identity.activeProfileId) {
      nextActiveId = newProfiles[0].id;
    }
    
    updateIdentity({ 
      profiles: newProfiles,
      activeProfileId: nextActiveId
    });
  };

  const handleExtractFromProfile = async () => {
    if (!activeProfile?.upwork_profile_text) return;
    setIsExtracting(true);
    try {
      const { skills, rate, name, headline } = await extractProfileDetails(activeProfile.upwork_profile_text);
      updateActiveProfile({
        your_profile_skills: Array.from(new Set([...(activeProfile.your_profile_skills || []), ...skills])),
        your_rate_preferences: rate || activeProfile.your_rate_preferences,
        profile_name: name,
        profile_headline: headline
      });
      setIsBioEditing(false);
    } catch (e) {
      console.error("Extraction failed", e);
    } finally {
      setIsExtracting(false);
    }
  };

  const handleAnalyze = async (rawText: string) => {
    if (!currentUser || !activeProfile) return;
    setLoading(true);
    setError(null);
    try {
      const fullInput: JobInput = {
        active_profile: activeProfile,
        previous_proposals: currentUser.identity.previous_proposals,
        portfolio_links: currentUser.identity.portfolio_links,
        preferred_tone: currentUser.identity.preferred_tone,
        raw_text: rawText,
      };
      const analysisResult = await analyzeJobPosting(fullInput);
      
      const newSavedJob: SavedJob = {
        id: Math.random().toString(36).substr(2, 9),
        timestamp: Date.now(),
        jobTitle: analysisResult.job_title,
        clientName: 'Client', 
        rawText,
        analysis: analysisResult,
        messages: [],
        status: 'lead',
        editedProposal: analysisResult.proposal?.cover_letter
      };

      setCurrentUser(prev => prev ? ({ ...prev, history: [newSavedJob, ...prev.history] }) : null);
      setCurrentJob(newSavedJob);
      setResult(analysisResult);
    } catch (err) {
      console.error(err);
      setError('Analysis failed. Try checking your API key or job text.');
    } finally {
      setLoading(false);
    }
  };

  const updateJobInHistory = (job: SavedJob) => {
    if (!currentUser) return;
    setCurrentUser(prev => prev ? ({
      ...prev,
      history: prev.history.map(j => j.id === job.id ? job : j)
    }) : null);
    setCurrentJob(job);
    setResult(job.analysis);
  };

  const toggleJobSelection = (id: string) => {
    const next = new Set(selectedJobIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedJobIds(next);
  };

  const deleteSelectedJobs = () => {
    if (!currentUser || selectedJobIds.size === 0) return;
    if (!confirm(`Delete ${selectedJobIds.size} selected leads?`)) return;

    const newHistory = currentUser.history.filter(job => !selectedJobIds.has(job.id));
    setCurrentUser(prev => prev ? ({ ...prev, history: newHistory }) : null);
    
    if (currentJob && selectedJobIds.has(currentJob.id)) {
      setCurrentJob(null);
      setResult(null);
    }
    
    setSelectedJobIds(new Set());
    setIsManagingArchive(false);
  };

  const toggleSelectAll = () => {
    if (!currentUser) return;
    const filtered = currentUser.history.filter(job => 
      job.jobTitle.toLowerCase().includes(historySearchTerm.toLowerCase()) ||
      job.clientName.toLowerCase().includes(historySearchTerm.toLowerCase())
    );

    if (selectedJobIds.size === filtered.length) {
      setSelectedJobIds(new Set());
    } else {
      setSelectedJobIds(new Set(filtered.map(j => j.id)));
    }
  };

  const getStatusDotColor = (status: JobStatus) => {
    switch (status) {
      case 'hired': return 'bg-emerald-500';
      case 'applied': return 'bg-indigo-500';
      case 'interviewing': return 'bg-amber-500';
      case 'declined': return 'bg-rose-500';
      default: return 'bg-slate-300';
    }
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#0a0f1d] flex items-center justify-center p-4">
        <div className="w-full max-w-[900px] bg-white rounded-[5rem] shadow-[0_40px_100px_rgba(0,0,0,0.6)] flex flex-col items-center py-16 md:py-24 px-8 relative animate-in fade-in zoom-in-95 duration-700">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2">
             <div className="w-24 h-24 bg-[#0a0f1d] rounded-full flex items-center justify-center text-white text-3xl font-black shadow-2xl">UA</div>
          </div>

          <div className="text-center space-y-2 mb-12 mt-4">
            <h1 className="text-4xl md:text-5xl font-black text-[#0a0f1d] tracking-tight">{isSignUp ? 'Join Us' : 'Welcome Back'}</h1>
            <p className="text-[12px] md:text-[14px] text-slate-300 font-bold uppercase tracking-[0.4em]">{isSignUp ? 'RECRUITING THE BEST' : 'LOCKED & LOADED'}</p>
          </div>

          <form onSubmit={handleAuth} className="w-full max-w-lg space-y-10">
            <div className="space-y-6">
              <div className="space-y-3">
                <label className="text-[10px] md:text-[11px] font-black text-slate-400 uppercase tracking-widest ml-4">Username</label>
                <input 
                  required
                  className="w-full px-8 py-6 rounded-[2rem] bg-slate-50 border-none outline-none focus:ring-4 focus:ring-indigo-500/10 font-bold text-base transition-all placeholder-slate-300 text-[#0a0f1d]"
                  value={loginForm.user}
                  onChange={e => setLoginForm(p => ({ ...p, user: e.target.value }))}
                  placeholder="freelancer_pro"
                />
              </div>
              <div className="space-y-3">
                <label className="text-[10px] md:text-[11px] font-black text-slate-400 uppercase tracking-widest ml-4">Password</label>
                <input 
                  required
                  type="password"
                  className="w-full px-8 py-6 rounded-[2rem] bg-slate-50 border-none outline-none focus:ring-4 focus:ring-indigo-500/10 font-bold text-base transition-all placeholder-slate-300 text-[#0a0f1d]"
                  value={loginForm.pass}
                  onChange={e => setLoginForm(p => ({ ...p, pass: e.target.value }))}
                  placeholder="••••••••"
                />
              </div>
            </div>

            {authError && <p className="text-rose-500 text-[12px] font-black text-center animate-shake bg-rose-50 py-4 rounded-3xl">{authError}</p>}

            <div className="space-y-8">
              <button type="submit" className="w-full py-7 bg-[#0a0f1d] text-white rounded-[2rem] font-black text-[13px] md:text-[15px] uppercase tracking-[0.3em] hover:bg-slate-800 transition-all shadow-2xl active:scale-95">
                {isSignUp ? 'Create Account' : 'Sign In Now'}
              </button>
              <button 
                type="button"
                onClick={() => { setIsSignUp(!isSignUp); setAuthError(null); }}
                className="w-full text-[10px] md:text-[11px] font-black text-slate-300 uppercase tracking-widest hover:text-indigo-600 transition-colors"
              >
                {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  const identity = currentUser.identity;

  // Filter logic for Archive
  const filteredHistory = currentUser.history.filter(job => 
    job.jobTitle.toLowerCase().includes(historySearchTerm.toLowerCase()) ||
    job.clientName.toLowerCase().includes(historySearchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col lg:flex-row">
      {/* LEFT: IDENTITY */}
      <aside className="w-full lg:w-[320px] bg-white border-r border-slate-100 flex flex-col h-screen lg:sticky lg:top-0 z-40 overflow-y-auto scrollbar-hide">
        <div className="p-6 space-y-6 pb-20">
          <div className="flex items-center justify-between border-b border-slate-50 pb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center text-white text-lg font-black shadow-lg shadow-indigo-100 italic">ID</div>
              <div>
                <h1 className="text-xs font-black text-slate-900 uppercase">Profiles</h1>
                <p className="text-[9px] text-slate-400 font-black uppercase truncate max-w-[120px]">@{currentUser.username}</p>
              </div>
            </div>
            <button onClick={handleLogout} className="p-2 text-slate-300 hover:text-rose-500 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
            </button>
          </div>

          <section className="space-y-6">
            {/* PROFILE SWITCHER */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Select Profile</label>
                <button onClick={handleAddProfile} className="text-[9px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg hover:bg-indigo-100 border border-indigo-100">+ Add</button>
              </div>
              <div className="flex flex-col gap-2">
                {identity.profiles.map(p => (
                  <div key={p.id} className="relative group/prof">
                    <div
                      onClick={() => updateIdentity({ activeProfileId: p.id })}
                      className={`cursor-pointer w-full text-left p-3 rounded-2xl border transition-all flex items-center justify-between ${identity.activeProfileId === p.id ? 'bg-slate-900 text-white border-slate-900 shadow-lg' : 'bg-slate-50 border-slate-100 text-slate-500 hover:border-indigo-200'}`}
                    >
                      <span className="text-[10px] font-black uppercase tracking-tight truncate max-w-[150px]">{p.label}</span>
                      {identity.activeProfileId === p.id && <div className="w-1.5 h-1.5 rounded-full bg-indigo-400"></div>}
                    </div>
                    {identity.profiles.length > 1 && (
                       <button 
                        type="button"
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          handleRemoveProfile(p.id); 
                        }}
                        className="absolute -right-1 -top-1 w-5 h-5 bg-white border border-slate-100 rounded-full text-slate-300 hover:text-rose-500 opacity-0 group-hover/prof:opacity-100 transition-all flex items-center justify-center shadow-sm z-10"
                       >
                         <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
                       </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

             {/* BIO SECTION */}
             <div className="space-y-3 pt-2 border-t border-slate-50">
              <div className="flex items-center justify-between">
                <input 
                  className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-transparent outline-none focus:text-indigo-600 transition-all w-[120px]"
                  value={activeProfile?.label || ''}
                  onChange={e => updateActiveProfile({ label: e.target.value })}
                />
                <div className="flex gap-2">
                  {!isBioEditing && activeProfile?.upwork_profile_text && (
                    <button onClick={() => setIsBioEditing(true)} className="flex items-center gap-1 text-[9px] font-black text-indigo-500 hover:text-indigo-700 transition-colors">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                      Edit
                    </button>
                  )}
                  {(isBioEditing || !activeProfile?.upwork_profile_text) && (
                    <button onClick={handleExtractFromProfile} disabled={isExtracting || !activeProfile?.upwork_profile_text} className="text-[9px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg hover:bg-emerald-100 transition-all border border-emerald-100">
                      {isExtracting ? '⏳ Syncing' : '✨ Extract Data'}
                    </button>
                  )}
                </div>
              </div>
              
              {!isBioEditing && activeProfile?.profile_name ? (
                <div className="p-5 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-2xl border border-indigo-400 shadow-xl shadow-indigo-100 animate-in fade-in duration-300">
                   <h3 className="text-sm font-black text-white leading-tight mb-1">{activeProfile.profile_name}</h3>
                   <p className="text-[10px] font-bold text-indigo-100 leading-snug">{activeProfile.profile_headline}</p>
                </div>
              ) : (
                <textarea
                  rows={4}
                  className="w-full p-4 rounded-2xl border border-slate-100 text-[11px] bg-slate-50/50 font-medium leading-relaxed outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                  placeholder="Paste specialized Upwork bio..."
                  value={activeProfile?.upwork_profile_text || ''}
                  onChange={e => updateActiveProfile({ upwork_profile_text: e.target.value })}
                />
              )}
            </div>

            {/* SKILLS SECTION (Associated to Active Profile) */}
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Specialized Skills</label>
              <div className="flex flex-wrap gap-1.5">
                {activeProfile?.your_profile_skills?.map(skill => (
                  <span key={skill} className="px-2.5 py-1 bg-white text-slate-900 rounded-lg text-[9px] font-black flex items-center gap-2 border border-slate-100 shadow-sm transition-all hover:border-indigo-200">
                    {skill}
                    <button onClick={() => updateActiveProfile({ your_profile_skills: activeProfile.your_profile_skills?.filter(s => s !== skill) })} className="hover:text-rose-500">✕</button>
                  </span>
                ))}
                <input 
                  className="text-[9px] font-black outline-none bg-transparent placeholder-slate-300 w-20 px-1 border-b border-transparent focus:border-indigo-300 transition-all"
                  placeholder="+ Add Skill"
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      const val = (e.target as HTMLInputElement).value.trim();
                      if (val) {
                        updateActiveProfile({ your_profile_skills: Array.from(new Set([...(activeProfile.your_profile_skills || []), val])) });
                        (e.target as HTMLInputElement).value = '';
                      }
                    }
                  }}
                />
              </div>
            </div>

            {/* TONE SELECTION (Global) */}
            <div className="space-y-3 pt-4 border-t border-slate-50">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Global Proposal Tone</label>
              <div className="grid grid-cols-2 gap-2">
                {(['like_myself', 'bold', 'professional', 'friendly', 'minimalist', 'detailed'] as ProposalTone[]).map(tone => (
                  <button
                    key={tone}
                    onClick={() => updateIdentity({ preferred_tone: tone })}
                    className={`py-2 rounded-xl text-[9px] font-black uppercase tracking-tight border transition-all ${identity.preferred_tone === tone ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-slate-50 border-slate-100 text-slate-400 hover:border-indigo-200'}`}
                  >
                    {tone === 'like_myself' ? '👤 LIKE MYSELF' : tone}
                  </button>
                ))}
              </div>
            </div>

            {/* SAMPLE PROPOSALS SECTION (Global) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Voice Samples</label>
                {identity.previous_proposals && !isProposalsEditing ? (
                  <button 
                    onClick={() => setIsProposalsEditing(true)} 
                    className="flex items-center gap-1 text-[9px] font-black text-indigo-500 hover:text-indigo-700 transition-colors"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                    Edit
                  </button>
                ) : null}
              </div>
              
              {identity.previous_proposals && !isProposalsEditing ? (
                <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center gap-3 animate-in slide-in-from-left-2 duration-300">
                   <div className="w-8 h-8 bg-white rounded-xl flex items-center justify-center text-xl shadow-sm border border-emerald-50">📑</div>
                   <div>
                     <p className="text-[9px] font-black text-emerald-900 uppercase">Synced</p>
                     <p className="text-[8px] font-bold text-emerald-600/70">Training set active</p>
                   </div>
                </div>
              ) : (
                <textarea
                  rows={5}
                  className="w-full p-4 rounded-2xl border border-slate-100 text-[11px] bg-slate-50/50 font-medium leading-relaxed outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                  placeholder="Paste your past winning proposals..."
                  value={identity.previous_proposals || ''}
                  onChange={e => updateIdentity({ previous_proposals: e.target.value })}
                  onBlur={() => { if (identity.previous_proposals) setIsProposalsEditing(false); }}
                />
              )}
            </div>

            {/* PORTFOLIO SECTION (Global) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Global Resources</label>
                <button 
                  onClick={() => updateIdentity({ portfolio_links: [...(identity.portfolio_links || []), { name: '', url: '' }] })} 
                  className="text-[9px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg hover:bg-indigo-100 border border-indigo-100"
                >
                  Add
                </button>
              </div>
              <div className="space-y-3">
                {identity.portfolio_links?.map((link, idx) => (
                  <div key={idx} className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm transition-all hover:border-indigo-200 group relative animate-in slide-in-from-right-2 duration-200">
                    <div className="flex items-center gap-3 mb-2">
                       <input 
                        className="bg-transparent w-full text-[10px] font-black outline-none placeholder-slate-300" 
                        placeholder="Link Name" 
                        value={link.name} 
                        onChange={e => {
                          const next = [...(identity.portfolio_links || [])];
                          next[idx].name = e.target.value;
                          updateIdentity({ portfolio_links: next });
                        }} 
                       />
                       <button onClick={() => updateIdentity({ portfolio_links: identity.portfolio_links.filter((_, i) => i !== idx) })} className="text-slate-300 hover:text-rose-500">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
                       </button>
                    </div>
                    <input 
                      className="bg-slate-50 w-full px-3 py-1.5 rounded-lg text-[9px] font-bold text-indigo-600 outline-none border border-transparent focus:border-indigo-100 focus:bg-white transition-all" 
                      placeholder="https://..." 
                      value={link.url} 
                      onChange={e => {
                        const next = [...(identity.portfolio_links || [])];
                        next[idx].url = e.target.value;
                        updateIdentity({ portfolio_links: next });
                      }} 
                    />
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      </aside>

      {/* CENTER: DASHBOARD */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white/80 backdrop-blur-md border-b border-slate-100 py-3 px-8 sticky top-0 z-30">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
             <div className="flex items-center gap-4">
               <div className="w-8 h-8 bg-slate-900 rounded-xl flex items-center justify-center text-white text-lg font-black shadow-lg shadow-slate-900/10">UA</div>
               <h1 className="text-xs font-black text-slate-900 uppercase tracking-widest">Strategy Portal 2.5</h1>
             </div>
             <div className="hidden sm:flex items-center gap-4 text-[9px] font-black text-slate-300 uppercase tracking-[0.2em]">
                <span className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> {activeProfile?.label}</span>
                <span className="flex items-center gap-2 text-indigo-600"><span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span> {currentUser.username}</span>
             </div>
          </div>
        </header>

        <main className="flex-1 container mx-auto px-6 py-10 max-w-5xl">
          {error && (
            <div className="mb-8 p-5 bg-rose-50 border-2 border-rose-100 text-rose-600 rounded-3xl flex items-center gap-4 font-black text-xs uppercase tracking-widest animate-bounce">
              <span className="text-2xl">⚠️</span> {error}
            </div>
          )}

          {!result ? (
            <div className="space-y-12 py-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
              <div className="text-center space-y-4">
                <h2 className="text-6xl font-black text-slate-900 tracking-tight leading-none">Find Your Next <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-emerald-500 underline decoration-indigo-200 decoration-8 underline-offset-8 italic">Big Win.</span></h2>
                <p className="text-lg text-slate-400 font-bold max-w-xl mx-auto">Evaluating with your <span className="text-slate-900 font-black">"{activeProfile?.label}"</span> profile context.</p>
              </div>
              <JobForm onAnalyze={handleAnalyze} isLoading={loading} />
            </div>
          ) : (
            <AnalysisDashboard 
              result={result} 
              onReset={() => { setResult(null); setCurrentJob(null); }} 
              savedJob={currentJob || undefined}
              onUpdateJob={updateJobInHistory}
              userBio={activeProfile?.upwork_profile_text}
              userSamples={identity.previous_proposals}
            />
          )}
        </main>
      </div>

      {/* RIGHT: HISTORY */}
      <aside className="w-full lg:w-[320px] bg-white border-l border-slate-100 flex flex-col h-screen lg:sticky lg:top-0 z-40 overflow-hidden">
        <div className="p-6 lg:p-8 space-y-6 h-full flex flex-col">
          <div className="flex items-center justify-between border-b border-slate-50 pb-6 shrink-0">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-emerald-500 rounded-2xl flex items-center justify-center text-white text-xl font-black shadow-lg shadow-emerald-100 italic">H</div>
              <div>
                <h1 className="text-xs font-black text-slate-900 uppercase">Archive</h1>
                <p className="text-[9px] text-emerald-600 font-black uppercase tracking-widest">Leads</p>
              </div>
            </div>
            {currentUser.history.length > 0 && (
              <button 
                onClick={() => {
                  setIsManagingArchive(!isManagingArchive);
                  setSelectedJobIds(new Set());
                }} 
                className={`p-2 rounded-xl transition-all ${isManagingArchive ? 'bg-slate-900 text-white' : 'text-slate-300 hover:text-slate-900 bg-slate-50'}`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
              </button>
            )}
          </div>

          <div className="relative shrink-0 group">
             <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                <svg className="w-3.5 h-3.5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
             </div>
             <input 
              className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3.5 pl-10 pr-4 text-[11px] font-bold text-slate-900 placeholder-slate-400 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-100 transition-all"
              placeholder="Search history..."
              value={historySearchTerm}
              onChange={e => setHistorySearchTerm(e.target.value)}
             />
          </div>

          <div className="flex-1 overflow-y-auto pr-2 -mr-2 space-y-3 scrollbar-hide pb-10">
            {isManagingArchive && currentUser.history.length > 0 && (
              <div className="flex items-center justify-between mb-4 sticky top-0 bg-white/95 backdrop-blur-md z-10 py-3 border-b border-slate-50 animate-in slide-in-from-top-2 duration-300">
                <button 
                  onClick={toggleSelectAll} 
                  className="text-[10px] font-black text-indigo-600 uppercase tracking-widest flex items-center gap-2"
                >
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${selectedJobIds.size > 0 && selectedJobIds.size === filteredHistory.length ? 'bg-indigo-600 border-indigo-600' : 'border-slate-200 bg-white'}`}>
                    {selectedJobIds.size > 0 && selectedJobIds.size === filteredHistory.length && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>}
                  </div>
                  {selectedJobIds.size === filteredHistory.length ? 'Deselect All' : 'Select All'}
                </button>
                {selectedJobIds.size > 0 && (
                  <button 
                    onClick={deleteSelectedJobs} 
                    className="text-[10px] font-black text-rose-500 uppercase tracking-widest flex items-center gap-1.5 hover:text-rose-700 transition-colors"
                  >
                    Delete ({selectedJobIds.size})
                  </button>
                )}
              </div>
            )}

            {filteredHistory.length === 0 ? (
              <div className="text-center py-20 opacity-30">
                <p className="text-[10px] font-black uppercase tracking-widest mb-2">{historySearchTerm ? 'No Results' : 'Empty'}</p>
                <div className="text-3xl">🗂️</div>
              </div>
            ) : (
              filteredHistory.map(job => (
                <div key={job.id} className="relative group">
                  <div 
                    onClick={() => {
                      if (isManagingArchive) {
                        toggleJobSelection(job.id);
                      } else {
                        setCurrentJob(job); 
                        setResult(job.analysis);
                        setSelectedJobIds(new Set());
                      }
                    }}
                    className={`cursor-pointer w-full text-left p-5 rounded-[2rem] border transition-all hover:scale-[1.02] active:scale-[0.98] ${currentJob?.id === job.id && !isManagingArchive ? 'bg-slate-900 border-slate-900 text-white shadow-2xl' : selectedJobIds.has(job.id) ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-slate-100 hover:border-indigo-200'}`}
                  >
                    <div className="flex items-start gap-3">
                      {isManagingArchive && (
                        <div className={`mt-0.5 shrink-0 w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all ${selectedJobIds.has(job.id) ? 'bg-indigo-600 border-indigo-600' : 'border-slate-200 bg-white'}`}>
                          {selectedJobIds.has(job.id) && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>}
                        </div>
                      )}
                      <div className="flex-1 overflow-hidden">
                        <div className="flex items-center gap-2 mb-1.5">
                           <div className={`w-1.5 h-1.5 rounded-full ${getStatusDotColor(job.status)}`}></div>
                           <p className={`text-[10px] font-black truncate leading-tight ${currentJob?.id === job.id && !isManagingArchive ? 'text-white' : 'text-slate-900 group-hover:text-indigo-600'}`}>
                            {job.jobTitle}
                           </p>
                        </div>
                        <div className="flex items-center justify-between">
                          <p className={`text-[8px] font-bold ${currentJob?.id === job.id && !isManagingArchive ? 'text-slate-400' : 'text-slate-400'}`}>
                            {new Date(job.timestamp).toLocaleDateString()}
                          </p>
                          <span className={`text-[7px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest ${currentJob?.id === job.id && !isManagingArchive ? 'bg-white/10 text-white/80' : 'bg-slate-50 text-slate-400'}`}>
                            {job.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {!isManagingArchive && (
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm('Permanently remove this lead from archive?')) {
                          const newHistory = currentUser.history.filter(j => j.id !== job.id);
                          setCurrentUser(prev => prev ? ({ ...prev, history: newHistory }) : null);
                          if (currentJob?.id === job.id) {
                            setCurrentJob(null);
                            setResult(null);
                          }
                        }
                      }}
                      className="absolute -top-1 -right-1 p-1.5 bg-white border border-slate-100 rounded-full text-slate-200 hover:text-rose-500 hover:border-rose-100 shadow-sm opacity-0 group-hover:opacity-100 transition-all z-10"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </aside>
    </div>
  );
};

export default App;
