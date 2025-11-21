import { scanForCandidates } from '../src/engine/dom/fieldDiscovery';
import { matchFields } from '../src/engine/dom/matcher';
import { fillField } from '../src/engine/dom/filler';
import { CanonicalFieldType } from '../src/engine/profile/canonicalProfile';

type MaybeEl = HTMLElement | null;
type ResultStatus = 'pass' | 'fail' | 'warn';

interface TestFieldSpec {
    key: string;
    label: string;
    canonicalType: CanonicalFieldType;
    value: any;
    target: () => MaybeEl;
    optional?: boolean;
    verify?: (actual: any, expected: any, target: MaybeEl, matched: MaybeEl) => boolean;
}

interface TestSuite {
    id: string;
    name: string;
    getRoot: () => HTMLElement | Document | null;
    specs: TestFieldSpec[];
}

interface FieldResult {
    suiteId: string;
    key: string;
    label: string;
    status: ResultStatus;
    message: string;
    expectedValue: any;
    actualValue: any;
    expectedElement?: MaybeEl;
    matchedElement?: MaybeEl;
}

const PROFILE = {
    firstName: 'Jamie',
    lastName: 'Rivera',
    fullName: 'Jamie Rivera',
    email: 'jamie.rivera@example.com',
    phone: '+1 415 555 2020',
    city: 'Seattle',
    country: 'United States',
    linkedin: 'https://www.linkedin.com/in/jamierivera',
    portfolio: 'https://jamierivera.dev',
    coverLetter: 'I love building useful automation and have shipped multiple hiring flows.',
    summary: 'Ten years of full-stack experience with focus on reliability.',
    resume: new File(['Pretend resume bytes'], 'jamie-rivera-resume.pdf', { type: 'application/pdf' }),
    remoteOnly: true,
    willingToRelocate: false,
};

