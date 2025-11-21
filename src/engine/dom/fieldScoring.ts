import { CanonicalFieldType } from '../profile/canonicalProfile';
import { FormFieldCandidate } from './fieldDiscovery';

type SynonymList = string[];

// Dictionary mapping canonical types to synonyms
const SYNONYMS: Partial<Record<CanonicalFieldType, {
    attributes: SynonymList; // Matches against name, id, autocomplete
    labels: SynonymList;     // Matches against label, placeholder, aria-label
}>> = {
    [CanonicalFieldType.FirstName]: {
        attributes: ['firstname', 'first_name', 'givenname', 'given_name', 'fname', 'name_first'],
        labels: ['first name', 'given name', 'first']
    },
    [CanonicalFieldType.LastName]: {
        attributes: ['lastname', 'last_name', 'surname', 'familyname', 'family_name', 'lname', 'name_last'],
        labels: ['last name', 'surname', 'family name', 'last']
    },
    [CanonicalFieldType.FullName]: {
        attributes: ['fullname', 'full_name', 'name'],
        labels: ['full name', 'your name', 'name']
    },
    [CanonicalFieldType.Email]: {
        attributes: ['email', 'e-mail', 'emailaddress', 'email_address'],
        labels: ['email', 'e-mail', 'email address']
    },
    [CanonicalFieldType.Phone]: {
        attributes: ['phone', 'phonenumber', 'phone_number', 'mobile', 'cell', 'tel', 'telephone'],
        labels: ['phone', 'mobile', 'cell', 'telephone', 'number']
    },
    [CanonicalFieldType.LinkedinUrl]: {
        attributes: ['linkedin', 'linkedin_url', 'linkedin_profile'],
        labels: ['linkedin', 'linkedin profile', 'linkedin url']
    },
    [CanonicalFieldType.PortfolioUrl]: {
        attributes: ['portfolio', 'website', 'url', 'link'],
        labels: ['portfolio', 'website', 'personal site', 'link to portfolio']
    },
    [CanonicalFieldType.Resume]: {
        attributes: ['resume', 'resume_file', 'cv', 'cv_file', 'curriculum_vitae', 'file', 'upload', 'upload_resume', 'upload_cv'],
        labels: ['resume', 'cv', 'curriculum vitae', 'upload resume', 'upload your cv', 'attach cv']
    },
    [CanonicalFieldType.CoverLetter]: {
        attributes: ['coverletter', 'cover_letter', 'letter', 'motivation', 'why_this_role', 'why_you', 'whyfit', 'whyfitthis'],
        labels: ['cover letter', 'add a cover letter', 'motivation', 'why are you a fit', 'why do you want', 'why this role', 'why you', 'why should we']
    },
    [CanonicalFieldType.City]: {
        attributes: ['city', 'town'],
        labels: ['city', 'town']
    },
    [CanonicalFieldType.Country]: {
        attributes: ['country', 'nation'],
        labels: ['country', 'nation']
    },
    [CanonicalFieldType.RemotePreference]: {
        attributes: ['remote', 'remote_only', 'remoteonly', 'is_remote', 'fully_remote'],
        labels: ['remote', 'remote only', 'fully remote', 'work remotely', 'work from home']
    },
    [CanonicalFieldType.RelocationWillingness]: {
        attributes: ['relocation', 'relocate', 'willing_to_relocate', 'relocation_ok', 'move'],
        labels: ['relocation', 'relocate', 'open to relocating', 'willing to relocate', 'prefer not to relocate', 'no relocation']
    },
    [CanonicalFieldType.FreeText]: {
        attributes: ['summary', 'about', 'overview', 'bio'],
        labels: ['summary', 'about', 'short summary', 'bio', 'tell us about', 'describe']
    },
};

function normalize(str: string): string {
    return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function containsKeyword(text: string, keywords: string[]): boolean {
    if (!text) return false;
    const normalizedText = text.toLowerCase();
    return keywords.some(kw => normalizedText.includes(kw));
}

function looksLikePhone(text: string): boolean {
    if (!text) return false;
    const normalized = text.replace(/[\s()+\-\.]/g, '');
    return /\d{6,}/.test(normalized);
}

export function scoreCandidate(candidate: FormFieldCandidate, type: CanonicalFieldType): number {
    let score = 0;
    const dict = SYNONYMS[type];
    if (!dict) return 0;

    const normName = normalize(candidate.nameAttr || '');
    const normId = normalize(candidate.idAttr || '');
    const normLabel = (candidate.labelText || '').toLowerCase();
    const normPlaceholder = (candidate.placeholder || '').toLowerCase();
    const normAria = (candidate.ariaLabel || '').toLowerCase();
    const normLabelledBy = (candidate.ariaLabelledByText || '').toLowerCase();
    const normSurrounding = (candidate.surroundingText || '').toLowerCase();
    const aggregate = `${normLabel} ${normPlaceholder} ${normAria} ${normLabelledBy} ${normSurrounding}`;
    const role = (candidate.role || '').toLowerCase();

    // 1. Exact/Strong Attribute Match (Highest Weight)
    // Check name, id, autocomplete
    if (dict.attributes.some(attr => normName === normalize(attr) || normId === normalize(attr))) {
        score += 50;
    }
    if (candidate.autocompleteAttr && dict.attributes.some(attr => candidate.autocompleteAttr!.includes(attr))) {
        score += 60; // Autocomplete is very strong signal
    }

    // 2. Label/Placeholder Match (Medium Weight)
    if (containsKeyword(normLabel, dict.labels)) {
        score += 40;
    }
    if (containsKeyword(normPlaceholder || aggregate, dict.labels)) {
        score += 30;
    }
    if (containsKeyword(normAria || aggregate, dict.labels)) {
        score += 35;
    }
    if (containsKeyword(normLabelledBy || aggregate, dict.labels)) {
        score += 35;
    }

    // 3. Type-Specific Boosts
    if (type === CanonicalFieldType.Email && candidate.inputType === 'email') score += 30;
    if (type === CanonicalFieldType.Phone) {
        if (candidate.inputType === 'tel') score += 60;
        if (looksLikePhone(normPlaceholder) || looksLikePhone(normLabel)) score += 25;
        if (normName.includes('tel')) score += 30;
    }
    if (type === CanonicalFieldType.Resume && candidate.inputType === 'file') score += 60;
    if (type === CanonicalFieldType.CoverLetter && candidate.tagName === 'textarea') score += 20;
    if (type === CanonicalFieldType.FreeText && (candidate.tagName === 'textarea' || role === 'textbox')) {
        score += 25;
    }
    if ((type === CanonicalFieldType.RemotePreference || type === CanonicalFieldType.RelocationWillingness) &&
        (candidate.inputType === 'checkbox' || candidate.inputType === 'radio' || role === 'radio')) {
        score += 35;
    }

    // 4. Negative Signals (Sanity Checks)
    // e.g. if looking for email but type is 'tel', punish heavily
    if (type === CanonicalFieldType.Email && candidate.inputType === 'tel') score -= 100;
    if (type === CanonicalFieldType.Phone && candidate.inputType === 'email') score -= 100;
    if (type === CanonicalFieldType.City && aggregate.includes('country')) score -= 80;
    if (type === CanonicalFieldType.Country && aggregate.includes('city')) score -= 80;

    return score;
}
