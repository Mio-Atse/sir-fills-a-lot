// File: src/content/formScanner.ts

export type FieldType =
    | 'first_name' | 'last_name' | 'full_name' | 'email' | 'phone'
    | 'linkedin' | 'github' | 'portfolio'
    | 'cover_letter' | 'summary'
    | 'salary_expectation' | 'currency' | 'relocation' | 'remote' | 'notice_period'
    | 'visa' | 'education' | 'experience' | 'preferred_roles'
    | 'resume_upload' | 'terms' | 'long_text' | 'unknown';

export type ControlType =
    | 'text'
    | 'textarea'
    | 'select'
    | 'multi-select'
    | 'radio'
    | 'checkbox'
    | 'file'
    | 'custom-select';

export interface FormFieldOption {
    value: string;
    label: string;
    selected?: boolean;
}

export interface FormFieldDescriptor {
    element: HTMLElement;
    id: string;
    name: string;
    type: string;
    label: string;
    predictedType: FieldType;
    controlType: ControlType;
    options?: FormFieldOption[];
    strategy: FillingStrategy;
    group?: HTMLElement[]; // For radio/checkbox groups
}
// --- Event Dispatching Helper (React/Angular Support) ---

function setNativeValue(element: HTMLElement, value: string) {
    const valueSetter = Object.getOwnPropertyDescriptor(element, 'value')?.set;
    const prototype = Object.getPrototypeOf(element);
    const prototypeValueSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;

    if (valueSetter && valueSetter !== prototypeValueSetter) {
        prototypeValueSetter?.call(element, value);
    } else {
        valueSetter?.call(element, value);
    }
}

function dispatchEvents(element: HTMLElement) {
    element.dispatchEvent(new Event('focus', { bubbles: true }));
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    element.dispatchEvent(new Event('blur', { bubbles: true }));
}

function ensureElementVisible(element: HTMLElement) {
    const rect = element.getBoundingClientRect();
    const fullyVisible =
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
        rect.right <= (window.innerWidth || document.documentElement.clientWidth);

    if (!fullyVisible) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    }
}
// --- Strategy Pattern ---

// --- Strategy Pattern ---

interface FillingStrategy {
    fill(descriptor: FormFieldDescriptor, value: any): void;
}

class TextStrategy implements FillingStrategy {
    fill(descriptor: FormFieldDescriptor, value: string) {
        const element = descriptor.element as HTMLInputElement | HTMLTextAreaElement;
        ensureElementVisible(element);
        // 1. Focus
        element.focus();

        // 2. Set value using native setter to bypass React/Angular tracking
        setNativeValue(element, value);
        element.value = value; // Fallback

        // 3. Dispatch events
        dispatchEvents(element);
    }
}

class CheckboxStrategy implements FillingStrategy {
    fill(descriptor: FormFieldDescriptor, value: boolean | string | string[]) {
        const element = descriptor.element as HTMLInputElement;
        ensureElementVisible(element);

        // Handle Array of values (for checkbox groups)
        if (Array.isArray(value)) {
            const group = descriptor.group || [element];
            const targets = value.map(v => v.toLowerCase());

            for (const checkbox of group) {
                const cb = checkbox as HTMLInputElement;
                const label = getLabelText(cb);
                const val = cb.value.toLowerCase();

                // Check if this checkbox matches ANY of the target values
                const matches = targets.some(t => val === t || label.includes(t));

                if (cb.checked !== matches) {
                    ensureElementVisible(cb);
                    cb.click();
                    if (cb.checked !== matches) {
                        cb.checked = matches;
                        dispatchEvents(cb);
                    }
                }
            }
            return;
        }

        // Handle Single Value
        let shouldCheck = value === true;
        if (typeof value === 'string') {
            const lower = value.toLowerCase();
            shouldCheck = lower === 'true' || lower === 'yes' || lower === '1';
        }

        if (element.checked !== shouldCheck) {
            element.click();
            if (element.checked !== shouldCheck) {
                element.checked = shouldCheck;
                dispatchEvents(element);
            }
        }
    }
}

class RadioStrategy implements FillingStrategy {
    fill(descriptor: FormFieldDescriptor, value: string) {
        const element = descriptor.element as HTMLInputElement;
        const name = element.name;
        ensureElementVisible(element);

        // Use cached group if available, otherwise query
        const radios = (descriptor.group as HTMLInputElement[]) ||
            (name ? Array.from(document.querySelectorAll(`input[type="radio"][name="${name}"]`)) : [element]);

        let bestMatch: HTMLInputElement | null = null;

        for (const radio of radios) {
            if (this.matches(radio, value)) {
                bestMatch = radio;
                break;
            }
        }

        if (bestMatch) {
            this.clickRadio(bestMatch);
        } else {
            console.warn(`No matching radio found for group '${name}' with value '${value}'`);
        }
    }

