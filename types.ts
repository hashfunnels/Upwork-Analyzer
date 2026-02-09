
export type BudgetType = 'fixed' | 'hourly' | 'unspecified';
export type JobStatus = 'lead' | 'applied' | 'interviewing' | 'hired' | 'declined';
export type ProposalTone = 'bold' | 'professional' | 'friendly' | 'minimalist' | 'detailed' | 'like_myself';

export interface PortfolioLink {
  name: string;
  url: string;
}

export interface UserProfile {
  id: string;
  label: string; // e.g., "General", "Web Development", "Mobile Design"
  profile_name?: string;
  profile_headline?: string;
  upwork_profile_text?: string;
  your_profile_skills: string[];
  your_rate_preferences?: string;
}

export interface ClientProfile {
  client_id?: string;
  location?: string;
  member_since?: string;
  jobs_posted_count?: number | null;
  hire_rate_percent?: number | null;
  total_spent_usd?: number | null;
  payment_verified?: boolean | null;
  average_feedback_rating?: number | null;
  recent_reviews?: string[] | null;
}

export interface Message {
  role: 'client' | 'me';
  text: string;
  timestamp: number;
}

export interface JobInput {
  raw_text: string;
  active_profile?: UserProfile;
  previous_proposals?: string | null;
  portfolio_links?: PortfolioLink[];
  preferred_tone?: ProposalTone;
}

export interface AnalysisResult {
  apply_recommendation: 'apply' | 'maybe_apply' | 'do_not_apply';
  confidence: number;
  opportunity_score: number;
  job_title: string;
  red_flags: Array<{ title: string; severity: 'low' | 'medium' | 'high'; explanation: string }>;
  green_flags: Array<{ title: string; importance: 'low' | 'medium' | 'high'; explanation: string }>;
  detailed_report: string;
  opinion: string;
  proposal?: {
    cover_letter: string;
    proposed_budget?: number | null;
    proposed_rate_text?: string | null;
    suggested_first_message?: string | null;
  } | null;
  analytics: {
    flag_counts: { red: number; green: number };
    risk_factors: Array<{ factor: string; score: number; notes: string }>;
    skill_match: Array<{ skill: string; match_score: number; status: 'expert' | 'proficient' | 'missing' }>;
    client_metrics: {
      responsiveness: number;
      generosity: number;
      clarity: number;
    };
  };
  structured_reasons: string[];
  missing_info_sensitivity: Array<{
    missing_field: string;
    impact_if_missing: string;
    how_to_resolve: string;
  }>;
}

export interface SavedJob {
  id: string;
  timestamp: number;
  jobTitle: string;
  clientName: string;
  rawText: string;
  analysis: AnalysisResult;
  messages: Message[];
  status: JobStatus;
  editedProposal?: string;
}

export interface UserIdentity {
  profiles: UserProfile[];
  activeProfileId: string;
  previous_proposals?: string;
  portfolio_links: PortfolioLink[];
  preferred_tone: ProposalTone;
}

export interface UserAccount {
  username: string;
  password?: string;
  identity: UserIdentity;
  history: SavedJob[];
}
