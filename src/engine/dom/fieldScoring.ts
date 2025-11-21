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
        attributes: ['resume', 'cv', 'curriculum_vitae', 'file', 'upload'],
        labels: ['resume', 'cv', 'curriculum vitae', 'upload resume']
    },
    [CanonicalFieldType.CoverLetter]: {
        attributes: ['coverletter', 'cover_letter', 'letter'],
        labels: ['cover letter', 'add a cover letter']
    },
    [CanonicalFieldType.City]: {
        attributes: ['city', 'town'],
        labels: ['city', 'town']
    },
    [CanonicalFieldType.Country]: {
        attributes: ['country', 'nation'],
        labels: ['country', 'nation']
    },
    // Add more as needed
};

function normalize(str: string): string {
    return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function containsKeyword(text: string, keywords: string[]): boolean {
    if (!text) return false;
    const normalizedText = text.toLowerCase();
    return keywords.some(kw => normalizedText.includes(kw));
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
    if (containsKeyword(normPlaceholder, dict.labels)) {
        score += 30;
    }
    if (containsKeyword(normAria, dict.labels)) {
        score += 35;
    }

    // 3. Type-Specific Boosts
    if (type === CanonicalFieldType.Email && candidate.inputType === 'email') score += 20;
    if (type === CanonicalFieldType.Phone && candidate.inputType === 'tel') score += 20;
    if (type === CanonicalFieldType.Resume && candidate.inputType === 'file') score += 20;

    // 4. Negative Signals (Sanity Checks)
    // e.g. if looking for email but type is 'tel', punish heavily
    if (type === CanonicalFieldType.Email && candidate.inputType === 'tel') score -= 100;
    if (type === CanonicalFieldType.Phone && candidate.inputType === 'email') score -= 100;

    return score;
}
