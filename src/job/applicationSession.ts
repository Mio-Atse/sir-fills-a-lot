// File: src/job/applicationSession.ts
import { StorageService } from '../storage/storage';
import { ApplicationSession } from '../storage/schema';

export class SessionManager {
    static async getOrCreateSession(hostname: string): Promise<ApplicationSession> {
        let session = await StorageService.getSession(hostname);

        // Check if session is expired (e.g. > 24 hours) or completed
        if (session && (Date.now() - session.createdAt > 24 * 60 * 60 * 1000 || session.status === 'completed')) {
            session = undefined;
        }

        if (!session) {
            session = {
                id: crypto.randomUUID(),
                createdAt: Date.now(),
                stepsVisited: [],
                currentStep: window.location.href,
                status: 'in_progress'
            };
            await StorageService.saveSession(hostname, session);
        }

        return session;
    }

    static async updateStep(hostname: string, url: string): Promise<void> {
        const session = await this.getOrCreateSession(hostname);
        if (!session.stepsVisited.includes(url)) {
            session.stepsVisited.push(url);
        }
        session.currentStep = url;
        await StorageService.saveSession(hostname, session);
    }

    static async markCompleted(hostname: string): Promise<void> {
        const session = await this.getOrCreateSession(hostname);
        session.status = 'completed';
        await StorageService.saveSession(hostname, session);
    }
}
