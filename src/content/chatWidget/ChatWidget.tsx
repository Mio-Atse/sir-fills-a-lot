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

    const toggleOpen = () => setIsOpen(!isOpen);

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
        for (const f of found) {
            if (f.predictedType === 'unknown') continue;

            let val: string | number | boolean | undefined;

            // Simple mapping
            switch (f.predictedType) {
                case 'first_name': val = profile.cv_name.split(' ')[0]; break; // Fallback if not parsed
                case 'last_name': val = profile.cv_name.split(' ').slice(1).join(' '); break;
                case 'full_name': val = profile.cv_name; break;
                case 'email': val = "user@example.com"; break; // TODO: Add email to profile schema
                case 'linkedin': val = profile.summary.match(/linkedin\.com\/in\/[\w-]+/)?.[0] || ''; break;
                case 'salary_expectation': val = prefs.salary_min; break;
                case 'relocation': val = prefs.relocation_ok; break;
                case 'remote': val = prefs.remote_only; break;
                // Add more mappings
            }

            if (val !== undefined) {
                fillField(f, val);
                filledCount++;
            }
        }
        setStatus(`Filled ${filledCount} fields.`);
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
                        </div>
                        <form onSubmit={handleChatSubmit}>
                            <input
                                type="text"
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                placeholder="Ask me anything..."
                            />
                        </form>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ChatWidget;