const SUITES: TestSuite[] = [
    {
        id: 'classic',
        name: 'Suite A: Classic recruiter form',
        getRoot: () => document.getElementById('classic-form'),
        specs: [
            {
                key: 'first-name',
                label: 'Given Name input',
                canonicalType: CanonicalFieldType.FirstName,
                value: PROFILE.firstName,
                target: () => document.getElementById('classic-first'),
            },
            {
                key: 'last-name',
                label: 'Family Name input',
                canonicalType: CanonicalFieldType.LastName,
                value: PROFILE.lastName,
                target: () => document.getElementById('classic-last'),
            },
            {
                key: 'email',
                label: 'Work email',
                canonicalType: CanonicalFieldType.Email,
                value: PROFILE.email,
                target: () => document.getElementById('classic-email'),
            },
            {
                key: 'phone',
                label: 'Mobile number',
                canonicalType: CanonicalFieldType.Phone,
                value: PROFILE.phone,
                target: () => document.getElementById('classic-phone'),
            },
            {
                key: 'city',
                label: 'City select',
                canonicalType: CanonicalFieldType.City,
                value: PROFILE.city,
                target: () => document.getElementById('classic-city'),
                verify: (actual, expected, _target, matched) => selectMatches(actual, expected, matched),
            },
            {
                key: 'country',
                label: 'Country select',
                canonicalType: CanonicalFieldType.Country,
                value: PROFILE.country,
                target: () => document.getElementById('classic-country'),
                verify: (actual, expected, _target, matched) => selectMatches(actual, expected, matched),
            },
            {
                key: 'cover-letter',
                label: 'Cover letter textarea',
                canonicalType: CanonicalFieldType.CoverLetter,
                value: PROFILE.coverLetter,
                target: () => document.getElementById('classic-cover'),
            },
            {
                key: 'resume',
                label: 'Resume upload',
                canonicalType: CanonicalFieldType.Resume,
                value: PROFILE.resume,
                target: () => document.getElementById('classic-resume'),
                verify: (actual) => typeof actual === 'string' && actual.length > 0,
                optional: false,
            },
        ],
    },
    {
        id: 'modern',
        name: 'Suite B: Modern layouts',
        getRoot: () => document.getElementById('modern-form'),
        specs: [
            {
                key: 'full-name',
                label: 'Full legal name (floating label)',
                canonicalType: CanonicalFieldType.FullName,
                value: PROFILE.fullName,
                target: () => document.getElementById('modern-full-name'),
            },
            {
                key: 'modern-email',
                label: 'Aria-only email',
                canonicalType: CanonicalFieldType.Email,
                value: PROFILE.email,
                target: () => document.getElementById('modern-email'),
            },
            {
                key: 'modern-phone',
                label: 'Aria-only phone',
                canonicalType: CanonicalFieldType.Phone,
                value: PROFILE.phone,
                target: () => document.getElementById('modern-phone'),
            },
            {
                key: 'linkedin',
                label: 'LinkedIn url',
                canonicalType: CanonicalFieldType.LinkedinUrl,
                value: PROFILE.linkedin,
                target: () => document.getElementById('modern-linkedin'),
            },
            {
                key: 'portfolio',
                label: 'Portfolio url (aria-labelledby)',
                canonicalType: CanonicalFieldType.PortfolioUrl,
                value: PROFILE.portfolio,
                target: () => document.getElementById('modern-portfolio'),
            },
            {
                key: 'modern-city',
                label: 'City select (modern)',
                canonicalType: CanonicalFieldType.City,
                value: PROFILE.city,
                target: () => document.getElementById('modern-city'),
                verify: (actual, expected, _target, matched) => selectMatches(actual, expected, matched),
            },
            {
                key: 'modern-country',
                label: 'Country select (modern)',
                canonicalType: CanonicalFieldType.Country,
                value: PROFILE.country,
                target: () => document.getElementById('modern-country'),
                verify: (actual, expected, _target, matched) => selectMatches(actual, expected, matched),
            },
            {
                key: 'modern-cover',
                label: 'Modern cover letter',
                canonicalType: CanonicalFieldType.CoverLetter,
                value: PROFILE.coverLetter,
                target: () => document.getElementById('modern-cover'),
            },
            {
                key: 'remote-checkbox',
                label: 'Remote-only checkbox',
                canonicalType: CanonicalFieldType.RemotePreference,
                value: PROFILE.remoteOnly,
                target: () => document.getElementById('modern-remote'),
                optional: true,
            },
            {
                key: 'relocation-radio',
                label: 'Relocation radios',
                canonicalType: CanonicalFieldType.RelocationWillingness,
                value: PROFILE.willingToRelocate,
                target: () => document.getElementById('relocate-yes'),
                optional: true,
            },
            {
                key: 'summary-contenteditable',
                label: 'Contenteditable summary (role=textbox)',
                canonicalType: CanonicalFieldType.FreeText,
                value: PROFILE.summary,
                target: () => document.getElementById('modern-summary'),
                optional: true,
                verify: (actual, expected) => stringEquals(actual, expected),
            },
        ],
    },
    {
        id: 'accessibility',
        name: 'Suite D: Accessibility edge cases',
        getRoot: () => document.getElementById('accessibility-form'),
        specs: [
            {
                key: 'acc-first',
                label: 'Aria-labelledby first name',
                canonicalType: CanonicalFieldType.FirstName,
                value: PROFILE.firstName,
                target: () => document.getElementById('acc-first'),
            },
            {
                key: 'acc-last',
                label: 'Placeholder-only last name',
                canonicalType: CanonicalFieldType.LastName,
                value: PROFILE.lastName,
                target: () => document.getElementById('acc-last'),
            },
            {
                key: 'acc-email',
                label: 'Aria-label email',
                canonicalType: CanonicalFieldType.Email,
                value: PROFILE.email,
                target: () => document.getElementById('acc-email'),
            },
            {
                key: 'acc-phone',
                label: 'Placeholder phone',
                canonicalType: CanonicalFieldType.Phone,
                value: PROFILE.phone,
                target: () => document.getElementById('acc-phone'),
            },
            {
                key: 'acc-city',
                label: 'City (different value/text)',
                canonicalType: CanonicalFieldType.City,
                value: PROFILE.city,
                target: () => document.getElementById('acc-city'),
                verify: (_actual, expected, _target, matched) => selectMatches('', expected, matched),
            },
            {
                key: 'acc-country',
                label: 'Country (optgroup, lowercase value)',
                canonicalType: CanonicalFieldType.Country,
                value: PROFILE.country,
                target: () => document.getElementById('acc-country'),
                verify: (_actual, expected, _target, matched) => selectMatches('', expected, matched),
            },
            {
                key: 'acc-portfolio',
                label: 'Portfolio (aria-labelledby multi-id)',
                canonicalType: CanonicalFieldType.PortfolioUrl,
                value: PROFILE.portfolio,
                target: () => document.getElementById('acc-portfolio'),
            },
            {
                key: 'acc-cover',
                label: 'Cover letter textarea',
                canonicalType: CanonicalFieldType.CoverLetter,
                value: PROFILE.coverLetter,
                target: () => document.getElementById('acc-cover'),
            },
            {
                key: 'acc-resume',
                label: 'Resume upload',
                canonicalType: CanonicalFieldType.Resume,
                value: PROFILE.resume,
                target: () => document.getElementById('acc-resume'),
            },
        ],
    },
    {
        id: 'shadow',
        name: 'Suite E: Shadow DOM',
        getRoot: () => {
            const host = document.getElementById('shadow-form-host') as HTMLElement | null;
            if (host && !host.shadowRoot) {
                initShadowForm();
            }
            const shadow = host?.shadowRoot;
            // scanForCandidates accepts ShadowRoot, but our type signature is HTMLElement | Document | null, so cast.
            return (shadow as unknown as Document) || null;
        },
        specs: [
            {
                key: 'shadow-first',
                label: 'Shadow first name',
                canonicalType: CanonicalFieldType.FirstName,
                value: PROFILE.firstName,
                target: () => getShadowElement('shadow-first'),
            },
            {
                key: 'shadow-last',
                label: 'Shadow last name',
                canonicalType: CanonicalFieldType.LastName,
                value: PROFILE.lastName,
                target: () => getShadowElement('shadow-last'),
            },
            {
                key: 'shadow-email',
                label: 'Shadow email',
                canonicalType: CanonicalFieldType.Email,
                value: PROFILE.email,
                target: () => getShadowElement('shadow-email'),
            },
            {
                key: 'shadow-phone',
                label: 'Shadow phone',
                canonicalType: CanonicalFieldType.Phone,
                value: PROFILE.phone,
                target: () => getShadowElement('shadow-phone'),
            },
            {
                key: 'shadow-city',
                label: 'Shadow city select',
                canonicalType: CanonicalFieldType.City,
                value: PROFILE.city,
                target: () => getShadowElement('shadow-city'),
                verify: (_actual, expected, _target, matched) => selectMatches('', expected, matched),
            },
            {
                key: 'shadow-country',
                label: 'Shadow country select',
                canonicalType: CanonicalFieldType.Country,
                value: PROFILE.country,
                target: () => getShadowElement('shadow-country'),
                verify: (_actual, expected, _target, matched) => selectMatches('', expected, matched),
            },
        ],
    },
    {
        id: 'roles',
        name: 'Suite E: Role-based custom controls',
        getRoot: () => document.getElementById('role-form'),
        specs: [
            {
                key: 'role-fullname',
                label: 'Div role=textbox full name',
                canonicalType: CanonicalFieldType.FullName,
                value: PROFILE.fullName,
                target: () => document.getElementById('role-fullname'),
            },
            {
                key: 'role-email',
                label: 'Div role=textbox email',
                canonicalType: CanonicalFieldType.Email,
                value: PROFILE.email,
                target: () => document.getElementById('role-email'),
            },
            {
                key: 'role-remote',
                label: 'Div role=radio remote yes',
                canonicalType: CanonicalFieldType.RemotePreference,
                value: PROFILE.remoteOnly,
                target: () => document.getElementById('role-remote-yes'),
                optional: true,
            },
            {
                key: 'role-country',
                label: 'Div role=listbox country',
                canonicalType: CanonicalFieldType.Country,
                value: PROFILE.country,
                target: () => document.getElementById('role-country'),
                optional: true,
            },
        ],
    },
    {
        id: 'iframe',
        name: 'Suite C: Iframe aria-labelledby',
        getRoot: () => {
            const iframe = document.getElementById('edge-iframe') as HTMLIFrameElement | null;
            return iframe?.contentDocument || null;
        },
        specs: [
            {
                key: 'iframe-full-name',
                label: 'Iframe full name',
                canonicalType: CanonicalFieldType.FullName,
                value: PROFILE.fullName,
                target: () => {
                    const iframe = document.getElementById('edge-iframe') as HTMLIFrameElement | null;
                    return iframe?.contentDocument?.getElementById('iframe-full-name') as MaybeEl;
                },
            },
            {
                key: 'iframe-email',
                label: 'Iframe email',
                canonicalType: CanonicalFieldType.Email,
                value: PROFILE.email,
                target: () => {
                    const iframe = document.getElementById('edge-iframe') as HTMLIFrameElement | null;
                    return iframe?.contentDocument?.getElementById('iframe-email') as MaybeEl;
                },
            },
            {
                key: 'iframe-phone',
                label: 'Iframe phone',
                canonicalType: CanonicalFieldType.Phone,
                value: PROFILE.phone,
                target: () => {
                    const iframe = document.getElementById('edge-iframe') as HTMLIFrameElement | null;
                    return iframe?.contentDocument?.getElementById('iframe-phone') as MaybeEl;
                },
            },
            {
                key: 'iframe-country',
                label: 'Iframe country select',
                canonicalType: CanonicalFieldType.Country,
                value: PROFILE.country,
                target: () => {
                    const iframe = document.getElementById('edge-iframe') as HTMLIFrameElement | null;
                    return iframe?.contentDocument?.getElementById('iframe-country') as MaybeEl;
                },
                verify: (actual, expected, _target, matched) => selectMatches(actual, expected, matched),
            },
        ],
    },
];

