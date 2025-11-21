// File: src/content/chatWidget/ChatWidget.tsx
import React, { useState, useRef, useEffect } from 'react';
import { scanForm, fillField, FormFieldDescriptor, findNextButton } from '../formScanner';
import { StorageService } from '../../storage/storage';
import { callLLM } from '../../llm/providers';
import { getCoverLetterPrompt } from '../../llm/prompts/coverLetterPrompt';
import { X, Play, FileText, Send, Sparkles, AlertCircle } from 'lucide-react';
import { getExtensionAssetUrl } from '../../utils/assetPaths';
import './ChatWidget.css';

const mascotIdleIcon = getExtensionAssetUrl('icons/sir-fills-a-lot-app-mascot-idle-icon.png');
const mascotReadyIcon = getExtensionAssetUrl('icons/sir-fills-a-lot-mascot-ready-icon.png');
const mascotReadySprite = getExtensionAssetUrl('icons/ready_sprite.png');
const mascotSwingSprite = getExtensionAssetUrl('icons/swing_sprite.png');
const mascotSwingLastFrame = getExtensionAssetUrl('icons/swing_sprite_last_position.png');
const appIcon = getExtensionAssetUrl('icons/sir-fills-a-lot-app-icon.png');
const SHOW_WIDGET_MSG = 'SIRFILLS_SHOW_WIDGET';
const HIDE_WIDGET_MSG = 'SIRFILLS_HIDE_WIDGET';

