
import { GoogleGenAI, Type } from "@google/genai";
import { JobInput, AnalysisResult, SavedJob, ProposalTone } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const extractProfileDetails = async (profileText: string): Promise<{ skills: string[], rate: string, name: string, headline: string }> => {
  const systemInstruction = `Extract professional identity details from this Upwork profile bio. 
    Return ONLY valid JSON.
    - name: The user's name if mentioned, otherwise "Anonymous Pro".
    - headline: A short, catchy professional title/headline (max 10 words) based on the content.
    - skills: A list of specific technical/soft skills found.
    - rate: Any mentioned hourly or project rates (e.g. "$50/hr"). 
    If a field is missing, provide a sensible default or empty string.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [{ role: "user", parts: [{ text: profileText }] }],
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          headline: { type: Type.STRING },
          skills: { type: Type.ARRAY, items: { type: Type.STRING } },
          rate: { type: Type.STRING }
        },
        required: ["skills", "rate", "name", "headline"]
      }
    }
  });

  return JSON.parse(response.text);
};

export const regenerateProposal = async (job: SavedJob, tone: ProposalTone, userBio?: string, userSamples?: string): Promise<string> => {
  const isMimicMode = tone === 'like_myself';
  
  const systemInstruction = `You are a high-earning human freelancer on Upwork. Rewrite the cover letter for this job using a "${tone}" tone.
    
    HUMAN TONE RULES:
    1. AVOID AI CLICHÉS: Never use "I hope this finds you well", "In the digital landscape", "Look no further", or "I have a proven track record".
    2. BE CONVERSATIONAL: Write like a real person talking to a client about a problem. Use natural contractions (I'm, can't, you'll).
    3. CURIOSITY FIRST: Ask a thoughtful, genuine question about their project.
    4. NO FORMULAS: Do not follow a rigid "Greeting -> Skills -> Conclusion" format. Let the ideas flow naturally.
    5. CLEAN TEXT: NO markdown bolding (**). Plain text only.

    TONE DEFINITIONS:
    - like_myself: STRICTLY mimic the provided Voice Samples. Follow the sentence patterns, greetings, sequence, and overall writing style exactly as seen in the samples.
    - bold: Direct, results-oriented, high-status.
    - professional: Polished, methodical, respectful.
    - friendly: Personable, energetic, approachable.
    - minimalist: Ultra-concise, focuses on the core value immediately.
    - detailed: Thorough, evidentiary, analytical.

    User Context (Bio/Headline): ${userBio || 'Pro Freelancer'}. 
    ${isMimicMode ? `CRITICAL VOICE SAMPLES TO MIMIC:\n${userSamples || 'No samples provided, use a professional human tone.'}` : `User Samples for Voice: ${userSamples || 'N/A'}`}`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [{ role: "user", parts: [{ text: `Job: ${job.jobTitle}\nJob Description: ${job.rawText.substring(0, 1500)}` }] }],
    config: { systemInstruction }
  });

  return response.text || "Failed to regenerate.";
};

export const suggestFollowUpMessage = async (job: SavedJob): Promise<string> => {
  const conversation = job.messages.map(m => `${m.role === 'client' ? 'Client' : 'Me'}: ${m.text}`).join('\n');
  const systemInstruction = `You are a savvy human freelancer coach. 
    Suggest a natural, human-like follow-up message that feels authentic and persuasive.
    AVOID: "I'm checking in on the status", "Please let me know your thoughts".
    USE: "Just curious if you made a decision on [Topic]", "I was thinking about our conversation earlier and [New Idea]".
    Tone should match the user's previous style. NO markdown bolding.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [{ role: "user", parts: [{ text: `Job: ${job.jobTitle}\n\nConversation:\n${conversation}` }] }],
    config: { systemInstruction }
  });

  return response.text || "I couldn't generate a suggestion right now.";
};

