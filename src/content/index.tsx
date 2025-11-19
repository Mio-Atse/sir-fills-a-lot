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
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.background = 'rgba(0, 122, 255, 0.1)';
    overlay.style.zIndex = '1000000';
    overlay.style.cursor = 'crosshair';
    overlay.style.pointerEvents = 'auto';

    const hint = document.createElement('div');
    hint.textContent = 'Click on the job description text block';
    hint.style.position = 'fixed';
    hint.style.top = '20px';
    hint.style.left = '50%';
    hint.style.transform = 'translateX(-50%)';
    hint.style.background = '#007aff';
    hint.style.color = 'white';
    hint.style.padding = '10px 20px';
    hint.style.borderRadius = '20px';
    hint.style.fontWeight = 'bold';
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
            target.style.outline = '2px solid #007aff';
            setTimeout(() => {
                target.style.outline = originalOutline;
            }, 1000);

            chrome.runtime.sendMessage({ type: 'SAVE_JOB_DESCRIPTION', text });
            alert('Job Description Captured!');
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
