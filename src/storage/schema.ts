// File: src/storage/schema.ts

export interface UserProfile {
    id: string;
    cv_name: string;
    summary: string;
    // Personal Details
    full_name?: string;
    email?: string;
    phone?: string;
    linkedin?: string;
    github?: string;
    portfolio?: string;
    website?: string;
    address?: string;
    city?: string;
    country?: string;
    headline?: string;
    publications?: {
        title: string;
        venue?: string;
        year?: string;
        link?: string;
        description?: string;
    }[];
    awards?: string[];
    volunteer?: {
        organization: string;
        role?: string;
        start_date?: string;
        end_date?: string;
        description?: string;
    }[];

    // Resume File (Base64)
    resume_data?: string;
    resume_name?: string;

    skills: string[];
    languages?: string[];
    certifications?: string[];
    experience: {
        company: string;
        title: string;
        start_date: string;
        end_date: string;
        description: string;
    }[];
    education: {
        institution: string;
        degree: string;
        year: string;
    }[];
    projects?: {
        name: string;
        description: string;
        link?: string;
        technologies?: string[];
    }[];
    preferred_roles: string[];
    location: string;
    raw_text: string; // The full text content of the CV
    extracted_fields?: Record<string, string>;
    custom_sections?: Record<string, string[]>;
    last_updated: number;
}

export interface UserPreferences {
    preferred_role_titles: string[];
    preferred_locations: string[];
    remote_only: boolean;
    relocation_ok: boolean;
    salary_min: number;
    salary_max: number;
    currency: string;
    notice_period: string;
    years_of_experience: number;
    visa_sponsorship_required: boolean;
}

export type LLMProviderName = "ollama" | "openai" | "groq" | "gemini";

export interface LLMConfig {
    mode: "local" | "api";
    provider: LLMProviderName | null;
    consentToSendData: boolean; // Explicit user consent for sending profile/job data to cloud providers
    apiKeys: {
        openai?: string;
        groq?: string;
        gemini?: string;
    };
    models: {
        bigModel: string;
        smallModel: string;
    };
    ollama: {
        baseUrl: string;
    };
}

export interface JobDescription {
    id: string;
    text: string;
    sourceUrl: string;
    timestamp: number;
    title?: string;
}

export interface ApplicationSession {
    id: string;
    createdAt: number;
    stepsVisited: string[];
    currentStep: string;
    jobDescriptionId?: string;
    cvProfileId?: string;
    status: "in_progress" | "completed";
}

export interface StorageSchema {
    profiles: UserProfile[];
    defaultProfileId?: string;
    preferences: UserPreferences;
    llmConfig: LLMConfig;
    jobDescriptions: JobDescription[];
    currentJobDescriptionId?: string;
    sessions: Record<string, ApplicationSession>; // Keyed by hostname or similar
}

export const DEFAULT_LLM_CONFIG: LLMConfig = {
    mode: "local",
    provider: null,
    consentToSendData: false,
    apiKeys: {},
    models: {
        bigModel: "llama3:70b",
        smallModel: "llama3:8b",
    },
    ollama: {
        baseUrl: "http://localhost:11434",
    },
};

export const DEFAULT_PREFERENCES: UserPreferences = {
    preferred_role_titles: [],
    preferred_locations: [],
    remote_only: false,
    relocation_ok: true,
    salary_min: 0,
    salary_max: 0,
    currency: "USD",
    notice_period: "2 weeks",
    years_of_experience: 0,
    visa_sponsorship_required: false,
};
