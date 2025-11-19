// File: src/storage/storage.ts
import { StorageSchema, UserProfile, UserPreferences, LLMConfig, JobDescription, ApplicationSession, DEFAULT_LLM_CONFIG, DEFAULT_PREFERENCES } from './schema';

export class StorageService {
    private static async get<K extends keyof StorageSchema>(key: K): Promise<StorageSchema[K] | undefined> {
        const result = await chrome.storage.local.get(key);
        return result[key];
    }

    private static async set<K extends keyof StorageSchema>(key: K, value: StorageSchema[K]): Promise<void> {
        await chrome.storage.local.set({ [key]: value });
    }

    static async getProfiles(): Promise<UserProfile[]> {
        return (await this.get('profiles')) || [];
    }

    static async saveProfile(profile: UserProfile): Promise<void> {
        const profiles = await this.getProfiles();
        const index = profiles.findIndex(p => p.id === profile.id);
        if (index >= 0) {
            profiles[index] = profile;
        } else {
            profiles.push(profile);
        }
        await this.set('profiles', profiles);
    }

    static async setDefaultProfileId(id: string): Promise<void> {
        await this.set('defaultProfileId', id);
    }

    static async getDefaultProfileId(): Promise<string | undefined> {
        return await this.get('defaultProfileId');
    }

    static async getPreferences(): Promise<UserPreferences> {
        return (await this.get('preferences')) || DEFAULT_PREFERENCES;
    }

    static async savePreferences(prefs: UserPreferences): Promise<void> {
        await this.set('preferences', prefs);
    }

    static async getLLMConfig(): Promise<LLMConfig> {
        return (await this.get('llmConfig')) || DEFAULT_LLM_CONFIG;
    }

    static async saveLLMConfig(config: LLMConfig): Promise<void> {
        await this.set('llmConfig', config);
    }

    static async getJobDescriptions(): Promise<JobDescription[]> {
        return (await this.get('jobDescriptions')) || [];
    }

    static async saveJobDescription(job: JobDescription): Promise<void> {
        const jobs = await this.getJobDescriptions();
        jobs.push(job);
        await this.set('jobDescriptions', jobs);
        await this.set('currentJobDescriptionId', job.id);
    }

    static async getCurrentJobDescription(): Promise<JobDescription | undefined> {
        const id = await this.get('currentJobDescriptionId');
        if (!id) return undefined;
        const jobs = await this.getJobDescriptions();
        return jobs.find(j => j.id === id);
    }

    static async getSession(key: string): Promise<ApplicationSession | undefined> {
        const sessions = (await this.get('sessions')) || {};
        return sessions[key];
    }

    static async saveSession(key: string, session: ApplicationSession): Promise<void> {
        const sessions = (await this.get('sessions')) || {};
        sessions[key] = session;
        await this.set('sessions', sessions);
    }
}
