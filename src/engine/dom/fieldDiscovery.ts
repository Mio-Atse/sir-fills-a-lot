export interface FormFieldCandidate {
    element: HTMLElement;
    tagName: string;
    inputType?: string;        // from type attribute
    role?: string;             // aria role, e.g., textbox, listbox, radio
    nameAttr?: string;
    idAttr?: string;
    classes: string[];
    ariaLabel?: string;
    ariaLabelledByText?: string; // resolved text from aria-labelledby
    placeholder?: string;
    labelText?: string;          // nearest <label> text or ancestor label
    surroundingText?: string;    // nearby text nodes, fieldset legends, etc.
    options?: { text: string; value: string }[]; // for selects or role=listbox
    isContentEditable?: boolean;
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
    const root = element.getRootNode() as Document | ShadowRoot;

    // 1. Check for explicit <label for="id">
    if (element.id) {
        const label = root.querySelector?.(`label[for="${CSS.escape(element.id)}"]`);
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
            const labelEl = root.getElementById?.(id) as HTMLElement | null;
            if (labelEl) labelText += ' ' + (labelEl.textContent || '');
        });
    }

    // 4. Fieldset legends (for grouped controls)
    const fieldset = element.closest('fieldset');
    if (fieldset) {
        const legend = fieldset.querySelector('legend');
        if (legend) labelText += ' ' + (legend.textContent || '');
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

function collectAriaLabelledByText(element: HTMLElement): string | undefined {
    const ids = element.getAttribute('aria-labelledby')?.split(/\s+/).filter(Boolean);
    if (!ids || ids.length === 0) return undefined;
    const parts: string[] = [];
    const root = element.getRootNode() as Document | ShadowRoot;
    ids.forEach(id => {
        const el = (root as Document | ShadowRoot).getElementById?.(id) as HTMLElement | null;
        if (el) parts.push(el.textContent || '');
    });
    const result = parts.join(' ').trim();
    return result || undefined;
}

function buildOptions(element: HTMLElement): { text: string; value: string }[] | undefined {
    if (element instanceof HTMLSelectElement) {
        return Array.from(element.options).map(opt => ({
            text: opt.text || opt.value,
            value: opt.value || opt.text
        }));
    }
    if (element.getAttribute('role') === 'listbox') {
        const options = Array.from(element.querySelectorAll('[role="option"]')) as HTMLElement[];
        return options.map((opt, idx) => ({
            text: (opt.textContent || '').trim(),
            value: opt.getAttribute('data-value') || opt.getAttribute('value') || `${idx}`
        }));
    }
    return undefined;
}

export function scanForCandidates(root: HTMLElement | Document | ShadowRoot = document): FormFieldCandidate[] {
    const candidates: FormFieldCandidate[] = [];
    const visitedRoots = new Set<Node>();

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
        '[contenteditable="true"]'
    ];

    const walk = (currentRoot: HTMLElement | Document | ShadowRoot) => {
        if (visitedRoots.has(currentRoot)) return;
        visitedRoots.add(currentRoot);

        const elements = (currentRoot as ParentNode).querySelectorAll?.(selectors.join(',')) || [];

        elements.forEach((el) => {
            const element = el as HTMLElement;

            // Basic visibility check
            if (!isVisible(element)) return;

            // Honeypot check (simple)
            if (element.getAttribute('aria-hidden') === 'true') return;
            if (element.getAttribute('tabindex') === '-1') return; // Often hidden/non-interactive

            const role = element.getAttribute('role') || undefined;
            const isContentEditable = element.isContentEditable;

            const candidate: FormFieldCandidate = {
                element,
                tagName: element.tagName.toLowerCase(),
                inputType: element.getAttribute('type') || undefined,
                role,
                isContentEditable,
                nameAttr: element.getAttribute('name') || undefined,
                idAttr: element.getAttribute('id') || undefined,
                classes: Array.from(element.classList),
                ariaLabel: element.getAttribute('aria-label') || undefined,
                ariaLabelledByText: collectAriaLabelledByText(element),
                placeholder: element.getAttribute('placeholder') || undefined,
                labelText: getLabelText(element),
                surroundingText: getSurroundingText(element),
                options: buildOptions(element),
                autocompleteAttr: element.getAttribute('autocomplete') || undefined,
                isVisible: true,
                isRequired: element.hasAttribute('required') || element.getAttribute('aria-required') === 'true'
            };

            candidates.push(candidate);
        });

        // Handle Iframes (Same Origin)
        const iframes = (currentRoot as ParentNode).querySelectorAll?.('iframe') || [];
        iframes.forEach(iframe => {
            const frame = iframe as HTMLIFrameElement;
            try {
                const doc = frame.contentDocument;
                if (doc?.body) {
                    walk(doc);
                }
            } catch {
                // Cross-origin iframe, skip
            }
        });

        // Traverse Shadow DOMs
        const allElements = (currentRoot as ParentNode).querySelectorAll?.('*') || [];
        allElements.forEach(el => {
            const shadow = (el as HTMLElement).shadowRoot;
            if (shadow) {
                walk(shadow);
            }
        });
    };

    walk(root);

    return candidates;
}