const ChatWidget = () => {
    const visibilityState = window as Window & { __sirfillsLastVisibility?: boolean };
    const [isVisible, setIsVisible] = useState<boolean>(visibilityState.__sirfillsLastVisibility ?? false);
    const [isOpen, setIsOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'scan' | 'chat'>('scan');
    const [fields, setFields] = useState<FormFieldDescriptor[]>([]);
    const [messages, setMessages] = useState<{ role: string, content: string }[]>([]);
    const [input, setInput] = useState('');
    const [status, setStatus] = useState('');
    const [unfilledFields, setUnfilledFields] = useState<FormFieldDescriptor[]>([]);
    const [wizardStep, setWizardStep] = useState<number>(-1);
    const [wizardValue, setWizardValue] = useState<string | string[]>('');
    const [animationComplete, setAnimationComplete] = useState(false);
    const [isSwinging, setIsSwinging] = useState(false);
    const [swingComplete, setSwingComplete] = useState(false);
    const [speechText, setSpeechText] = useState('');
    const [showBubble, setShowBubble] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    useEffect(() => {
        setIsVisible(visibilityState.__sirfillsLastVisibility ?? false);
    }, []);

    useEffect(() => {
        if (!isOpen) {
            setAnimationComplete(false);
            setIsSwinging(false);
            setSwingComplete(false);
            setShowBubble(false);
        } else {
            // Show "Ready" bubble
            setSpeechText("Don't forget to pick or copy/paste job description!");
            setShowBubble(true);
            const timer = setTimeout(() => {
                setShowBubble(false);
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    useEffect(() => {
        const handleMessage = (message: any) => {
            if (message.type === SHOW_WIDGET_MSG) {
                setIsVisible(true);
            } else if (message.type === HIDE_WIDGET_MSG) {
                setIsVisible(false);
            }
        };

        chrome.runtime.onMessage.addListener(handleMessage);
        return () => chrome.runtime.onMessage.removeListener(handleMessage);
    }, []);

    useEffect(() => {
        visibilityState.__sirfillsLastVisibility = isVisible;
        if (!isVisible) {
            setIsOpen(false);
        }
    }, [isVisible]);

    // We will use onAnimationEnd instead of setTimeout for better sync
    useEffect(() => {
        if (isSwinging) {
            const timer = setTimeout(() => {
                setIsSwinging(false);
                setSwingComplete(true);
            }, 1500); // 1.5s swing animation
            return () => clearTimeout(timer);
        }
    }, [isSwinging]);

    useEffect(() => {
        if (wizardStep >= 0 && unfilledFields[wizardStep]) {
            const field = unfilledFields[wizardStep];
            if (field.controlType === 'checkbox' || field.controlType === 'multi-select') {
                const preset = field.options?.filter(opt => opt.selected).map(opt => opt.value) || [];
                setWizardValue(preset);
            } else if (field.options?.length) {
                const preselected = field.options.find(opt => opt.selected);
                setWizardValue(preselected ? preselected.value : '');
            } else {
                setWizardValue('');
            }
        }
    }, [wizardStep, unfilledFields]);

    const toggleOpen = () => setIsOpen(!isOpen);

    const base64ToFile = (base64: string, filename: string): File => {
        const arr = base64.split(',');
        const mime = arr[0].match(/:(.*?);/)?.[1] || 'application/pdf';
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
        }
        return new File([u8arr], filename, { type: mime });
    };

    const processCurrentPage = async (profile: any, prefs: any): Promise<{ filled: number, missing: FormFieldDescriptor[] }> => {
        const found = scanForm();
        setFields(found); // Update UI with current fields

        let filledCount = 0;
        const missing: FormFieldDescriptor[] = [];

        for (const f of found) {
            // if (f.predictedType === 'unknown') {
            //     missing.push(f);
            //     continue;
            // }

            let val: string | number | boolean | File | undefined;

            // Simple mapping
            switch (f.predictedType) {
                case 'first_name': val = profile.full_name?.split(' ')[0] || profile.cv_name.split(' ')[0]; break;
                case 'last_name': val = profile.full_name?.split(' ').slice(1).join(' ') || profile.cv_name.split(' ').slice(1).join(' '); break;
                case 'full_name': val = profile.full_name || profile.cv_name; break;
                case 'email': val = profile.email; break;
                case 'phone': val = profile.phone; break;
                case 'linkedin': val = profile.linkedin || profile.summary.match(/linkedin\.com\/in\/[\w-]+/)?.[0] || ''; break;
                case 'github': val = profile.github; break;
                case 'portfolio': val = profile.portfolio; break;
                case 'salary_expectation': val = prefs.salary_min; break;
                case 'relocation': val = prefs.relocation_ok; break;
                case 'remote': val = prefs.remote_only; break;
                case 'preferred_roles': val = profile.preferred_roles; break;
                case 'resume_upload':
                    if (profile.resume_data && profile.resume_name) {
                        val = base64ToFile(profile.resume_data, profile.resume_name);
                    }
                    break;
                case 'long_text':
                    // Use LLM to generate text
                    try {
                        val = await callLLM({
                            variant: 'small',
                            messages: [
                                { role: 'system', content: 'You are a helpful job application assistant. Generate a professional and concise answer for the form field based on the user profile. Do not include any explanations, just the answer.' },
                                { role: 'user', content: `Field Label: ${f.label}\n\nUser Profile: ${JSON.stringify(profile)}\n\nUser Preferences: ${JSON.stringify(prefs)}` }
                            ]
                        });
                        if (typeof val === 'string') val = val.trim().replace(/^["']|["']$/g, ''); // Clean quotes
                    } catch (error) {
                        console.error("LLM generation failed for field", f.label, error);
                    }
                    break;
            }

            // Fallback for unknown text fields - Try LLM
            if (val === undefined && f.predictedType === 'unknown') {
                const el = f.element;
                const isText = el instanceof HTMLTextAreaElement || (el instanceof HTMLInputElement && (el.type === 'text' || el.type === 'email' || el.type === 'tel' || el.type === 'url'));

                if (isText) {
                    try {
                        val = await callLLM({
                            variant: 'small',
                            messages: [
                                { role: 'system', content: 'You are a helpful job application assistant. Generate a professional and concise answer for the form field based on the user profile. Do not include any explanations, just the answer.' },
                                { role: 'user', content: `Field Label: ${f.label}\n\nUser Profile: ${JSON.stringify(profile)}\n\nUser Preferences: ${JSON.stringify(prefs)}` }
                            ]
                        });
                        if (typeof val === 'string') val = val.trim().replace(/^["']|["']$/g, '');
                    } catch (error) {
                        // Ignore error, just leave empty
                    }
                }
            }

            if (val !== undefined && val !== '') {
                fillField(f, val);
                filledCount++;
            } else {
                missing.push(f);
            }
        }
        return { filled: filledCount, missing };
    };

    const handleScan = async () => {
        setIsSwinging(true);
        setSwingComplete(false);

        // Show "Scan" bubble
        setSpeechText("One extension to rule them all!");
        setShowBubble(true);
        setTimeout(() => {
            setShowBubble(false);
        }, 2000);

        setStatus('Loading profile...');
        const profiles = await StorageService.getProfiles();
        const defaultId = await StorageService.getDefaultProfileId();
        const profile = profiles.find(p => p.id === defaultId) || profiles[0];
        const prefs = await StorageService.getPreferences();

        if (!profile) {
            setStatus('No profile found. Please configure in options.');
            return;
        }

        let totalFilled = 0;
        let step = 1;
        const maxSteps = 5;
        let finalMissing: FormFieldDescriptor[] = [];

        while (step <= maxSteps) {
            setStatus(`Scanning page ${step}...`);

            // Wait a bit for any dynamic content
            await new Promise(r => setTimeout(r, 1000));

            const { filled, missing } = await processCurrentPage(profile, prefs);
            totalFilled += filled;
            finalMissing = missing;

            setStatus(`Filled ${filled} fields on page ${step}.`);

            // Check for Next button
            const nextBtn = findNextButton();
            if (nextBtn) {
                setStatus(`Clicking Next (Page ${step})...`);
                nextBtn.click();
                step++;
                // Wait for navigation/render
                await new Promise(r => setTimeout(r, 3000));
            } else {
                break; // No next button, we are done
            }
        }

        setStatus(`Done! Filled ${totalFilled} fields total.`);

        if (finalMissing.length > 0) {
            setUnfilledFields(finalMissing);
            setWizardStep(0);
            setActiveTab('chat');
            setMessages(prev => [...prev, { role: 'assistant', content: `I finished scanning. I found ${finalMissing.length} fields on the last page I couldn't fill automatically.` }]);
        }
    };

    const handleWizardSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (wizardStep < 0 || wizardStep >= unfilledFields.length) return;

        const field = unfilledFields[wizardStep];
        const valueToApply = Array.isArray(wizardValue) ? wizardValue : wizardValue.toString().trim();
        const requiresChoice = field.controlType !== 'text' && field.controlType !== 'textarea' && field.controlType !== 'file';

        if (requiresChoice && ((Array.isArray(valueToApply) && valueToApply.length === 0) || (!Array.isArray(valueToApply) && !valueToApply))) {
            setStatus('Pick an option to continue.');
            return;
        }

        fillField(field, valueToApply);

        setWizardValue('');
        if (wizardStep + 1 < unfilledFields.length) {
            setWizardStep(wizardStep + 1);
        } else {
            setWizardStep(-1);
            setMessages(prev => [...prev, { role: 'assistant', content: "All fields processed!" }]);
            setStatus('Form filling complete.');
        }
    };

    const skipWizardStep = () => {
        setWizardValue('');
        if (wizardStep + 1 < unfilledFields.length) {
            setWizardStep(wizardStep + 1);
        } else {
            setWizardStep(-1);
            setMessages(prev => [...prev, { role: 'assistant', content: "Wizard finished." }]);
        }
    };

    const currentWizardField = wizardStep >= 0 ? unfilledFields[wizardStep] : undefined;

    const toggleMultiValue = (val: string) => {
        setWizardValue(prev => {
            const current = Array.isArray(prev) ? [...prev] : [];
            if (current.includes(val)) {
                return current.filter(v => v !== val);
            }
            current.push(val);
            return current;
        });
    };

    const renderWizardControl = (field: FormFieldDescriptor | undefined) => {
        if (!field) return null;
        const hasOptions = field.options && field.options.length > 0;

        if (hasOptions && (field.controlType === 'select' || field.controlType === 'custom-select')) {
            return (
                <select
                    className="sf-wizard-select"
                    value={typeof wizardValue === 'string' ? wizardValue : ''}
                    onChange={e => setWizardValue(e.target.value)}
                >
                    <option value="" disabled>Select an option</option>
                    {field.options!.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                </select>
            );
        }

        if (hasOptions && field.controlType === 'radio') {
            return (
                <div className="sf-wizard-options">
                    {field.options!.map(opt => (
                        <label key={opt.value} className={`sf-option-pill ${wizardValue === opt.value ? 'active' : ''}`}>
                            <input
                                type="radio"
                                name={`wizard-${wizardStep}`}
                                value={opt.value}
                                checked={wizardValue === opt.value}
                                onChange={() => setWizardValue(opt.value)}
                            />
                            <span>{opt.label}</span>
                        </label>
                    ))}
                </div>
            );
        }

        if (hasOptions && (field.controlType === 'checkbox' || field.controlType === 'multi-select')) {
            const selected = Array.isArray(wizardValue) ? wizardValue : [];
            return (
                <div className="sf-wizard-options">
                    {field.options!.map(opt => (
                        <label key={opt.value} className={`sf-option-pill checkbox ${selected.includes(opt.value) ? 'active' : ''}`}>
                            <input
                                type="checkbox"
                                value={opt.value}
                                checked={selected.includes(opt.value)}
                                onChange={() => toggleMultiValue(opt.value)}
                            />
                            <span>{opt.label}</span>
                        </label>
                    ))}
                </div>
            );
        }

        return (
            <input
                autoFocus
                type="text"
                value={typeof wizardValue === 'string' ? wizardValue : ''}
                onChange={e => setWizardValue(e.target.value)}
                placeholder="Enter value..."
                className="sf-wizard-input"
            />
        );
    };

    const generateCoverLetter = async () => {
        setStatus('Generating cover letter...');
        const profiles = await StorageService.getProfiles();
        const defaultId = await StorageService.getDefaultProfileId();
        const profile = profiles.find(p => p.id === defaultId) || profiles[0];
        const prefs = await StorageService.getPreferences();
        const job = await StorageService.getCurrentJobDescription();

        if (!profile || !job) {
            setStatus('Missing profile or job description.');
            return;
        }

        try {
            const prompt = getCoverLetterPrompt(profile, prefs, job);
            const letter = await callLLM({
                variant: 'big',
                messages: prompt,
                temperature: 0.7
            });

            // Find cover letter field
            const clField = fields.find(f => f.predictedType === 'cover_letter');
            if (clField) {
                fillField(clField, letter);
                setStatus('Cover letter generated and filled!');
            } else {
                // Copy to clipboard or show in chat
                setMessages(prev => [...prev, { role: 'assistant', content: `I couldn't find a cover letter field, but here is the text:\n\n${letter}` }]);
                setStatus('Cover letter generated (see chat).');
            }
        } catch (err: any) {
            setStatus(`Error: ${err.message}`);
        }
    };

    const handleChatSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim()) return;

        const userMsg = { role: 'user', content: input };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setStatus('Thinking...');

        try {
            // Simple chat with small model for now
            const response = await callLLM({
                variant: 'small',
                messages: [
                    { role: 'system', content: 'You are a helpful job application assistant.' },
                    ...messages.map(m => ({ role: m.role as any, content: m.content })),
                    { role: 'user', content: input }
                ]
            });

            setMessages(prev => [...prev, { role: 'assistant', content: response }]);
            setStatus('');
        } catch (err: any) {
            setStatus(`Error: ${err.message}`);
        }
    };

    if (!isVisible) {
        return null;
    }

    if (!isOpen) {
        return (
            <button className="sf-fab" onClick={toggleOpen}>
                <img src={mascotIdleIcon} alt="Sir Fills-A-Lot" />
            </button>
        );
    }

    return (
        <>
            {showBubble && (
                <div className="sf-speech-bubble">
                    {speechText}
                </div>
            )}
            {isSwinging ? (
                <div
                    className="sf-widget-mascot sf-widget-mascot-swing"
                    style={{ backgroundImage: `url(${mascotSwingSprite})` }}
                    aria-label="Sir Fills-A-Lot Mascot Swinging"
                />
            ) : swingComplete ? (
                <img
                    src={mascotSwingLastFrame}
                    alt="Sir Fills-A-Lot Mascot"
                    className="sf-widget-mascot sf-widget-mascot-swing-static"
                />
            ) : !animationComplete ? (
                <div
                    className="sf-widget-mascot sf-widget-mascot-animated"
                    style={{ backgroundImage: `url(${mascotReadySprite})` }}
                    aria-label="Sir Fills-A-Lot Mascot"
                    onAnimationEnd={(e) => {
                        if (e.animationName.includes('sprite-animation')) {
                            setAnimationComplete(true);
                        }
                    }}
                />
            ) : (
                <img
                    src={mascotReadyIcon}
                    alt="Sir Fills-A-Lot Mascot"
                    className="sf-widget-mascot sf-widget-mascot-static"
                />
            )}
            <div className="sf-widget-panel">
                <div className="sf-widget-header">
                    <div className="sf-header-brand">
                        <div className="sf-header-icon">
                            <img src={appIcon} alt="App Icon" />
                        </div>
                        <div className="sf-header-text">
                            <h3>Sir Fills-A-Lot</h3>
                            <p>Job Assistant</p>
                        </div>
                    </div>
                    <button onClick={toggleOpen} className="sf-close-btn"><X size={18} /></button>
                </div>

                <div className="sf-widget-tabs">
                    <button className={activeTab === 'scan' ? 'active' : ''} onClick={() => setActiveTab('scan')}>Scan & Fill</button>
                    <button className={activeTab === 'chat' ? 'active' : ''} onClick={() => setActiveTab('chat')}>Chat</button>
                </div>

                <div className="sf-widget-content">
                    {status && <div className="sf-status-bar"><Sparkles size={12} /> {status}</div>}

                    {activeTab === 'scan' && (
                        <div className="sf-scan-panel">
                            <div className="sf-cta-group">
                                <button className="sf-btn-primary" onClick={handleScan}>
                                    <Play size={16} /> Scan & Auto-Fill
                                </button>

                                <button className="sf-btn-secondary" onClick={generateCoverLetter}>
                                    <FileText size={16} /> Generate Cover Letter
                                </button>
                            </div>

                            <div className="sf-fields-list">
                                <h4>Detected Fields ({fields.length})</h4>
                                <ul>
                                    {fields.map((f, i) => (
                                        <li key={i} className="sf-field-item">
                                            <div className="sf-field-info">
                                                <span className="sf-field-label">{f.label || f.name}</span>
                                                <span className="sf-field-type">{f.predictedType}</span>
                                            </div>
                                            <div className="sf-field-status">
                                                {/* Placeholder for status icon */}
                                                <div className="sf-status-dot"></div>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    )}

                    {activeTab === 'chat' && (
                        <div className="sf-chat-panel">
                            <div className="sf-messages">
                                {messages.map((m, i) => (
                                    <div key={i} className={`sf-msg-row ${m.role}`}>
                                        {m.role === 'assistant' && (
                                            <div className="sf-msg-avatar">
                                                <img src={mascotReadyIcon} alt="Bot" />
                                            </div>
                                        )}
                                        <div className={`sf-msg-bubble ${m.role}`}>
                                            {m.content}
                                        </div>
                                    </div>
                                ))}

                                {currentWizardField && (
                                    <div className="sf-wizard-card">
                                        <div className="sf-wizard-header">
                                            <AlertCircle size={16} className="sf-wizard-icon" />
                                            <span>Missing Field</span>
                                        </div>
                                        <p className="sf-wizard-label">
                                            {currentWizardField?.label || currentWizardField?.name}
                                        </p>
                                        <form onSubmit={handleWizardSubmit}>
                                            <div className="sf-wizard-control">
                                                {renderWizardControl(currentWizardField)}
                                            </div>
                                            <div className="sf-wizard-actions">
                                                <button type="submit" className="sf-btn-sm-primary">Fill</button>
                                                <button type="button" onClick={skipWizardStep} className="sf-btn-sm-secondary">Skip</button>
                                            </div>
                                        </form>
                                    </div>
                                )}
                                <div ref={messagesEndRef} />
                            </div>

                            {wizardStep === -1 && (
                                <form onSubmit={handleChatSubmit} className="sf-chat-input-area">
                                    <input
                                        type="text"
                                        value={input}
                                        onChange={e => setInput(e.target.value)}
                                        placeholder="Ask me anything..."
                                    />
                                    <button type="submit" disabled={!input.trim()}>
                                        <Send size={16} />
                                    </button>
                                </form>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};

export default ChatWidget;