    private matches(radio: HTMLInputElement, targetValue: string | boolean | number | null | undefined): boolean {
        if (targetValue === null || targetValue === undefined) return false;
        const target = String(targetValue).toLowerCase();

        if (radio.value.toLowerCase() === target) return true;

        const label = getLabelText(radio);
        if (label.includes(target)) return true;

        if (target === 'yes' && (radio.value.toLowerCase() === 'true' || label.includes('yes'))) return true;
        if (target === 'no' && (radio.value.toLowerCase() === 'false' || label.includes('no'))) return true;

        return false;
    }

    private clickRadio(radio: HTMLInputElement) {
        if (!radio.checked) {
            radio.click();
            if (!radio.checked) {
                radio.checked = true;
                dispatchEvents(radio);
            }
        }
    }
}

class SelectStrategy implements FillingStrategy {
    fill(descriptor: FormFieldDescriptor, value: string) {
        const element = descriptor.element;
        if (value === undefined || value === null) return;
        const normalizedTargets = Array.isArray(value)
            ? value.map(v => v.toString().toLowerCase())
            : [value.toString().toLowerCase()];

        ensureElementVisible(element);

        if (element instanceof HTMLSelectElement) {
            if (element.multiple && Array.isArray(value)) {
                let matched = false;
                for (const option of Array.from(element.options)) {
                    const optValue = option.value.toLowerCase();
                    const optText = option.text.toLowerCase();
                    const shouldSelect = normalizedTargets.some(t =>
                        t === optValue || t === optText || optText.includes(t) || t.includes(optText)
                    );
                    option.selected = shouldSelect;
                    matched = matched || shouldSelect;
                }
                if (matched) {
                    dispatchEvents(element);
                }
                return;
            }

            const target = normalizedTargets[0];
            let bestOption: HTMLOptionElement | null = null;

            for (const option of Array.from(element.options)) {
                const optValue = option.value.toLowerCase();
                const optText = option.text.toLowerCase();

                if (optValue === target || optText === target) {
                    bestOption = option;
                    break;
                }

                if (optText.includes(target) || target.includes(optText)) {
                    bestOption = option;
                }
            }

            if (bestOption) {
                setNativeValue(element, bestOption.value);
                element.value = bestOption.value;
                dispatchEvents(element);
            } else {
                console.warn(`Option '${value}' not found in select '${element.name || element.id}'`);
            }
            return;
        }

        // Custom select/listbox widgets. Try a best-effort click strategy.
        element.dispatchEvent(new MouseEvent('click', { bubbles: true }));

        const optionCandidates = findOptionsForElement(element, descriptor.options);
        const matchingOption = optionCandidates.find(opt => {
            const optionValue = (opt.getAttribute('data-value') || opt.getAttribute('value') || opt.textContent || '').toLowerCase().trim();
            const optionLabel = (opt.getAttribute('aria-label') || opt.textContent || '').toLowerCase().trim();
            return normalizedTargets.some(t => optionValue === t || optionLabel === t || optionLabel.includes(t) || t.includes(optionLabel));
        });

        if (matchingOption) {
            ensureElementVisible(matchingOption);
            (matchingOption as HTMLElement).dispatchEvent(new MouseEvent('click', { bubbles: true }));
            dispatchEvents(element);
        } else {
            console.warn(`No matching option found in custom select for value '${value}'`);
        }
    }
}

class FileStrategy implements FillingStrategy {
    fill(descriptor: FormFieldDescriptor, value: File) {
        const element = descriptor.element as HTMLInputElement;
        if (!(value instanceof File)) {
            console.error('FileStrategy received non-File value:', value);
            return;
        }

        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(value);
        element.files = dataTransfer.files;

        element.dispatchEvent(new Event('change', { bubbles: true }));
        element.dispatchEvent(new Event('input', { bubbles: true }));
    }
}

