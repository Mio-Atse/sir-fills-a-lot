// File: src/content/index.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import ChatWidget from './chatWidget/ChatWidget';

// Inject styles
import './chatWidget/ChatWidget.css';

// Create root element for widget
const root = document.createElement('div');
root.id = 'job-helper-root';
document.body.appendChild(root);

ReactDOM.createRoot(root).render(
    <React.StrictMode>
        <ChatWidget />
    </React.StrictMode>
);

// Track session step
import { SessionManager } from '../job/applicationSession';
SessionManager.updateStep(window.location.hostname, window.location.href).catch(console.error);

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
    img.src = chrome.runtime.getURL('icons/sir-fills-a-lot-mascot.png');

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
