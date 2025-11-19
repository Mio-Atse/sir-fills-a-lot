// File: src/llm/prompts/coverLetterPrompt.ts
import { LLMMessage } from "../providers";
import { UserProfile, UserPreferences, JobDescription } from "../../storage/schema";

export function getCoverLetterPrompt(
    profile: UserProfile,
    prefs: UserPreferences,
    job: JobDescription,
    customInstructions?: string
): LLMMessage[] {
    return [
        {
            role: "system",
            content: `You are an expert career coach and copywriter. Write a professional, engaging, and concise cover letter.
      
      Use the provided candidate profile and job description.
      Tailor the letter to the specific job requirements.
      Highlight relevant skills and experience.
      Keep it under 400 words unless requested otherwise.
      Do not include placeholders like "[Your Name]" - use the data provided or generic professional sign-offs if name is missing.
      
      Return ONLY the body of the cover letter.`
        },
        {
            role: "user",
            content: `
      Candidate Profile:
      ${JSON.stringify(profile, null, 2)}
      
      Candidate Preferences:
      ${JSON.stringify(prefs, null, 2)}
      
      Job Description:
      ${job.text}
      
      ${customInstructions ? `Additional Instructions: ${customInstructions}` : ""}
      `
        }
    ];
}
