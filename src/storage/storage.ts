// File: src/storage/storage.ts
import { StorageSchema, UserProfile, UserPreferences, LLMConfig, JobDescription, ApplicationSession, DEFAULT_LLM_CONFIG, DEFAULT_PREFERENCES } from './schema';
import { encryptString, decryptString, isEncryptedString } from '../utils/encryption';

export class StorageService {
    private static async get<K extends keyof StorageSchema>(key: K): Promise<StorageSchema[K] | undefined> {
        const result = await chrome.storage.local.get(key);
        return result[key];
    }

    private static async set<K extends keyof StorageSchema>(key: K, value: StorageSchema[K]): Promise<void> {
        await chrome.storage.local.set({ [key]: value });
    }

    private static async decryptProfile(profile: UserProfile): Promise<UserProfile> {
        const clone = { ...profile };
        if (clone.resume_data && isEncryptedString(clone.resume_data)) {
            clone.resume_data = await decryptString(clone.resume_data);
        }
        if (clone.raw_text && isEncryptedString(clone.raw_text)) {
            clone.raw_text = await decryptString(clone.raw_text);
        }
        return clone;
    }

    private static async encryptProfile(profile: UserProfile): Promise<UserProfile> {
        const clone = { ...profile };
        if (clone.resume_data && !isEncryptedString(clone.resume_data)) {
            clone.resume_data = await encryptString(clone.resume_data);
        }
        if (clone.raw_text && !isEncryptedString(clone.raw_text)) {
            clone.raw_text = await encryptString(clone.raw_text);
        }
        return clone;
    }

    private static async decryptProfiles(profiles: UserProfile[]): Promise<UserProfile[]> {
        return Promise.all(profiles.map(p => this.decryptProfile(p)));
    }

    private static async encryptProfiles(profiles: UserProfile[]): Promise<UserProfile[]> {
        return Promise.all(profiles.map(p => this.encryptProfile(p)));
    }

    private static async decryptLLMConfig(config: LLMConfig): Promise<LLMConfig> {
        const clone: LLMConfig = {
            ...DEFAULT_LLM_CONFIG,
            ...config,
            apiKeys: { ...DEFAULT_LLM_CONFIG.apiKeys, ...config.apiKeys },
        };

        const decryptedKeys: Record<string, string | undefined> = {};
        for (const [provider, value] of Object.entries(clone.apiKeys)) {
            if (typeof value === 'string' && isEncryptedString(value)) {
                decryptedKeys[provider] = await decryptString(value);
            } else {
                decryptedKeys[provider] = value;
            }
        }

        clone.apiKeys = decryptedKeys;
        return clone;
    }

    private static async encryptLLMConfig(config: LLMConfig): Promise<LLMConfig> {
        const clone: LLMConfig = {
            ...DEFAULT_LLM_CONFIG,
            ...config,
            apiKeys: { ...DEFAULT_LLM_CONFIG.apiKeys, ...config.apiKeys },
        };

        const encryptedKeys: Record<string, string | undefined> = {};
        for (const [provider, value] of Object.entries(clone.apiKeys)) {
            if (typeof value === 'string' && value) {
                encryptedKeys[provider] = await encryptString(value);
            }
        }
        clone.apiKeys = encryptedKeys;
        return clone;
    }

    static async getProfiles(): Promise<UserProfile[]> {
        const stored = (await this.get('profiles')) || [];
        return this.decryptProfiles(stored);
    }

    static async saveProfile(profile: UserProfile): Promise<void> {
        const profiles = await this.getProfiles();
        const index = profiles.findIndex(p => p.id === profile.id);
        if (index >= 0) {
            profiles[index] = profile;
        } else {
            profiles.push(profile);
        }
        const encrypted = await this.encryptProfiles(profiles);
        await this.set('profiles', encrypted as StorageSchema['profiles']);
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
        const stored = (await this.get('llmConfig')) || DEFAULT_LLM_CONFIG;
        return this.decryptLLMConfig(stored);
    }

    static async saveLLMConfig(config: LLMConfig): Promise<void> {
        const encrypted = await this.encryptLLMConfig(config);
        await this.set('llmConfig', encrypted as StorageSchema['llmConfig']);
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
