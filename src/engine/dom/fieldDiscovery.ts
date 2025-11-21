export interface FormFieldCandidate {
    element: HTMLElement;
    tagName: string;
    inputType?: string;        // from type attribute
    nameAttr?: string;
    idAttr?: string;
    classes: string[];
    ariaLabel?: string;
    ariaLabelledByText?: string; // resolved text from aria-labelledby
    placeholder?: string;
    labelText?: string;          // nearest <label> text or ancestor label
    surroundingText?: string;    // nearby text nodes, fieldset legends, etc.
    autocompleteAttr?: string;
    isVisible: boolean;          // computed via getBoundingClientRect + style checks
    isRequired: boolean;         // required attr or aria-required
}

function isVisible(element: HTMLElement): boolean {
    if (!element) return false;
    const style = window.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
}

function getLabelText(element: HTMLElement): string {
    let labelText = '';

    // 1. Check for explicit <label for="id">
    if (element.id) {
        const label = document.querySelector(`label[for="${CSS.escape(element.id)}"]`);
        if (label) labelText += label.textContent || '';
    }

    // 2. Check for ancestor <label>
    const parentLabel = element.closest('label');
    if (parentLabel) {
        // Clone and remove the input itself to get just the text
        const clone = parentLabel.cloneNode(true) as HTMLElement;
        const inputInClone = clone.querySelector(element.tagName);
        if (inputInClone) inputInClone.remove();
        labelText += clone.textContent || '';
    }

    // 3. Check for aria-labelledby
    const labelledBy = element.getAttribute('aria-labelledby');
    if (labelledBy) {
        const ids = labelledBy.split(/\s+/);
        ids.forEach(id => {
            const labelEl = document.getElementById(id);
            if (labelEl) labelText += ' ' + (labelEl.textContent || '');
        });
    }

    return labelText.trim();
}

function getSurroundingText(element: HTMLElement): string {
    // Look at previous sibling or parent's previous sibling for text
    // This is a heuristic and can be expensive, keeping it simple for now
    let text = '';
    const parent = element.parentElement;
    if (parent) {
        // Get text content of parent but exclude the element's own value/text if possible
        // For now, just grabbing parent text is a decent proxy for "context"
        text += parent.textContent || '';
    }
    return text.replace(/\s+/g, ' ').trim(); // Normalize whitespace
}

export function scanForCandidates(root: HTMLElement | Document = document): FormFieldCandidate[] {
    const candidates: FormFieldCandidate[] = [];

    // Selectors for potential form fields
    const selectors = [
        'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="image"])',
        'textarea',
        'select',
        '[role="textbox"]',
        '[role="listbox"]',
        '[role="combobox"]',
        '[role="checkbox"]',
        '[role="radio"]',
        // Custom "div-based" inputs often used in modern frameworks
        // We might need more specific heuristics for these later
    ];

    const elements = root.querySelectorAll(selectors.join(','));

    elements.forEach((el) => {
        const element = el as HTMLElement;

        // Basic visibility check
        if (!isVisible(element)) return;

        // Honeypot check (simple)
        if (element.getAttribute('aria-hidden') === 'true') return;
        if (element.getAttribute('tabindex') === '-1') return; // Often hidden/non-interactive

        const candidate: FormFieldCandidate = {
            element,
            tagName: element.tagName.toLowerCase(),
            inputType: element.getAttribute('type') || undefined,
            nameAttr: element.getAttribute('name') || undefined,
            idAttr: element.getAttribute('id') || undefined,
            classes: Array.from(element.classList),
            ariaLabel: element.getAttribute('aria-label') || undefined,
            ariaLabelledByText: undefined, // Filled below
            placeholder: element.getAttribute('placeholder') || undefined,
            labelText: getLabelText(element),
            surroundingText: getSurroundingText(element),
            autocompleteAttr: element.getAttribute('autocomplete') || undefined,
            isVisible: true,
            isRequired: element.hasAttribute('required') || element.getAttribute('aria-required') === 'true'
        };

        // Resolve aria-labelledby if present (already done in getLabelText, but maybe we want it separate?)
        // Actually getLabelText combines them. Let's keep it simple.

        candidates.push(candidate);
    });

    // Handle Iframes (Same Origin)
    const iframes = root.querySelectorAll('iframe');
    iframes.forEach(iframe => {
        try {
            const doc = iframe.contentDocument;
            if (doc) {
                const iframeCandidates = scanForCandidates(doc.body);
                candidates.push(...iframeCandidates);
            }
        } catch (e) {
            // Cross-origin iframe, skip
        }
    });

    return candidates;
}
