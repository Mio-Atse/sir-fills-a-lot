// File: src/llm/prompts/cvProfilePrompt.ts
import { LLMMessage } from "../providers";

export function getCVProfilePrompt(cvText: string): LLMMessage[] {
    return [
        {
            role: "system",
            content: `You are an expert HR assistant. Parse the raw CV/Resume text and output structured JSON only (no markdown, no prose).

Return strictly this JSON shape:
{
  "full_name": "Full name if found, else empty string",
  "headline": "Short headline/tagline if present",
  "email": "Primary email or empty string",
  "phone": "Primary phone in international format if possible",
  "location": { "city": "", "country": "", "address": "" },
  "links": { "linkedin": "", "github": "", "portfolio": "", "website": "" },
  "summary": "Professional summary (2-4 sentences)",
  "skills": ["skill1", "skill2", ...],
  "languages": ["English", "French", ...],
  "certifications": ["Certification Name - Issuer - Year", ...],
  "projects": [{ "name": "Project name", "description": "What they did / tech" }],
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
  "extracted_fields": {
    "anything_else_useful": "If you see extra explicit facts (visa status, clearance, salary expectations, etc.), put short key-value pairs here"
  }
}

Rules:
- If a field is missing, use empty strings or empty arrays.
- Do not invent facts; only include what is explicit or strongly implied.
- Normalize phone with digits and punctuation only.`
        },
        {
            role: "user",
            content: `Here is the CV text:\n\n${cvText}`
        }
    ];
}
