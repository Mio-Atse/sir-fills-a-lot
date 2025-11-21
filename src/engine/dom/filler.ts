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

export async function fillField(candidate: FormFieldCandidate, value: any): Promise<boolean> {
    const { element, tagName, inputType } = candidate;

    try {
        element.focus();

        if (tagName === 'input' || tagName === 'textarea') {
            const input = element as HTMLInputElement | HTMLTextAreaElement;

            if (inputType === 'checkbox' || inputType === 'radio') {
                // For checkboxes/radios, we prefer clicking the label if possible
                // or clicking the element itself if it's visible/clickable
                if ((input as HTMLInputElement).checked !== !!value) {
                    input.click();
                }
                return true;
            } else if (inputType === 'file') {
                // File input handling is tricky in extensions without user interaction
                // We might need to skip or use a specific API if available
                // For now, we'll log a warning that we can't programmatically set file inputs easily
                console.warn('File input filling not fully supported yet without DataTransfer hacks');
                return false;
            } else {
                // Text-like inputs
                setNativeValue(input, String(value));
                dispatchEvents(input);
                return true;
            }
        } else if (tagName === 'select') {
            const select = element as HTMLSelectElement;
            // Try to find option by value or text
            let optionToSelect: HTMLOptionElement | undefined;

            // 1. Exact value match
            optionToSelect = Array.from(select.options).find(o => o.value === String(value));

            // 2. Text match (fuzzy)
            if (!optionToSelect) {
                const lowerVal = String(value).toLowerCase();
                optionToSelect = Array.from(select.options).find(o => o.text.toLowerCase().includes(lowerVal));
            }

            if (optionToSelect) {
                select.value = optionToSelect.value;
                dispatchEvents(select);
                return true;
            }
        }

        return false;
    } catch (e) {
        console.error('Error filling field', e);
        return false;
    }
}
