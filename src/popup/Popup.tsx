// File: src/popup/Popup.tsx
import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { StorageService } from '../storage/storage';
import './Popup.css';
import { getExtensionAssetUrl } from '../utils/assetPaths';
import { Settings, MousePointerClick, ClipboardPaste, Shield } from 'lucide-react';

const mascotIcon = getExtensionAssetUrl('icons/sir-fills-a-lot-app-icon.png');
const WAKE_WIDGET_MSG = 'SIRFILLS_WAKE_WIDGET';

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

    const sendMessageToTab = async (tabId: number, message: any) => {
        return new Promise((resolve, reject) => {
            chrome.tabs.sendMessage(tabId, message, (response) => {
                const lastError = chrome.runtime.lastError;
                if (lastError) {
                    reject(lastError);
                } else {
                    resolve(response);
                }
            });
        });
    };

    const injectContentScript = async (tabId: number) => {
        const manifest = chrome.runtime.getManifest();
        const files = manifest.content_scripts?.flatMap(cs => cs.js || []) || [];

        if (!files.length) {
            throw new Error('No content script files defined in manifest.');
        }

        await chrome.scripting.executeScript({
            target: { tabId },
            files
        });
    };

    const callKnight = async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.id) {
            alert('No active tab found.');
            return;
        }

        try {
            await sendMessageToTab(tab.id, { type: WAKE_WIDGET_MSG, payload: { tab: 'scan' } });
        } catch (_err) {
            try {
                await injectContentScript(tab.id);
                await sendMessageToTab(tab.id, { type: WAKE_WIDGET_MSG, payload: { tab: 'scan' } });
            } catch (injectErr) {
                console.error('Failed to wake widget:', injectErr);
                alert('Could not start the widget on this page. Try reloading the tab.');
                return;
            }
        }

        window.close();
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
            <header className="popup-header">
                <img src={mascotIcon} alt="Sir Fills-A-Lot mascot" className="brand-icon" />
                <div className="brand-text">
                    <h1>Sir Fills-A-Lot</h1>
                    <p>Your form-filling knight.</p>
                </div>
            </header>

            <div className="popup-content">
                <div className="knight-callout">
                    <button onClick={callKnight} className="btn-knight">
                        <Shield size={16} />
                        Call Knight
                    </button>
                    <p className="knight-caption">Press for job application.</p>
                </div>

                {!hasProfile ? (
                    <div className="alert-card">
                        <div className="alert-icon">🛡️</div>
                        <div className="alert-body">
                            <p>No profile found yet!</p>
                            <button onClick={openOptions} className="btn-primary">
                                Complete Onboarding
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="actions">
                        {profiles.length > 1 && (
                            <div className="profile-selector-wrapper">
                                <select
                                    value={activeProfileId}
                                    onChange={handleProfileChange}
                                    className="profile-select"
                                >
                                    {profiles.map(p => (
                                        <option key={p.id} value={p.id}>{p.cv_name}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {!showPaste ? (
                            <>
                                <button onClick={captureJobDescription} className="btn-primary">
                                    <MousePointerClick size={16} />
                                    Pick Job Description
                                </button>
                                <button onClick={() => setShowPaste(true)} className="btn-secondary">
                                    <ClipboardPaste size={16} />
                                    Paste Job Description
                                </button>
                                <button onClick={openOptions} className="btn-subtle">
                                    <Settings size={16} />
                                    Settings
                                </button>
                            </>
                        ) : (
                            <div className="paste-mode">
                                <textarea
                                    value={pasteText}
                                    onChange={(e) => setPasteText(e.target.value)}
                                    placeholder="Paste job description here..."
                                    rows={6}
                                />
                                <div className="paste-actions">
                                    <button onClick={handlePasteSave} className="btn-primary">Save</button>
                                    <button onClick={() => setShowPaste(false)} className="btn-secondary">Cancel</button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <Popup />
    </React.StrictMode>
);
