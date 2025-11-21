import { CanonicalFieldType } from '../profile/canonicalProfile';
import { FormFieldCandidate } from './fieldDiscovery';
import { scoreCandidate } from './fieldScoring';

export type FieldMatchResult = Map<CanonicalFieldType, FormFieldCandidate>;

const MIN_SCORE_THRESHOLD = 40; // Minimum score to consider a match valid

export function matchFields(candidates: FormFieldCandidate[]): FieldMatchResult {
    const result: FieldMatchResult = new Map();
    const usedElements = new Set<HTMLElement>();

    // We iterate through types in a specific order to prioritize "hard" fields
    // e.g. match specific First/Last name before generic Full Name
    const priorityOrder = [
        CanonicalFieldType.Email,
        CanonicalFieldType.Phone,
        CanonicalFieldType.FirstName,
        CanonicalFieldType.LastName,
        CanonicalFieldType.FullName,
        CanonicalFieldType.Resume,
        CanonicalFieldType.CoverLetter,
        CanonicalFieldType.LinkedinUrl,
        CanonicalFieldType.PortfolioUrl,
        CanonicalFieldType.City,
        CanonicalFieldType.Country,
        // ... others
    ];

    for (const type of priorityOrder) {
        let bestCandidate: FormFieldCandidate | null = null;
        let bestScore = -1;

        for (const candidate of candidates) {
            if (usedElements.has(candidate.element)) continue;

            const score = scoreCandidate(candidate, type);
            if (score > bestScore) {
                bestScore = score;
                bestCandidate = candidate;
            }
        }

        if (bestCandidate && bestScore >= MIN_SCORE_THRESHOLD) {
            result.set(type, bestCandidate);
            usedElements.add(bestCandidate.element);
        }
    }

    // Conflict Resolution: Full Name vs First/Last
    // If we have BOTH First AND Last, we probably don't need Full Name (or vice versa)
    // But actually, if we matched them to different elements, it's fine.
    // The priority order handles the "greedy" assignment.
    // Since we match First/Last BEFORE FullName, if we found distinct First/Last fields,
    // they are already marked as 'used'.
    // If there was only one field left and it matched FullName, it gets assigned there.
    // This seems correct for now.

    return result;
}
