// File: src/content/index.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import ChatWidget from './chatWidget/ChatWidget';
import { getJobApplicationScore, JOB_PAGE_DETECTOR_CONFIG } from './jobPageDetector';
import { SessionManager } from '../job/applicationSession';

// Inject styles
import './chatWidget/ChatWidget.css';

const visibilityWindow = window as Window & {
    __sirfillsLastVisibility?: boolean;
    __sirfillsLastScore?: number;
    __sirfillsLastSignals?: string[];
};

const SHOW_WIDGET_MSG = 'SIRFILLS_SHOW_WIDGET';
const HIDE_WIDGET_MSG = 'SIRFILLS_HIDE_WIDGET';
const DETECTION_DEBOUNCE_MS = 450;
const IS_DEV = import.meta.env.DEV;

// Create root element for widget
const root = document.createElement('div');
root.id = 'job-helper-root';
document.body.appendChild(root);

ReactDOM.createRoot(root).render(
    <React.StrictMode>
        <ChatWidget />
    </React.StrictMode>
);

setupJobPageDetection(root);

SessionManager.updateStep(window.location.hostname, window.location.href).catch(console.error);

function setupJobPageDetection(widgetRoot: HTMLElement) {
    let lastVisibility = visibilityWindow.__sirfillsLastVisibility ?? false;
    let debounceHandle: number | undefined;

    const recordVisibility = (visible: boolean, score: number, signals: string[]) => {
        visibilityWindow.__sirfillsLastVisibility = visible;
        visibilityWindow.__sirfillsLastScore = score;
        visibilityWindow.__sirfillsLastSignals = signals;
    };

    const dispatchVisibility = (visible: boolean, score: number, signals: string[]) => {
        recordVisibility(visible, score, signals);
        if (visible === lastVisibility) return;

        lastVisibility = visible;
        const type = visible ? SHOW_WIDGET_MSG : HIDE_WIDGET_MSG;
        try {
            chrome.runtime.sendMessage({ type, payload: { score, signals } }, () => {
                void chrome.runtime.lastError;
            });
        } catch {
            // Ignore messaging failures
        }
    };

    const runDetection = () => {
        const result = getJobApplicationScore(document, window.location);
        const shouldShow = result.score >= JOB_PAGE_DETECTOR_CONFIG.threshold;

        if (IS_DEV) {
            console.debug('[Sir Fills-A-Lot] job page detection', {
                score: result.score,
                shouldShow,
                signals: result.signals,
            });
        }

        dispatchVisibility(shouldShow, result.score, result.signals);
    };

    const scheduleDetection = () => {
        if (debounceHandle) window.clearTimeout(debounceHandle);
        debounceHandle = window.setTimeout(runDetection, DETECTION_DEBOUNCE_MS);
    };

    const observer = new MutationObserver((mutations) => {
        const relevant = mutations.some((mutation) => !widgetRoot.contains(mutation.target as Node));
        if (relevant) {
            scheduleDetection();
        }
    });

    const startObserving = () => {
        if (!document.body) return;
        observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    };

    const wrapHistory = (method: 'pushState' | 'replaceState') => {
        const original = history[method];
        history[method] = function (...args: any[]) {
            const result = original.apply(history, args as any);
            scheduleDetection();
            return result;
        };
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            startObserving();
            scheduleDetection();
        }, { once: true });
    } else {
        startObserving();
        scheduleDetection();
    }

    window.addEventListener('hashchange', scheduleDetection);
    window.addEventListener('popstate', scheduleDetection);
    wrapHistory('pushState');
    wrapHistory('replaceState');

    // Initial detection (no debounce) to render quickly on static pages
    runDetection();
}

// Listen for capture mode activation
chrome.runtime.onMessage.addListener((message, _sender, _sendResponse) => {
    if (message.type === 'ACTIVATE_CAPTURE_MODE') {
        activateCaptureMode();
    }
});

function activateCaptureMode() {
    const overlay = document.createElement('div');
    overlay.className = 'sf-capture-overlay';

    const hint = document.createElement('div');
    hint.className = 'sf-capture-hint';

    // Create mascot image
    const img = document.createElement('img');
    img.src = chrome.runtime.getURL('icons/sir-fills-a-lot-app-mascot-idle-icon.png');

    const text = document.createElement('span');
    text.textContent = 'Click on the job description text block';

    hint.appendChild(img);
    hint.appendChild(text);
    overlay.appendChild(hint);

    document.body.appendChild(overlay);

    const handleClick = (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        let target = e.target as HTMLElement;
        let text = target.innerText;

        // Traverse up if text is too short (up to 5 levels)
        let attempts = 0;
        while (text.length < 150 && target.parentElement && attempts < 5) {
            target = target.parentElement;
            text = target.innerText;
            attempts++;
        }

        if (text.length > 50) {
            // Highlight the selected element briefly
            const originalOutline = target.style.outline;
            const originalTransition = target.style.transition;

            target.style.transition = 'outline 0.2s ease';
            target.style.outline = '3px solid #6366f1'; // var(--sf-primary)

            setTimeout(() => {
                target.style.outline = originalOutline;
                target.style.transition = originalTransition;
            }, 1000);

            chrome.runtime.sendMessage({ type: 'SAVE_JOB_DESCRIPTION', text });
            // We could use a custom toast here instead of alert, but for now alert is fine or we can rely on the popup update
            // alert('Job Description Captured!'); 
        } else {
            alert('Text too short. Please try clicking a larger block or use the "Paste" option in the extension popup.');
        }

        cleanup();
    };

    const cleanup = () => {
        overlay.removeEventListener('click', handleClick);
        overlay.remove();
    };

    overlay.addEventListener('click', handleClick);
}
