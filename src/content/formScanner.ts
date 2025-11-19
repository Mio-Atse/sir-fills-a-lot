// File: src/content/formScanner.ts

export type FieldType =
    | 'first_name' | 'last_name' | 'full_name' | 'email' | 'phone'
    | 'linkedin' | 'github' | 'portfolio'
    | 'cover_letter' | 'summary'
    | 'salary_expectation' | 'currency' | 'relocation' | 'remote' | 'notice_period'
    | 'visa' | 'education' | 'experience'
    | 'resume_upload' | 'terms' | 'unknown';

export interface FormFieldDescriptor {
    element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
    id: string;
    name: string;
    type: string;
    label: string;
    predictedType: FieldType;
}

function getLabelText(element: HTMLElement): string {
    let labelText = '';

    // 1. Check for <label for="id">
    if (element.id) {
        const label = document.querySelector(`label[for="${element.id}"]`);
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
    if (combined.includes('notice')) return 'notice_period';
    if (combined.includes('visa') || combined.includes('sponsorship') || combined.includes('authorization')) return 'visa';

    return 'unknown';
}

export function scanForm(): FormFieldDescriptor[] {
    const inputs = Array.from(document.querySelectorAll('input, textarea, select')) as (HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement)[];
    const descriptors: FormFieldDescriptor[] = [];

    for (const el of inputs) {
        // Skip hidden inputs or submit buttons
        if (el.type === 'hidden' || el.type === 'submit' || el.type === 'button') continue;

        // Skip if not visible (simple check)
        if (el.offsetParent === null) continue;

        const label = getLabelText(el);
        const predictedType = predictFieldType(el, label);

        descriptors.push({
            element: el,
            id: el.id,
            name: el.name,
            type: el.type,
            label,
            predictedType
        });
    }

    return descriptors;
}

export function fillField(descriptor: FormFieldDescriptor, value: string | boolean | number | File) {
    const el = descriptor.element;

    // Handle different input types
    if (el instanceof HTMLInputElement && el.type === 'file' && value instanceof File) {
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(value);
        el.files = dataTransfer.files;
    } else if (el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'radio')) {
        if (typeof value === 'boolean' && value) {
            el.checked = true;
        }
    } else {
        el.value = String(value);
    }

    // Trigger events to ensure frameworks (React, Angular) detect change
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('blur', { bubbles: true }));
}