function findOptionsForElement(element: HTMLElement, describedOptions?: FormFieldOption[]): HTMLElement[] {
    const optionSelectors = ['[role="option"]', '[data-value]', 'option', 'li'];
    let options = Array.from(element.querySelectorAll<HTMLElement>(optionSelectors.join(',')));

    // aria-controls / aria-owns often point to the popup list for custom selects
    if (!options.length) {
        const listId = element.getAttribute('aria-controls') || element.getAttribute('aria-owns');
        if (listId) {
            const popup = element.ownerDocument.getElementById(listId);
            if (popup) {
                options = Array.from(popup.querySelectorAll<HTMLElement>(optionSelectors.join(',')));
            }
        }
    }

    // If we captured static option metadata during scanning, try to re-query by label text
    if (!options.length && describedOptions?.length) {
        const labels = describedOptions.map(o => o.label.toLowerCase());
        const textNodes = Array.from(document.querySelectorAll<HTMLElement>('*')).filter(el => {
            const text = (el.textContent || '').toLowerCase().trim();
            return labels.includes(text);
        });
        if (textNodes.length) options = textNodes;
    }

    return options;
}

function isElementVisible(el: HTMLElement): boolean {
    const view = el.ownerDocument.defaultView || window;
    const style = view.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
}

// --- Scanning Logic (Shadow DOM Support) ---

function getLabelText(element: HTMLElement): string {
    let labelText = '';

    // 1. Check for <label for="id">
    if (element.id) {
        const root = element.getRootNode() as Document | ShadowRoot;
        const label = root.querySelector(`label[for="${element.id}"]`);
        if (label) labelText += label.textContent || '';
    }

    // 2. Check for parent <label>
    const parentLabel = element.closest('label');
    if (parentLabel) labelText += parentLabel.textContent || '';

    // 3. Check aria-label
    const ariaLabel = element.getAttribute('aria-label');
    if (ariaLabel) labelText += ariaLabel;

    // 4. Check placeholder
    const placeholder = element.getAttribute('placeholder');
    if (placeholder) labelText += placeholder;

    // 5. Check for fieldset legend if inside one (common for groups)
    const fieldset = element.closest('fieldset');
    if (fieldset) {
        const legend = fieldset.querySelector('legend');
        if (legend) labelText += ' ' + legend.textContent;
    }

    // 6. Check for aria-labelledby
    const ariaLabelledBy = element.getAttribute('aria-labelledby');
    if (ariaLabelledBy) {
        const root = element.getRootNode() as Document | ShadowRoot;
        const ids = ariaLabelledBy.split(' ');
        for (const id of ids) {
            const labelEl = root.getElementById(id);
            if (labelEl) labelText += ' ' + (labelEl.textContent || '');
        }
    }

    return labelText.toLowerCase().trim();
}

function predictFieldType(element: HTMLElement, label: string): FieldType {
    const name = element.getAttribute('name')?.toLowerCase() || '';
    const id = element.id.toLowerCase();
    const type = element.getAttribute('type')?.toLowerCase() || '';
    const tagName = element.tagName.toLowerCase();
    const combined = `${name} ${id} ${label}`;

    // Resume Upload
    if (type === 'file' || combined.includes('resume') || combined.includes('cv') || combined.includes('upload')) {
        if (type === 'file' || combined.includes('file')) return 'resume_upload';
    }

    // Terms & Conditions
    if (type === 'checkbox' && (combined.includes('term') || combined.includes('condition') || combined.includes('privacy') || combined.includes('agree'))) {
        return 'terms';
    }

    if (combined.includes('first') && combined.includes('name')) return 'first_name';
    if (combined.includes('last') && combined.includes('name')) return 'last_name';
    if (combined.includes('full name') || combined.includes('fullname')) return 'full_name';
    if (combined.includes('email') || combined.includes('e-mail')) return 'email';
    if (combined.includes('phone') || combined.includes('mobile') || combined.includes('cell')) return 'phone';
    if (combined.includes('linkedin')) return 'linkedin';
    if (combined.includes('github') || combined.includes('git')) return 'github';
    if (combined.includes('portfolio') || combined.includes('website') || combined.includes('url')) return 'portfolio';

    if (combined.includes('cover') && combined.includes('letter')) return 'cover_letter';
    if (combined.includes('summary') || combined.includes('about you') || combined.includes('bio')) return 'summary';

    if (combined.includes('salary') || combined.includes('compensation') || combined.includes('pay') || combined.includes('expectation')) return 'salary_expectation';
    if (combined.includes('currency')) return 'currency';
    if (combined.includes('relocat')) return 'relocation';
    if (combined.includes('remote')) return 'remote';
    if (combined.includes('notice') || combined.includes('period')) return 'notice_period';
    if (combined.includes('visa') || combined.includes('sponsorship') || combined.includes('authorization')) return 'visa';
    if (combined.includes('education') || combined.includes('university') || combined.includes('school') || combined.includes('degree')) return 'education';
    if (combined.includes('experience') || combined.includes('work') || combined.includes('job')) return 'experience';

    if (combined.includes('role') || combined.includes('position') || combined.includes('interested in') || combined.includes('job type')) return 'preferred_roles';

    // Long Text Detection (for LLM)
    if (tagName === 'textarea' || (tagName === 'input' && type === 'text' && (combined.includes('describe') || combined.includes('explain') || combined.includes('why') || combined.includes('tell us')))) {
        return 'long_text';
    }

    return 'unknown';
}

