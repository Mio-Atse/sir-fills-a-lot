import { UserProfile, UserPreferences } from '../../storage/schema';

export enum CanonicalFieldType {
    FirstName = 'firstName',
    LastName = 'lastName',
    FullName = 'fullName',
    Email = 'email',
    Phone = 'phone',
    Country = 'country',
    City = 'city',
    Location = 'location',
    LinkedinUrl = 'linkedinUrl',
    PortfolioUrl = 'portfolioUrl',
    WebsiteUrl = 'websiteUrl',

    // Application Defaults
    WorkAuthorization = 'workAuthorization',
    SponsorshipRequired = 'sponsorshipRequired',
    RelocationWillingness = 'relocationWillingness',
    RemotePreference = 'remotePreference',
    DesiredSalary = 'desiredSalary',
    YearsExperience = 'yearsExperience',

    // Files
    Resume = 'resume',
    CoverLetter = 'coverLetter',

    // Generic
    YesNo = 'yesNo',
    FreeText = 'freeText',
    Unknown = 'unknown'
}

export interface CanonicalProfile {
    personal: {
        firstName: string;
        lastName: string;
        fullName: string;
        email: string;
        phone: string;
        country?: string;
        city?: string;
        locationString: string;
        linkedinUrl?: string;
        portfolioUrl?: string;
        websiteUrl?: string;
    };
    applicationDefaults: {
        workAuthorization: boolean; // true = authorized
        sponsorshipRequired: boolean; // true = needs sponsorship
        willingToRelocate: boolean;
        willingToRemote: boolean;
        desiredSalary?: string;
        yearsExperience?: number;
    };
    files: {
        resume?: {
            data: string; // base64
            name: string;
        };
        coverLetter?: string; // text content
    };
    computed: {
        skills: string[];
        fullTextSummary: string;
    };
}

/**
 * Maps the existing UserProfile and UserPreferences to the new CanonicalProfile.
 */
export function mapUserToCanonical(user: UserProfile, prefs: UserPreferences): CanonicalProfile {
    // Split full name if possible
    const nameParts = (user.full_name || '').trim().split(/\s+/);
    const firstName = nameParts.length > 0 ? nameParts[0] : '';
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';

    return {
        personal: {
            firstName,
            lastName,
            fullName: user.full_name || '',
            email: user.email || '',
            phone: user.phone || '',
            locationString: user.location || '',
            linkedinUrl: user.linkedin,
            portfolioUrl: user.portfolio,
            websiteUrl: user.github, // Using github as website fallback if portfolio is distinct
        },
        applicationDefaults: {
            workAuthorization: !prefs.visa_sponsorship_required, // Assuming if sponsorship not required, they are authorized. Rough heuristic.
            sponsorshipRequired: prefs.visa_sponsorship_required,
            willingToRelocate: prefs.relocation_ok,
            willingToRemote: prefs.remote_only, // If remote_only is true, they are willing to remote.
            desiredSalary: prefs.salary_min ? `${prefs.salary_min}` : undefined,
            yearsExperience: prefs.years_of_experience,
        },
        files: {
            resume: user.resume_data && user.resume_name ? {
                data: user.resume_data,
                name: user.resume_name
            } : undefined,
        },
        computed: {
            skills: user.skills || [],
            fullTextSummary: user.summary || '',
        }
    };
}
