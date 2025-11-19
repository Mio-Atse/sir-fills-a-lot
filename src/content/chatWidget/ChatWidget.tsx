// File: src/content/chatWidget/ChatWidget.tsx
import React, { useState } from 'react';
import { scanForm, fillField, FormFieldDescriptor } from '../formScanner';
import { StorageService } from '../../storage/storage';
import { callLLM } from '../../llm/providers';
import { getCoverLetterPrompt } from '../../llm/prompts/coverLetterPrompt';
import { MessageCircle, X, Play } from 'lucide-react';
import './ChatWidget.css';

const ChatWidget = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'scan' | 'chat'>('scan');
    const [fields, setFields] = useState<FormFieldDescriptor[]>([]);
    const [messages, setMessages] = useState<{ role: string, content: string }[]>([]);
    const [input, setInput] = useState('');
    const [status, setStatus] = useState('');
    const [unfilledFields, setUnfilledFields] = useState<FormFieldDescriptor[]>([]);
    const [wizardStep, setWizardStep] = useState<number>(-1);
    const [wizardValue, setWizardValue] = useState('');

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

    const handleScan = async () => {
        setStatus('Scanning form...');
        const found = scanForm();
        setFields(found);
        setStatus(`Found ${found.length} fields.`);

        // Auto-fill basic fields from profile
        const profiles = await StorageService.getProfiles();
        const defaultId = await StorageService.getDefaultProfileId();
        const profile = profiles.find(p => p.id === defaultId) || profiles[0];
        const prefs = await StorageService.getPreferences();

        if (!profile) {
            setStatus('No profile found. Please configure in options.');
            return;
        }

        let filledCount = 0;
        const missing: FormFieldDescriptor[] = [];

        for (const f of found) {
            if (f.predictedType === 'unknown') {
                missing.push(f);
                continue;
            }

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
                case 'resume_upload':
                    if (profile.resume_data && profile.resume_name) {
                        val = base64ToFile(profile.resume_data, profile.resume_name);
                    }
                    break;
            }

            if (val !== undefined && val !== '') {
                fillField(f, val);
                filledCount++;
            } else {
                missing.push(f);
            }
        }
        setStatus(`Filled ${filledCount} fields.`);

        if (missing.length > 0) {
            setUnfilledFields(missing);
            setWizardStep(0);
            setActiveTab('chat');
            setMessages(prev => [...prev, { role: 'assistant', content: `I found ${missing.length} fields I couldn't fill automatically. Let's go through them.` }]);
        }
    };

    const handleWizardSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (wizardStep < 0 || wizardStep >= unfilledFields.length) return;

        const field = unfilledFields[wizardStep];
        fillField(field, wizardValue);

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

    if (!isOpen) {
        return (
            <button className="job-helper-fab" onClick={toggleOpen}>
                <MessageCircle size={24} />
            </button>
        );
    }

    return (
        <div className="job-helper-widget">
            <div className="widget-header">
                <h3>Job Helper</h3>
                <button onClick={toggleOpen}><X size={18} /></button>
            </div>

            <div className="widget-tabs">
                <button className={activeTab === 'scan' ? 'active' : ''} onClick={() => setActiveTab('scan')}>Scan & Fill</button>
                <button className={activeTab === 'chat' ? 'active' : ''} onClick={() => setActiveTab('chat')}>Chat</button>
            </div>

            <div className="widget-content">
                {status && <div className="status-msg">{status}</div>}

                {activeTab === 'scan' && (
                    <div className="scan-panel">
                        <button className="primary-btn" onClick={handleScan}>
                            <Play size={16} /> Scan & Auto-Fill
                        </button>

                        <button className="secondary-btn" onClick={generateCoverLetter}>
                            Generate Cover Letter
                        </button>

                        <div className="fields-list">
                            <h4>Detected Fields ({fields.length})</h4>
                            <ul>
                                {fields.map((f, i) => (
                                    <li key={i}>
                                        <span className="field-type">{f.predictedType}</span>
                                        <span className="field-name">{f.label || f.name}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                )}

                {activeTab === 'chat' && (
                    <div className="chat-panel">
                        <div className="messages">
                            {messages.map((m, i) => (
                                <div key={i} className={`msg ${m.role}`}>
                                    {m.content}
                                </div>
                            ))}

                            {wizardStep >= 0 && unfilledFields[wizardStep] && (
                                <div className="wizard-card">
                                    <p><strong>Fill Field:</strong> {unfilledFields[wizardStep].label || unfilledFields[wizardStep].name} ({unfilledFields[wizardStep].predictedType})</p>
                                    <form onSubmit={handleWizardSubmit}>
                                        <input
                                            autoFocus
                                            type="text"
                                            value={wizardValue}
                                            onChange={e => setWizardValue(e.target.value)}
                                            placeholder="Enter value..."
                                        />
                                        <div className="wizard-actions">
                                            <button type="submit">Fill</button>
                                            <button type="button" onClick={skipWizardStep} className="secondary">Skip</button>
                                        </div>
                                    </form>
                                </div>
                            )}
                        </div>

                        {wizardStep === -1 && (
                            <form onSubmit={handleChatSubmit}>
                                <input
                                    type="text"
                                    value={input}
                                    onChange={e => setInput(e.target.value)}
                                    placeholder="Ask me anything..."
                                />
                            </form>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ChatWidget;