function determineStrategy(_element: HTMLElement, controlType: ControlType): FillingStrategy {
    if (controlType === 'checkbox') return new CheckboxStrategy();
    if (controlType === 'radio') return new RadioStrategy();
    if (controlType === 'file') return new FileStrategy();
    if (controlType === 'select' || controlType === 'multi-select' || controlType === 'custom-select') return new SelectStrategy();
    return new TextStrategy();
}

function inferControlType(element: HTMLElement, typeAttr?: string): ControlType {
    if (element instanceof HTMLTextAreaElement) return 'textarea';
    if (element instanceof HTMLSelectElement) return element.multiple ? 'multi-select' : 'select';
    if (element instanceof HTMLInputElement) {
        const type = (typeAttr || element.type || '').toLowerCase();
        if (type === 'checkbox') return 'checkbox';
        if (type === 'radio') return 'radio';
        if (type === 'file') return 'file';
        return 'text';
    }

    const role = (element.getAttribute('role') || '').toLowerCase();
    const multi = element.getAttribute('aria-multiselectable') === 'true';
    if (role === 'combobox' || role === 'listbox') return multi ? 'multi-select' : 'custom-select';
    if (role === 'textbox') return 'text';
    return 'text';
}

function collectOptionsFromSelect(select: HTMLSelectElement): FormFieldOption[] {
    return Array.from(select.options).map(opt => ({
        value: opt.value || opt.text,
        label: (opt.text || opt.value || '').trim(),
        selected: opt.selected,
    }));
}

function collectOptionsFromGroup(group: HTMLElement[]): FormFieldOption[] {
    return group.map((el, index) => {
        const rawLabel = (el.getAttribute('aria-label') || el.textContent || '').trim();
        const fallbackLabel = getLabelText(el) || (el.getAttribute('value') || `Option ${index + 1}`);
        const label = rawLabel || fallbackLabel;
        const value = (el as HTMLInputElement).value || label || `option-${index + 1}`;
        return {
            value,
            label,
            selected: (el as HTMLInputElement).checked || el.getAttribute('aria-checked') === 'true',
        };
    });
}

function collectOptionsFromCustomSelect(element: HTMLElement): FormFieldOption[] | undefined {
    const options = findOptionsForElement(element);
    if (!options.length) return undefined;

    return options.map((opt, index) => {
        const label = (opt.getAttribute('aria-label') || opt.textContent || `Option ${index + 1}`).trim();
        const value = (opt.getAttribute('data-value') || opt.getAttribute('value') || label || `option-${index + 1}`).trim();
        const selected = opt.getAttribute('aria-selected') === 'true' || opt.classList.contains('selected') || opt.getAttribute('aria-checked') === 'true';
        return { value, label, selected };
    });
}

function collectOptionsForElement(element: HTMLElement, controlType: ControlType, group?: HTMLElement[]): FormFieldOption[] | undefined {
    if (controlType === 'select' || controlType === 'multi-select') {
        if (element instanceof HTMLSelectElement) return collectOptionsFromSelect(element);
        return collectOptionsFromCustomSelect(element);
    }

    if (controlType === 'radio' || controlType === 'checkbox') {
        if (group && group.length > 0) return collectOptionsFromGroup(group);
        return collectOptionsFromGroup([element]);
    }

    return undefined;
}

function getCandidateElements(root: Element | ShadowRoot | Document): HTMLElement[] {
    const base = Array.from(root.querySelectorAll<HTMLElement>('input, textarea, select'));
    const ariaInputs = Array.from(root.querySelectorAll<HTMLElement>('[role="textbox"], [role="combobox"], [role="listbox"], [aria-haspopup="listbox"], [data-select], [data-testid*="select"]'));
    const merged = [...base, ...ariaInputs];
    const unique: HTMLElement[] = [];
    const seen = new Set<HTMLElement>();

    merged.forEach(el => {
        if (!seen.has(el)) {
            seen.add(el);
            unique.push(el);
        }
    });

    return unique;
}

