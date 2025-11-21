export enum Platform {
    LinkedIn = 'linkedin',
    Indeed = 'indeed',
    Glassdoor = 'glassdoor',
    Monster = 'monster',
    ZipRecruiter = 'ziprecruiter',
    Workday = 'workday',
    Greenhouse = 'greenhouse',
    Lever = 'lever',
    Unknown = 'unknown'
}

export interface PlatformConfig {
    name: Platform;
    // Optional: specific selectors if we absolutely need them for a platform
    modalSelector?: string;
    submitButtonText?: string[];
}

export function detectPlatform(hostname: string = window.location.hostname): Platform {
    if (hostname.includes('linkedin.com')) return Platform.LinkedIn;
    if (hostname.includes('indeed.com')) return Platform.Indeed;
    if (hostname.includes('glassdoor.com')) return Platform.Glassdoor;
    if (hostname.includes('monster.com')) return Platform.Monster;
    if (hostname.includes('ziprecruiter.com')) return Platform.ZipRecruiter;
    if (hostname.includes('myworkdayjobs.com')) return Platform.Workday;
    if (hostname.includes('boards.greenhouse.io')) return Platform.Greenhouse;
    if (hostname.includes('jobs.lever.co')) return Platform.Lever;

    return Platform.Unknown;
}

export function getPlatformConfig(platform: Platform): PlatformConfig {
    switch (platform) {
        case Platform.LinkedIn:
            return {
                name: Platform.LinkedIn,
                modalSelector: '.jobs-easy-apply-content',
                submitButtonText: ['Submit application', 'Review']
            };
        default:
            return {
                name: platform
            };
    }
}