function selectMatches(_actual: any, expected: any, matched: MaybeEl): boolean {
    if (!matched || !(matched instanceof HTMLSelectElement)) return false;
    const selected = matched.options[matched.selectedIndex];
    const selectedText = selected?.text?.toLowerCase() || '';
    const selectedValue = selected?.value?.toLowerCase() || '';
    const target = String(expected).toLowerCase();
    return selectedText === target || selectedValue === target || selectedText.includes(target);
}

function stringEquals(actual: any, expected: any): boolean {
    if (actual == null || expected == null) return false;
    return String(actual).trim().toLowerCase() === String(expected).trim().toLowerCase();
}

async function runSuite(suite: TestSuite): Promise<FieldResult[]> {
    const root = suite.getRoot();
    const results: FieldResult[] = [];

    if (!root) {
        suite.specs.forEach((spec) => {
            results.push({
                suiteId: suite.id,
                key: spec.key,
                label: spec.label,
                status: spec.optional ? 'warn' : 'fail',
                message: 'Suite root not found',
                expectedValue: spec.value,
                actualValue: null,
            });
        });
        return results;
    }

    resetForms(root);
    const candidates = scanForCandidates(root);
    const matches = matchFields(candidates);

    for (const spec of suite.specs) {
        const expectedEl = spec.target();
        const matched = matches.get(spec.canonicalType);
        let status: ResultStatus = 'fail';
        let message = '';
        let actualValue: any = null;

        if (!matched) {
            status = spec.optional ? 'warn' : 'fail';
            message = 'No candidate matched this canonical type.';
        } else {
            // Fill using engine
            const filled = await fillField(matched, spec.value);
            actualValue = readValue(expectedEl);
            const matchedValue = readValue(matched.element);

            const hitExpectedElement = expectedEl ? matched.element === expectedEl : true;
            const valueOk = spec.verify
                ? spec.verify(actualValue, spec.value, expectedEl, matched.element)
                : defaultVerify(actualValue, spec.value, expectedEl);

            if (!hitExpectedElement) {
                status = 'fail';
                message = `Matched wrong element (${describeElement(matched.element)})`;
            } else if (!filled) {
                status = spec.optional ? 'warn' : 'fail';
                message = 'fillField returned false (filler limitation?)';
            } else if (!valueOk) {
                status = spec.optional ? 'warn' : 'fail';
                message = `Value mismatch. Expected "${spec.value}", got "${actualValue}" (matched element value "${matchedValue}")`;
            } else {
                status = 'pass';
                message = `Matched ${describeElement(matched.element)}; wrote "${matchedValue}"`;
            }
        }

        markElement(expectedEl, status);
        if (matched && matched.element !== expectedEl) {
            markElement(matched.element, 'fail');
        }

        results.push({
            suiteId: suite.id,
            key: spec.key,
            label: spec.label,
            status,
            message,
            expectedValue: spec.value,
            actualValue,
            expectedElement: expectedEl,
            matchedElement: matched?.element,
        });
    }

    return results;
}