function scanElement(root: Element | ShadowRoot | Document): FormFieldDescriptor[] {
    const descriptors: FormFieldDescriptor[] = [];
    const processedNames = new Set<string>();

    // Get all potential inputs in this root
    const inputs = getCandidateElements(root);

    for (const el of inputs) {
        // Skip hidden inputs or submit buttons
        if (el instanceof HTMLInputElement && (el.type === 'hidden' || el.type === 'submit' || el.type === 'button')) continue;

        // Skip if not visible (simple check)
        if (el instanceof HTMLElement && !isElementVisible(el)) continue;

        const name = el.getAttribute('name');
        const type = el.getAttribute('type') || el.tagName.toLowerCase();
        const controlType = inferControlType(el, type);

        // Grouping Logic for Radio and Checkbox
        if (name && (type === 'radio' || type === 'checkbox')) {
            const groupKey = `${name}:${controlType}`;
            if (processedNames.has(groupKey)) continue; // Already processed this group
            processedNames.add(groupKey);

            // Find all elements in this group
            const groupElements = inputs.filter(i => i.getAttribute('name') === name && inferControlType(i) === controlType);

            // Use the first element as the representative, but aggregate labels?
            // Or better, find a common label (like fieldset legend)
            const representative = groupElements[0];
            let label = getLabelText(representative);

            // Try to find a common label if individual label is weak
            if (groupElements.length > 1) {
                // Check for a common container with a label
                const commonParent = representative.parentElement?.parentElement;
                if (commonParent) {
                    // This is a heuristic, might need refinement
                    const parentLabel = commonParent.querySelector('label, legend, .label, .question-label');
                    if (parentLabel && !groupElements.includes(parentLabel as HTMLElement)) {
                        // Append parent label if it seems relevant and not already included
                        const pText = parentLabel.textContent || '';
                        if (!label.includes(pText.toLowerCase())) {
                            label = pText + ' ' + label;
                        }
                    }
                }
            }

            const predictedType = predictFieldType(representative, label);
            const strategy = determineStrategy(representative, controlType);
            const options = collectOptionsForElement(representative, controlType, groupElements);

            descriptors.push({
                element: representative,
                id: representative.id,
                name: name,
                type: type,
                label: label,
                predictedType,
                controlType,
                options,
                strategy,
                group: groupElements
            });
        } else {
            // Standard processing for other fields
            const label = getLabelText(el);
            const predictedType = predictFieldType(el, label);
            const strategy = determineStrategy(el, controlType);
            const options = collectOptionsForElement(el, controlType);

            descriptors.push({
                element: el,
                id: el.id,
                name: name || '',
                type: type,
                label,
                predictedType,
                controlType,
                options,
                strategy
            });
        }
    }

    // Recursively scan shadow roots
    const allElements = Array.from(root.querySelectorAll('*'));
    for (const el of allElements) {
        if (el.shadowRoot) {
            descriptors.push(...scanElement(el.shadowRoot));
        }
    }

    return descriptors;
}

export function scanForm(): FormFieldDescriptor[] {
    return scanElement(document);
}

export function fillField(descriptor: FormFieldDescriptor, value: any) {
    ensureElementVisible(descriptor.element);
    descriptor.strategy.fill(descriptor, value);
}

// --- Multi-Step Navigation Helper ---

export function findNextButton(): HTMLElement | null {
    const buttons = Array.from(document.querySelectorAll('button, input[type="submit"], input[type="button"]')) as HTMLElement[];

    for (const btn of buttons) {
        const text = (btn.innerText || (btn as HTMLInputElement).value || '').toLowerCase();
        const aria = (btn.getAttribute('aria-label') || '').toLowerCase();

        // Keywords for next button
        if (
            text.includes('next') ||
            text.includes('continue') ||
            text.includes('proceed') ||
            aria.includes('next') ||
            text === 'save and continue'
        ) {
            // Avoid "Submit" or "Finish" if possible, unless it's the only option?
            // Actually, if it says "Submit Application", it's probably the end.
            if (text.includes('submit') || text.includes('finish')) continue;

            // Check visibility
            if (btn.offsetParent !== null && !(btn as HTMLButtonElement).disabled) {
                ensureElementVisible(btn);
                return btn;
            }
        }
    }
    return null;
}
