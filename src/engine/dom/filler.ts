import { FormFieldCandidate } from './fieldDiscovery';

/**
 * Dispatches a sequence of events to simulate user interaction.
 * Critical for React/Angular/Vue apps that listen to 'input' or 'change'.
 */
function dispatchEvents(element: HTMLElement) {
    const eventTypes = ['focus', 'input', 'change', 'blur'];
    eventTypes.forEach(type => {
        const event = new Event(type, { bubbles: true, cancelable: true });
        element.dispatchEvent(event);
    });
}

/**
 * Sets the value of an input element using the native property setter.
 * This bypasses React's event overriding in some cases.
 */
function setNativeValue(element: HTMLElement, value: string) {
    const prototype = Object.getPrototypeOf(element);
    const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');

    // If we can find the native setter, call it
    if (descriptor && descriptor.set) {
        descriptor.set.call(element, value);
    } else {
        // Fallback
        (element as HTMLInputElement).value = value;
    }
}

function normalizeYesNo(target: any): string {
    if (typeof target === 'boolean') return target ? 'yes' : 'no';
    const str = String(target).toLowerCase();
    if (['true', '1', 'yes', 'y'].includes(str)) return 'yes';
    if (['false', '0', 'no', 'n'].includes(str)) return 'no';
    return str;
}

function nearestLabelText(el: HTMLElement): string {
    const root = el.getRootNode() as Document | ShadowRoot;
    let text = '';
    if (el.id) {
        const label = root.querySelector?.(`label[for="${el.id}"]`);
        if (label) text += label.textContent || '';
    }
    const parentLabel = el.closest('label');
    if (parentLabel) text += ' ' + (parentLabel.textContent || '');
    const aria = el.getAttribute('aria-label');
    if (aria) text += ' ' + aria;
    const labelledBy = el.getAttribute('aria-labelledby');
    if (labelledBy) {
        labelledBy.split(/\s+/).forEach(id => {
            const labelEl = root.getElementById?.(id);
            if (labelEl) text += ' ' + (labelEl.textContent || '');
        });
    }
    return text.toLowerCase();
}

function fillCheckbox(input: HTMLInputElement, target: any): boolean {
    const shouldCheck = typeof target === 'boolean' ? target : normalizeYesNo(target) === 'yes';
    if (input.checked !== shouldCheck) {
        input.click();
        if (input.checked !== shouldCheck) {
            input.checked = shouldCheck;
            dispatchEvents(input);
        }
    }
    return true;
}

function fillNativeRadio(input: HTMLInputElement, target: any): boolean {
    const root = input.getRootNode() as Document | ShadowRoot;
    const name = input.name;
    const radios = name
        ? Array.from(root.querySelectorAll(`input[type="radio"][name="${CSS.escape(name)}"]`)) as HTMLInputElement[]
        : [input];
    const normalizedTarget = normalizeYesNo(target);

    const matchRadio = (radio: HTMLInputElement) => {
        const val = (radio.value || '').toLowerCase();
        const label = nearestLabelText(radio);
        if (normalizedTarget === 'yes') return val === 'yes' || val === 'true' || label.includes('yes') || label.includes('true') || label.includes('open to');
        if (normalizedTarget === 'no') return val === 'no' || val === 'false' || label.includes('no') || label.includes('not') || label.includes('prefer not');
        return val === normalizedTarget || label.includes(normalizedTarget);
    };

    let targetRadio = radios.find(r => matchRadio(r));
    if (!targetRadio) {
        // Fallback to first radio
        targetRadio = radios[0];
    }

    if (!targetRadio) return false;
    if (!targetRadio.checked) {
        targetRadio.click();
        if (!targetRadio.checked) {
            targetRadio.checked = true;
            dispatchEvents(targetRadio);
        }
    }
    // Uncheck others in the group
    radios.forEach(r => {
        if (r !== targetRadio && r.checked) {
            r.checked = false;
            dispatchEvents(r);
        }
    });
    return true;
}

function fillSelect(select: HTMLSelectElement, value: any): boolean {
    if (!select) return false;
    // Try to find option by value or text
    let optionToSelect: HTMLOptionElement | undefined;
    const lowerVal = String(value).toLowerCase();

    optionToSelect = Array.from(select.options).find(o => o.value.toLowerCase() === lowerVal);

    if (!optionToSelect) {
        optionToSelect = Array.from(select.options).find(o => o.text.toLowerCase() === lowerVal);
    }
    if (!optionToSelect) {
        optionToSelect = Array.from(select.options).find(o => o.text.toLowerCase().includes(lowerVal));
    }

    if (optionToSelect) {
        setNativeValue(select as unknown as HTMLElement, optionToSelect.value);
        select.value = optionToSelect.value;
        dispatchEvents(select);
        return true;
    }
    return false;
}