function resetForms(root: HTMLElement | Document) {
    const scope = root instanceof Document ? root : root.ownerDocument ?? document;
    const forms = (root as HTMLElement | Document).querySelectorAll?.('form') ?? scope.querySelectorAll('form');
    forms.forEach((form) => form instanceof HTMLFormElement && form.reset());

    // Clear contenteditable summary between runs
    const summary = scope.getElementById('modern-summary');
    if (summary && summary.isContentEditable) {
        summary.textContent = '';
    }
}

function readValue(element: MaybeEl): any {
    if (!element) return null;
    const tag = element.tagName?.toLowerCase?.() || '';
    if (tag === 'input') {
        const input = element as HTMLInputElement;
        if (input.type === 'checkbox' || input.type === 'radio') return input.checked;
        if (input.type === 'file') return input.files && input.files.length > 0 ? input.files[0].name : '';
        return input.value;
    }
    if (tag === 'select') {
        const select = element as HTMLSelectElement;
        const selected = select.options[select.selectedIndex];
        return selected ? selected.text || selected.value : '';
    }
    if (tag === 'textarea') {
        return (element as HTMLTextAreaElement).value;
    }
    const roleAttr = element.getAttribute('role');
    if (roleAttr === 'listbox') {
        const selected = element.querySelector('[role="option"][aria-selected="true"], [role="option"].selected') as HTMLElement | null;
        if (selected) return (selected.getAttribute('data-value') || selected.textContent || '').trim();
        const dataValue = element.getAttribute('data-selected-value');
        if (dataValue) return dataValue;
    }
    if (roleAttr === 'radio') {
        const checked = element.getAttribute('aria-checked');
        if (checked != null) return checked === 'true';
    }
    return element.textContent?.trim() ?? '';
}