export const analyzeJobPosting = async (input: JobInput): Promise<AnalysisResult> => {
  const tone = input.preferred_tone || 'professional';
  const isMimicMode = tone === 'like_myself';
  const activeProfile = input.active_profile;

  const systemInstruction = `You are a world-class Freelancing Strategy Consultant. 
    Analyze the job data and draft a HIGHLY HUMAN-LIKE proposal.
    
    PROPOSAL WRITING GUIDELINES:
    - NO AI CLICHÉS. Be authentic, slightly informal but respectful.
    - Use a ${tone} personality.
    ${isMimicMode ? `- MIMIC THE SAMPLES: Strictly follow the writing pattern, sequence, and vocabulary found in the provided Voice Samples.` : ''}
    - Focus on solving the client's specific pain point immediately.
    - Ask a question that proves you understand the work.
    - CLEAN PLAIN TEXT ONLY. NO markdown bolding (**).

    ${isMimicMode ? `USER SAMPLES TO MIMIC:\n${input.previous_proposals || 'N/A'}` : ''}

    ACTIVE PROFILE CONTEXT:
    - Headline: ${activeProfile?.profile_headline || 'N/A'}
    - Bio: ${activeProfile?.upwork_profile_text || 'N/A'}
    - Key Skills: ${activeProfile?.your_profile_skills?.join(', ') || 'N/A'}

    OUTPUT JSON:
    - job_title: Human-friendly version of the job title.
    - proposal: { cover_letter: "HUMAN-LIKE TEXT", ... }
    - analytics: { ... }
    - detailed_report: Deep analysis for the freelancer.
    
    Output ONLY valid JSON.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: [
      { role: "user", parts: [{ text: `Job Analysis Request: ${JSON.stringify(input)}` }] }
    ],
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          apply_recommendation: { type: Type.STRING },
          confidence: { type: Type.NUMBER },
          opportunity_score: { type: Type.NUMBER },
          job_title: { type: Type.STRING },
          red_flags: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                severity: { type: Type.STRING },
                explanation: { type: Type.STRING }
              }
            }
          },
          green_flags: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                importance: { type: Type.STRING },
                explanation: { type: Type.STRING }
              }
            }
          },
          detailed_report: { type: Type.STRING },
          opinion: { type: Type.STRING },
          proposal: {
            type: Type.OBJECT,
            properties: {
              cover_letter: { type: Type.STRING },
              proposed_budget: { type: Type.NUMBER, nullable: true },
              proposed_rate_text: { type: Type.STRING },
              suggested_first_message: { type: Type.STRING }
            },
            nullable: true
          },
          analytics: {
            type: Type.OBJECT,
            properties: {
              flag_counts: {
                type: Type.OBJECT,
                properties: {
                  red: { type: Type.INTEGER },
                  green: { type: Type.INTEGER }
                }
              },
              risk_factors: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    factor: { type: Type.STRING },
                    score: { type: Type.NUMBER },
                    notes: { type: Type.STRING }
                  }
                }
              },
              skill_match: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    skill: { type: Type.STRING },
                    match_score: { type: Type.NUMBER },
                    status: { type: Type.STRING }
                  }
                }
              },
              client_metrics: {
                type: Type.OBJECT,
                properties: {
                  responsiveness: { type: Type.NUMBER },
                  generosity: { type: Type.NUMBER },
                  clarity: { type: Type.NUMBER }
                }
              }
            }
          },
          structured_reasons: { type: Type.ARRAY, items: { type: Type.STRING } },
          missing_info_sensitivity: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                missing_field: { type: Type.STRING },
                impact_if_missing: { type: Type.STRING },
                how_to_resolve: { type: Type.STRING }
              }
            }
          }
        },
        required: ["apply_recommendation", "confidence", "opportunity_score", "job_title", "analytics", "detailed_report", "structured_reasons"]
      }
    }
  });

  return JSON.parse(response.text);
};
