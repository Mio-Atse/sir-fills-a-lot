// Heuristic job-page detector. Pure rule-based scoring, no network/LLM.

export interface JobPageDetectionResult {
    score: number;
    signals: string[];
}

type TextGroups = 'jobDescription' | 'applyActions' | 'resume';

interface JobPageDetectorConfig {
    threshold: number;
    maxTextLength: number;
    urlKeywords: string[];
    atsDomains: string[];
    textKeywords: Record<TextGroups, string[]>;
    formApplyTexts: string[];
    formMinFields: number;
    weights: {
        structuredData: number;
        atsDomain: number;
        urlKeyword: number;
        textJobDescription: number;
        textApply: number;
        textResume: number;
        textComboBonus: number;
        formLarge: number;
        formFileInput: number;
        formResumeText: number;
        formApplyButton: number;
    };
}

export const JOB_PAGE_DETECTOR_CONFIG: JobPageDetectorConfig = {
    threshold: 6,
    maxTextLength: 45000,
    urlKeywords: [
        'job',
        'jobs',
        'career',
        'careers',
        'position',
        'positions',
        'vacancy',
        'vacancies',
        'recruit',
        'apply',
        'join-us',
        'work-with-us',
        'opening',
        'openings',
    ],
    atsDomains: [
        'greenhouse.io',
        'boards.greenhouse.io',
        'lever.co',
        'jobs.lever.co',
        'myworkdayjobs.com',
        'workdayjobs.com',
        'smartrecruiters.com',
        'ashbyhq.com',
        'jobs.ashbyhq.com',
        'bamboohr.com',
        'icims.com',
        'jobvite.com',
        'workable.com',
        'personio.de',
        'recruitee.com',
        'teamtailor.com',
    ],
    textKeywords: {
        jobDescription: [
            // English
            'job description',
            'about the role',
            'role description',
            'responsibilities',
            'what you will do',
            "what you'll do",
            'requirements',
            'qualifications',
            'skills',
            'benefits',
            'compensation',
            'salary range',
            // Turkish
            'iş tanımı',
            'pozisyon',
            'pozisyon detayları',
            'sorumluluklar',
            'görev tanımı',
            'görevleriniz',
            'aranan nitelikler',
            'genel nitelikler',
            'başvuru koşulları',
        ],
        applyActions: [
            // English
            'apply',
            'apply now',
            'submit application',
            'start application',
            'apply for this job',
            // Turkish
            'başvur',
            'şimdi başvur',
            'başvuru formu',
            'online başvuru',
        ],
        resume: [
            // English
            'resume',
            'résumé',
            'cv ',
            'cv.',
            'curriculum vitae',
            'cover letter',
            'linkedin profile',
            'attach your resume',
            // Turkish
            'özgeçmiş',
            "cv'nizi",
            'özgeçmişinizi yükleyin',
        ],
    },
    formApplyTexts: [
        'apply',
        'apply now',
        'submit',
        'submit application',
        'başvur',
        'şimdi başvur',
    ],
    formMinFields: 5,
    weights: {
        structuredData: 8,
        atsDomain: 4,
        urlKeyword: 2,
        textJobDescription: 2,
        textApply: 2,
        textResume: 3,
        textComboBonus: 1,
        formLarge: 2,
        formFileInput: 3,
        formResumeText: 2,
        formApplyButton: 2,
    },
};

const normalize = (text: string, maxLength: number): string => {
    return text
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .slice(0, maxLength);
};

const includesAny = (text: string, keywords: string[]): boolean => {
    return keywords.some(keyword => text.includes(keyword));
};

const hasJobPostingType = (candidate: unknown, depth = 0): boolean => {
    if (depth > 4 || candidate === null || typeof candidate !== 'object') return false;

    const value: any = candidate;
    const typeField = value['@type'] ?? value.type;

    const matchesType = (type: string) => type.toLowerCase() === 'jobposting' || type.toLowerCase().endsWith('/jobposting');

    if (typeof typeField === 'string' && matchesType(typeField)) return true;
    if (Array.isArray(typeField) && typeField.some((t) => typeof t === 'string' && matchesType(t))) return true;

    if (Array.isArray(value)) {
        return value.some((item) => hasJobPostingType(item, depth + 1));
    }

    if (Array.isArray(value['@graph'])) {
        return hasJobPostingType(value['@graph'], depth + 1);
    }

    for (const child of Object.values(value)) {
        if (typeof child === 'object' && hasJobPostingType(child, depth + 1)) {
            return true;
        }
    }

    return false;
};