function defaultVerify(actual: any, expected: any, target: MaybeEl): boolean {
    if (expected instanceof File) {
        return typeof actual === 'string' && actual.includes(expected.name);
    }
    if (typeof expected === 'boolean') {
        return actual === expected;
    }
    if (target instanceof HTMLSelectElement) {
        return selectMatches(actual, expected, target);
    }
    return stringEquals(actual, expected);
}

function markElement(element: MaybeEl, status: ResultStatus) {
    if (!element) return;
    element.classList.remove('test-pass', 'test-fail', 'test-warn');
    element.classList.add(statusClass(status));
}

function statusClass(status: ResultStatus): string {
    switch (status) {
        case 'pass':
            return 'test-pass';
        case 'warn':
            return 'test-warn';
        default:
            return 'test-fail';
    }
}

function describeElement(el: HTMLElement): string {
    const parts = [el.tagName.toLowerCase()];
    if (el.id) parts.push(`#${el.id}`);
    if (el.getAttribute('name')) parts.push(`[name="${el.getAttribute('name')}"]`);
    return parts.join(' ');
}

function clearHighlights() {
    document.querySelectorAll('.test-pass, .test-fail, .test-warn').forEach((el) => {
        el.classList.remove('test-pass', 'test-fail', 'test-warn');
    });
    const iframe = document.getElementById('edge-iframe') as HTMLIFrameElement | null;
    const iframeDoc = iframe?.contentDocument;
    iframeDoc?.querySelectorAll('.test-pass, .test-fail, .test-warn').forEach((el) => {
        el.classList.remove('test-pass', 'test-fail', 'test-warn');
    });
}

