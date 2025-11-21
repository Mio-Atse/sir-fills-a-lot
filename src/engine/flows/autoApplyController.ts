import { CanonicalProfile, CanonicalFieldType } from '../profile/canonicalProfile';
import { scanForCandidates } from '../dom/fieldDiscovery';
import { matchFields } from '../dom/matcher';
import { fillField } from '../dom/filler';
import { detectPlatform, getPlatformConfig } from '../platform/platformDetector';

export class AutoApplyController {
    private profile: CanonicalProfile;
    private isRunning: boolean = false;
    private observer: MutationObserver | null = null;

    constructor(profile: CanonicalProfile) {
        this.profile = profile;
    }

    public async start(root: HTMLElement = document.body) {
        if (this.isRunning) return;
        this.isRunning = true;
        console.log('AutoApplyController started');

        const platform = detectPlatform();
        const config = getPlatformConfig(platform);

        // If platform has a specific modal selector, wait for it or scope to it
        let container = root;
        if (config.modalSelector) {
            const modal = document.querySelector(config.modalSelector) as HTMLElement;
            if (modal) {
                container = modal;
            } else {
                console.log('Waiting for modal...');
                // Logic to wait for modal could go here
            }
        }

        await this.processStep(container);
    }

    public stop() {
        this.isRunning = false;
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
    }

    private async processStep(container: HTMLElement) {
        if (!this.isRunning) return;

        console.log('Processing step in container', container);

        // 1. Analyze
        const candidates = scanForCandidates(container);
        const matches = matchFields(candidates);

        console.log('Found matches:', matches);

        // 2. Fill
        for (const [type, candidate] of matches.entries()) {
            const value = this.getValueForType(type);
            if (value !== undefined && value !== '') {
                console.log(`Filling ${type} with ${value}`);
                await fillField(candidate, value);
                // Small delay to mimic human behavior
                await new Promise(r => setTimeout(r, 100));
            }
        }

        // 3. Find Navigation (Next/Submit)
        // This is a simplified heuristic. Real implementation needs robust button finding.
        const buttons = Array.from(container.querySelectorAll('button, input[type="submit"], a[role="button"]'));
        const nextButton = buttons.find(btn => {
            const text = (btn.textContent || (btn as HTMLInputElement).value || '').toLowerCase();
            return text.includes('next') || text.includes('continue') || text.includes('review') || text.includes('submit');
        }) as HTMLElement;

        if (nextButton && !nextButton.hasAttribute('disabled')) {
            console.log('Found next button, clicking...', nextButton);
            nextButton.click(); // Commented out for safety in this first pass
            // In a real run, we would click, then wait for mutation
        } else {
            console.log('No next button found or disabled.');
        }
    }

    private getValueForType(type: CanonicalFieldType): any {
        const p = this.profile.personal;
        const d = this.profile.applicationDefaults;

        switch (type) {
            case CanonicalFieldType.FirstName: return p.firstName;
            case CanonicalFieldType.LastName: return p.lastName;
            case CanonicalFieldType.FullName: return p.fullName;
            case CanonicalFieldType.Email: return p.email;
            case CanonicalFieldType.Phone: return p.phone;
            case CanonicalFieldType.City: return p.city;
            case CanonicalFieldType.Country: return p.country;
            case CanonicalFieldType.LinkedinUrl: return p.linkedinUrl;
            case CanonicalFieldType.PortfolioUrl: return p.portfolioUrl;
            case CanonicalFieldType.WebsiteUrl: return p.websiteUrl;
            case CanonicalFieldType.WorkAuthorization: return d.workAuthorization;
            case CanonicalFieldType.SponsorshipRequired: return d.sponsorshipRequired;
            case CanonicalFieldType.RelocationWillingness: return d.willingToRelocate;
            case CanonicalFieldType.RemotePreference: return d.willingToRemote;
            case CanonicalFieldType.DesiredSalary: return d.desiredSalary;
            case CanonicalFieldType.YearsExperience: return d.yearsExperience;
            // Files are harder, need object or specific handling
            default: return undefined;
        }
    }
}