const detectStructuredJobData = (doc: Document): boolean => {
    const ldJsonScripts = Array.from(doc.querySelectorAll<HTMLScriptElement>('script[type="application/ld+json"]'));

    for (const script of ldJsonScripts) {
        if (!script.textContent) continue;
        try {
            const parsed = JSON.parse(script.textContent);
            if (hasJobPostingType(parsed)) {
                return true;
            }
        } catch {
            // Ignore malformed JSON
        }
    }

    const microdata = Array.from(doc.querySelectorAll<HTMLElement>('[itemscope][itemtype]'));
    return microdata.some((el) => {
        const itemType = el.getAttribute('itemtype')?.toLowerCase() || '';
        return itemType.includes('jobposting');
    });
};

const evaluateForms = (doc: Document, textKeywords: Record<TextGroups, string[]>, formApplyTexts: string[], minFields: number) => {
    const forms = Array.from(doc.querySelectorAll<HTMLFormElement>('form'));

    let hasLargeForm = false;
    let hasFileInput = false;
    let hasResumeText = false;
    let hasApplyButton = false;

    for (const form of forms) {
        const fields = Array.from(form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('input, textarea, select'));
        const visibleFields = fields.filter((field) => {
            if (field instanceof HTMLInputElement && field.type === 'hidden') return false;
            const style = window.getComputedStyle(field);
            return style.display !== 'none' && style.visibility !== 'hidden';
        });

        if (!hasLargeForm && visibleFields.length >= minFields) {
            hasLargeForm = true;
        }

        if (!hasFileInput && form.querySelector('input[type="file"]')) {
            hasFileInput = true;
        }

        const formText = normalize(form.innerText || '', 8000);
        if (!hasResumeText && includesAny(formText, textKeywords.resume)) {
            hasResumeText = true;
        }

        if (!hasApplyButton) {
            const submitControl = Array.from(form.querySelectorAll<HTMLButtonElement | HTMLInputElement>('button, input[type="submit"], input[type="button"]'))
                .some((btn) => {
                    const label = (btn.innerText || btn.getAttribute('value') || '').toLowerCase();
                    return includesAny(label, formApplyTexts);
                });
            hasApplyButton = submitControl;
        }
    }

    return { hasLargeForm, hasFileInput, hasResumeText, hasApplyButton };
};

export const getJobApplicationScore = (doc: Document, loc: Location): JobPageDetectionResult => {
    const { threshold, maxTextLength, urlKeywords, atsDomains, textKeywords, weights, formApplyTexts, formMinFields } = JOB_PAGE_DETECTOR_CONFIG;
    const hrefLower = loc.href.toLowerCase();
    const hostLower = loc.hostname.toLowerCase();
    const details: JobPageDetectionResult = { score: 0, signals: [] };

    const addSignal = (label: string, weight: number) => {
        details.score += weight;
        details.signals.push(`${label} (+${weight})`);
    };

    if (includesAny(hrefLower, urlKeywords)) {
        addSignal('url_keyword', weights.urlKeyword);
    }

    if (atsDomains.some((domain) => hostLower === domain || hostLower.endsWith(`.${domain}`))) {
        addSignal('known_ats_domain', weights.atsDomain);
    }

    if (detectStructuredJobData(doc)) {
        addSignal('structured_data_jobposting', weights.structuredData);
    }

    const bodyText = normalize(doc.body?.innerText || '', maxTextLength);
    const hasJobDescriptionText = includesAny(bodyText, textKeywords.jobDescription);
    const hasApplyText = includesAny(bodyText, textKeywords.applyActions);
    const hasResumeText = includesAny(bodyText, textKeywords.resume);

    if (hasJobDescriptionText) addSignal('text_job_description', weights.textJobDescription);
    if (hasApplyText) addSignal('text_apply', weights.textApply);
    if (hasResumeText) addSignal('text_resume', weights.textResume);
    if (hasJobDescriptionText && hasApplyText) addSignal('text_job_apply_combo', weights.textComboBonus);

    const formSignals = evaluateForms(doc, textKeywords, formApplyTexts, formMinFields);
    if (formSignals.hasLargeForm) addSignal('form_multiple_fields', weights.formLarge);
    if (formSignals.hasFileInput) addSignal('form_cv_upload', weights.formFileInput);
    if (formSignals.hasResumeText) addSignal('form_resume_text', weights.formResumeText);
    if (formSignals.hasApplyButton) addSignal('form_apply_button', weights.formApplyButton);

    // Attach threshold info for debugging in the signals
    details.signals.push(`threshold=${threshold}`);

    return details;
};

export const isLikelyJobApplicationPage = (doc: Document, loc: Location): boolean => {
    const { threshold } = JOB_PAGE_DETECTOR_CONFIG;
    const { score } = getJobApplicationScore(doc, loc);
    return score >= threshold;
};
