// File: src/content/formScanner.ts

export type FieldType =
    | 'first_name' | 'last_name' | 'full_name' | 'email' | 'phone'
    | 'linkedin' | 'github' | 'portfolio'
    | 'cover_letter' | 'summary'
    | 'salary_expectation' | 'currency' | 'relocation' | 'remote' | 'notice_period'
    | 'visa' | 'education' | 'experience'
    | 'resume_upload' | 'terms' | 'unknown';

export interface FormFieldDescriptor {
    element: HTMLElement;
    id: string;
    name: string;
    type: string;
    label: string;
    predictedType: FieldType;
    strategy: FillingStrategy;
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

// --- Strategy Pattern ---

interface FillingStrategy {
    fill(element: HTMLElement, value: any): void;
}

class TextStrategy implements FillingStrategy {
    fill(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
        setNativeValue(element, value);
        element.value = value; // Fallback
        dispatchEvents(element);
    }
}

class CheckboxStrategy implements FillingStrategy {
    fill(element: HTMLInputElement, value: boolean) {
        if (element.checked !== value) {
            element.click(); // Click often triggers more reliable events than setting checked
            if (element.checked !== value) {
                element.checked = value;
                dispatchEvents(element);
            }
        }
    }
}

class RadioStrategy implements FillingStrategy {
    fill(element: HTMLInputElement, _value: string) {
        // For radio buttons, we often need to find the group and select the right one.
        // However, the descriptor points to a specific element.
        // If the value matches the label of this radio, click it.
        // This logic might need to be handled at a higher level or the strategy needs to be smarter.
        // For now, assuming 'value' is a boolean "should check" or we are iterating groups.

        // Better approach: The 'value' passed here should be the value we want to select.
        // If this radio button's value or label matches, check it.

        // But typically we scan all inputs.
        // Let's assume the caller filters for the correct radio button before calling fill,
        // OR we just click it if it's the right one.

        // Simplification: Just click it.
        element.click();
        element.checked = true;
        dispatchEvents(element);
    }
}

class SelectStrategy implements FillingStrategy {
    fill(element: HTMLSelectElement, value: string) {
        setNativeValue(element, value);
        element.value = value;
        dispatchEvents(element);
    }
}

class FileStrategy implements FillingStrategy {
    fill(element: HTMLInputElement, value: File) {
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(value);
        element.files = dataTransfer.files;
        dispatchEvents(element);
    }
}

// --- Scanning Logic (Shadow DOM Support) ---

function getLabelText(element: HTMLElement): string {
    let labelText = '';

    // 1. Check for <label for="id">
    if (element.id) {
        // We need to search the entire document or the same shadow root
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

    return labelText.toLowerCase().trim();
}

function predictFieldType(element: HTMLElement, label: string): FieldType {
    const name = element.getAttribute('name')?.toLowerCase() || '';
    const id = element.id.toLowerCase();
    const type = element.getAttribute('type')?.toLowerCase() || '';
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


    return 'unknown';
}

function determineStrategy(element: HTMLElement): FillingStrategy {
    if (element instanceof HTMLInputElement) {
        if (element.type === 'checkbox') return new CheckboxStrategy();
        if (element.type === 'radio') return new RadioStrategy();
        if (element.type === 'file') return new FileStrategy();
    }
    if (element instanceof HTMLSelectElement) return new SelectStrategy();
    return new TextStrategy();
}

function scanElement(root: Element | ShadowRoot | Document): FormFieldDescriptor[] {
    const descriptors: FormFieldDescriptor[] = [];

    // Get all potential inputs in this root
    const inputs = Array.from(root.querySelectorAll('input, textarea, select')) as HTMLElement[];

    for (const el of inputs) {
        // Skip hidden inputs or submit buttons
        if (el instanceof HTMLInputElement && (el.type === 'hidden' || el.type === 'submit' || el.type === 'button')) continue;

        // Skip if not visible (simple check)
        // Note: offsetParent might be null in some valid cases inside shadow DOM or iframes depending on context,
        // but it's a decent heuristic for now.
        if (el instanceof HTMLElement && el.offsetParent === null) continue;

        const label = getLabelText(el);
        const predictedType = predictFieldType(el, label);
        const strategy = determineStrategy(el);

        descriptors.push({
            element: el,
            id: el.id,
            name: el.getAttribute('name') || '',
            type: el.getAttribute('type') || el.tagName.toLowerCase(),
            label,
            predictedType,
            strategy
        });
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
    descriptor.strategy.fill(descriptor.element, value);
}
