// File: src/popup/Popup.tsx
import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { StorageService } from '../storage/storage';
import './Popup.css';

const Popup = () => {
    const [hasProfile, setHasProfile] = useState(false);
    const [showPaste, setShowPaste] = useState(false);
    const [pasteText, setPasteText] = useState('');

    useEffect(() => {
        checkProfile();
    }, []);

    const checkProfile = async () => {
        const profiles = await StorageService.getProfiles();
        setHasProfile(profiles.length > 0);
    };

    const openOptions = () => {
        chrome.runtime.openOptionsPage();
    };

    const captureJobDescription = async () => {
        // Send message to content script to trigger overlay capture mode
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab.id) {
            chrome.tabs.sendMessage(tab.id, { type: 'ACTIVATE_CAPTURE_MODE' });
            window.close();
        }
    };

    const handlePasteSave = async () => {
        if (pasteText.length < 10) {
            alert("Text too short.");
            return;
        }

        // Use the background script handler to save consistent job object
        await chrome.runtime.sendMessage({ type: 'SAVE_JOB_DESCRIPTION', text: pasteText });
        window.close();
    };

    return (
        <div className="popup-container">
            <h2>Job Helper</h2>

            {!hasProfile ? (
                <div className="alert">
                    <p>No profile found. Please complete onboarding.</p>
                    <button onClick={openOptions}>Open Settings</button>
                </div>
            ) : (
                <div className="actions">
                    {!showPaste ? (
                        <>
                            <button onClick={captureJobDescription}>
                                Pick Job Description from Page
                            </button>
                            <button onClick={() => setShowPaste(true)} className="secondary">
                                Paste Job Description
                            </button>
                            <button onClick={openOptions} className="secondary">
                                Settings
                            </button>
                        </>
                    ) : (
                        <div className="paste-mode">
                            <textarea
                                value={pasteText}
                                onChange={(e) => setPasteText(e.target.value)}
                                placeholder="Paste job description here..."
                                rows={8}
                                style={{ width: '100%', marginBottom: '10px', padding: '8px' }}
                            />
                            <button onClick={handlePasteSave}>Save Description</button>
                            <button onClick={() => setShowPaste(false)} className="secondary">Cancel</button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <Popup />
    </React.StrictMode>
);