function fillContentEditable(element: HTMLElement, value: any): boolean {
    const text = value == null ? '' : String(value);
    element.focus();
    element.textContent = '';
    element.textContent = text;
    dispatchEvents(element);
    return true;
}

function fillFileInput(input: HTMLInputElement, value: any): boolean {
    try {
        const file = value instanceof File
            ? value
            : new File([String(value ?? 'Resume content')], 'resume.pdf', { type: 'application/pdf' });

        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        input.files = dataTransfer.files;
        dispatchEvents(input);
        return true;
    } catch (e) {
        console.warn('Unable to programmatically set file input', e);
        return false;
    }
}

function fillAriaListbox(listbox: HTMLElement, value: any): boolean {
    const options = Array.from(listbox.querySelectorAll('[role="option"]')) as HTMLElement[];
    if (options.length === 0) return false;
    const target = String(value).toLowerCase();
    let match = options.find(opt => (opt.getAttribute('data-value') || '').toLowerCase() === target);
    if (!match) {
        match = options.find(opt => (opt.textContent || '').trim().toLowerCase() === target);
    }
    if (!match) {
        match = options.find(opt => (opt.textContent || '').trim().toLowerCase().includes(target));
    }
    if (!match) match = options[0];

    options.forEach(opt => {
        const isMatch = opt === match;
        opt.setAttribute('aria-selected', isMatch ? 'true' : 'false');
        if (isMatch && !opt.classList.contains('selected')) {
            opt.classList.add('selected');
        } else if (!isMatch && opt.classList.contains('selected')) {
            opt.classList.remove('selected');
        }
    });
    listbox.setAttribute('data-selected-value', match?.getAttribute('data-value') || (match?.textContent || '').trim());
    dispatchEvents(listbox);
    return true;
}

function fillAriaRadio(radio: HTMLElement, value: any): boolean {
    const group = Array.from((radio.parentElement ?? radio).querySelectorAll('[role="radio"]')) as HTMLElement[];
    const normalized = normalizeYesNo(value);

    const matchRadio = (el: HTMLElement) => {
        const val = (el.getAttribute('data-value') || el.getAttribute('aria-label') || el.textContent || '').toLowerCase();
        if (normalized === 'yes') return val.includes('yes') || val.includes('true') || val.includes('open');
        if (normalized === 'no') return val.includes('no') || val.includes('false') || val.includes('not');
        return val.includes(normalized);
    };

    let targetRadio = group.find(matchRadio);
    if (!targetRadio) targetRadio = group[0];
    if (!targetRadio) return false;

    group.forEach(el => {
        const checked = el === targetRadio;
        el.setAttribute('aria-checked', checked ? 'true' : 'false');
        if (checked) {
            el.classList.add('selected');
        } else {
            el.classList.remove('selected');
        }
    });

    const clickEvent = new Event('click', { bubbles: true });
    targetRadio.dispatchEvent(clickEvent);
    dispatchEvents(targetRadio);
    return true;
}

export async function fillField(candidate: FormFieldCandidate, value: any): Promise<boolean> {
    const { element, tagName, inputType, role } = candidate;

    try {
        element.focus();

        // ARIA / custom-role widgets
        if (role === 'listbox') {
            return fillAriaListbox(element, value);
        }
        if (role === 'radio' && !(element instanceof HTMLInputElement)) {
            return fillAriaRadio(element, value);
        }
        if (role === 'textbox' && element.isContentEditable) {
            return fillContentEditable(element, value);
        }

        if (tagName === 'input' || tagName === 'textarea') {
            const input = element as HTMLInputElement | HTMLTextAreaElement;

            if (inputType === 'checkbox') {
                return fillCheckbox(input as HTMLInputElement, value);
            }
            if (inputType === 'radio') {
                return fillNativeRadio(input as HTMLInputElement, value);
            }
            if (inputType === 'file') {
                return fillFileInput(input as HTMLInputElement, value);
            }

            // Text-like inputs
            setNativeValue(input, String(value));
            dispatchEvents(input);
            return true;
        }

        if (tagName === 'select') {
            return fillSelect(element as HTMLSelectElement, value);
        }

        if (element.isContentEditable) {
            return fillContentEditable(element, value);
        }

        return false;
    } catch (e) {
        console.error('Error filling field', e);
        return false;
    }
}
