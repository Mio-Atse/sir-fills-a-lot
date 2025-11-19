// File: src/llm/prompts/cvProfilePrompt.ts
import { LLMMessage } from "../providers";

export function getCVProfilePrompt(cvText: string): LLMMessage[] {
    return [
        {
            role: "system",
            content: `You are an expert HR assistant. Your task is to parse a raw CV/Resume text and extract a structured JSON profile.
      
      Return ONLY valid JSON. No markdown formatting, no explanations.
      
      The JSON structure must match this schema:
      {
        "summary": "A professional summary of the candidate",
        "skills": ["skill1", "skill2", ...],
        "experience": [
          {
            "company": "Company Name",
            "title": "Job Title",
            "start_date": "YYYY-MM or Present",
            "end_date": "YYYY-MM or Present",
            "description": "Brief description of responsibilities"
          }
        ],
        "education": [
          {
            "institution": "University Name",
            "degree": "Degree Name",
            "year": "Graduation Year"
          }
        ],
        "preferred_roles": ["Role 1", "Role 2"],
        "location": "Candidate Location"
      }
      
      If a field is missing, use empty strings or arrays. Infer preferred_roles from experience if not explicit.`
        },
        {
            role: "user",
            content: `Here is the CV text:\n\n${cvText}`
        }
    ];
}