function renderResults(results: FieldResult[]) {
    const summaryEl = document.getElementById('results-summary');
    const listEl = document.getElementById('results-list');
    if (!summaryEl || !listEl) return;

    const counts = results.reduce<Record<ResultStatus, number>>(
        (acc, res) => {
            acc[res.status] += 1;
            return acc;
        },
        { pass: 0, fail: 0, warn: 0 }
    );

    summaryEl.innerHTML = `
        <span class="pill">Pass: ${counts.pass}</span>
        <span class="pill">Warn: ${counts.warn}</span>
        <span class="pill">Fail: ${counts.fail}</span>
    `;

    listEl.innerHTML = '';
    results.forEach((res) => {
        const row = document.createElement('div');
        row.className = 'result-row';
        row.innerHTML = `
            <div>
                <div><strong>${res.label}</strong> <span class="meta">(${res.suiteId})</span></div>
                <div class="meta">${res.message}</div>
                <div class="meta">Expected: ${String(res.expectedValue)} | Actual: ${String(res.actualValue)}</div>
            </div>
            <span class="status ${res.status}">${res.status.toUpperCase()}</span>
        `;
        listEl.appendChild(row);
    });
}

async function runAllSuites() {
    clearHighlights();
    const allResults: FieldResult[] = [];
    for (const suite of SUITES) {
        const suiteResults = await runSuite(suite);
        allResults.push(...suiteResults);
    }
    renderResults(allResults);
}

function initShadowForm() {
    const host = document.getElementById('shadow-form-host');
    if (!host) return;
    if (host.shadowRoot) return;

    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = `
        <style>
            :host {
                display: block;
                font-family: inherit;
                color: inherit;
            }
            form {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 10px;
            }
            label {
                font-weight: 600;
            }
            input, select {
                width: 100%;
                padding: 10px;
                border-radius: 8px;
                border: 1px solid #334155;
                background: #0f172a;
                color: #e2e8f0;
            }
        </style>
        <form id="shadow-form">
            <label for="shadow-first">Shadow first name</label>
            <input id="shadow-first" name="shadow_first" type="text" placeholder="First" />
            <label for="shadow-last">Shadow last name</label>
            <input id="shadow-last" name="shadow_last" type="text" placeholder="Last" />
            <label for="shadow-email">Shadow email</label>
            <input id="shadow-email" name="shadow_email" type="email" placeholder="email@site.com" />
            <label for="shadow-phone">Shadow phone</label>
            <input id="shadow-phone" name="shadow_phone" type="tel" placeholder="+1 555 123 4567" />
            <label for="shadow-city">Shadow city</label>
            <select id="shadow-city" name="shadow_city">
                <option value="">Select</option>
                <option value="Seattle">Seattle</option>
                <option value="New York">New York</option>
                <option value="Berlin">Berlin</option>
            </select>
            <label for="shadow-country">Shadow country</label>
            <select id="shadow-country" name="shadow_country">
                <option value="">Select</option>
                <option value="United States">United States</option>
                <option value="Canada">Canada</option>
                <option value="Germany">Germany</option>
            </select>
        </form>
    `;
}

function getShadowElement(id: string): MaybeEl {
    const host = document.getElementById('shadow-form-host') as HTMLElement | null;
    const shadow = host?.shadowRoot;
    return shadow?.getElementById(id) as MaybeEl;
}

document.addEventListener('DOMContentLoaded', () => {
    initShadowForm();
    runAllSuites().catch(console.error);
});

document.getElementById('run-tests')?.addEventListener('click', () => {
    runAllSuites().catch(console.error);
});

document.getElementById('clear-highlights')?.addEventListener('click', () => {
    clearHighlights();
});
