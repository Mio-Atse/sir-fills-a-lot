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
  "projects": [{ "name": "Project name", "description": "What they did / tech", "link": "", "technologies": [""] }],
  "publications": [{ "title": "Paper title", "venue": "Conference/Journal", "year": "YYYY", "link": "", "description": "" }],
  "awards": ["Award - Issuer - Year", ...],
  "volunteer": [{ "organization": "Org", "role": "Role", "start_date": "YYYY-MM or Present", "end_date": "YYYY-MM or Present", "description": "" }],
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
      "year": "Graduation Year or range"
    }
  ],
  "preferred_roles": ["Role 1", "Role 2"],
  "extracted_fields": {
    "anything_else_useful": "If you see extra explicit facts (visa status, clearance, salary expectations, publications not covered, tools, etc.), put short key-value pairs here"
  },
  "custom_sections": {
    "Section Title": ["Bullet or sentence extracted verbatim", "Another bullet"]
  }
}

Rules:
- If a field is missing, use empty strings or empty arrays.
- Do not invent facts; only include what is explicit or strongly implied.
- Normalize phone with digits and punctuation only.
- If you see a section that does not fit above (e.g., Publications, Patents, Talks, Volunteer, Awards), fill the corresponding field; otherwise drop the bullets into custom_sections with the section title as the key.`
        },
        {
            role: "user",
            content: `Here is the CV text:\n\n${cvText}`
        }
    ];
}
