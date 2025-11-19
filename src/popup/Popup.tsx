// File: src/popup/Popup.tsx
import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { StorageService } from '../storage/storage';
import './Popup.css';

const Popup = () => {
    const [hasProfile, setHasProfile] = useState(false);
    const [profiles, setProfiles] = useState<any[]>([]);
    const [activeProfileId, setActiveProfileId] = useState<string>('');
    const [showPaste, setShowPaste] = useState(false);
    const [pasteText, setPasteText] = useState('');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        const [p, defaultId] = await Promise.all([
            StorageService.getProfiles(),
            StorageService.getDefaultProfileId()
        ]);
        setProfiles(p);
        setHasProfile(p.length > 0);
        if (defaultId) setActiveProfileId(defaultId);
        else if (p.length > 0) setActiveProfileId(p[0].id);
    };

    const handleProfileChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newId = e.target.value;
        setActiveProfileId(newId);
        await StorageService.setDefaultProfileId(newId);
    };

    const openOptions = () => {
        chrome.runtime.openOptionsPage();
    };

    const captureJobDescription = async () => {
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
                    {profiles.length > 1 && (
                        <div className="profile-selector">
                            <label>Active Profile:</label>
                            <select value={activeProfileId} onChange={handleProfileChange}>
                                {profiles.map(p => (
                                    <option key={p.id} value={p.id}>{p.cv_name}</option>
                                ))}
                            </select>
                        </div>
                    )}

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
