// File: src/options/Options.tsx
import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { StorageService } from '../storage/storage';
import { UserProfile, UserPreferences, LLMConfig, DEFAULT_LLM_CONFIG, DEFAULT_PREFERENCES } from '../storage/schema';
import { callLLM } from '../llm/providers';
import { getCVProfilePrompt } from '../llm/prompts/cvProfilePrompt';
import './Options.css';

// Import pdfjs-dist
import * as pdfjsLib from 'pdfjs-dist';
// @ts-ignore
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

const cleanJsonString = (str: string): string => {
    // Remove markdown code blocks
    let cleaned = str.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    // Trim whitespace
    cleaned = cleaned.trim();
    return cleaned;
};

const extractPdfText = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(' ');
        fullText += pageText + '\n';
    }

    return fullText;
};

const extractText = async (file: File): Promise<string> => {
    if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
        return extractPdfText(file);
    }

    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            const text = e.target?.result as string;
            resolve(text);
        };
        reader.onerror = reject;
        reader.readAsText(file);
    });
};

const Options = () => {
    const [activeTab, setActiveTab] = useState<'cv' | 'prefs' | 'llm'>('llm');
    const [profiles, setProfiles] = useState<UserProfile[]>([]);
    const [prefs, setPrefs] = useState<UserPreferences>(DEFAULT_PREFERENCES);
    const [llmConfig, setLlmConfig] = useState<LLMConfig>(DEFAULT_LLM_CONFIG);
    const [status, setStatus] = useState<string>('');
    const [isProcessing, setIsProcessing] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        const [p, pr, l] = await Promise.all([
            StorageService.getProfiles(),
            StorageService.getPreferences(),
            StorageService.getLLMConfig()
        ]);
        setProfiles(p);
        setPrefs(pr);
        setLlmConfig(l);
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        const file = e.target.files[0];

        setIsProcessing(true);
        setStatus('Extracting text...');

        try {
            const text = await extractText(file);
            setStatus('Analyzing with LLM (this may take a moment)...');

            // Call LLM to parse
            const prompt = getCVProfilePrompt(text);
            const jsonStr = await callLLM({
                variant: 'big',
                messages: prompt,
                temperature: 0
            });

            const parsed = JSON.parse(cleanJsonString(jsonStr));

            const newProfile: UserProfile = {
                id: crypto.randomUUID(),
                cv_name: file.name,
                raw_text: text,
                last_updated: Date.now(),
                ...parsed
            };

            await StorageService.saveProfile(newProfile);
            await StorageService.setDefaultProfileId(newProfile.id);
            setProfiles([...profiles, newProfile]);
            setStatus('CV processed and saved!');
        } catch (err: any) {
            console.error(err);
            setStatus(`Error: ${err.message}`);
        } finally {
            setIsProcessing(false);
        }
    };

    const savePrefs = async () => {
        await StorageService.savePreferences(prefs);
        setStatus('Preferences saved.');
    };

    const saveLLM = async () => {
        await StorageService.saveLLMConfig(llmConfig);
        setStatus('LLM Config saved.');
    };

    return (
        <div className="container">
            <h1>Job Helper Settings</h1>

            <div className="tabs">
                <button className={activeTab === 'llm' ? 'active' : ''} onClick={() => setActiveTab('llm')}>LLM Config</button>
                <button className={activeTab === 'cv' ? 'active' : ''} onClick={() => setActiveTab('cv')}>CV & Profile</button>
                <button className={activeTab === 'prefs' ? 'active' : ''} onClick={() => setActiveTab('prefs')}>Preferences</button>
            </div>

            {status && <div className="status-bar">{status}</div>}

            {activeTab === 'llm' && (
                <div className="section">
                    <h2>LLM Configuration</h2>
                    <div className="form-group">
                        <label>Mode</label>
                        <select
                            value={llmConfig.mode}
                            onChange={e => setLlmConfig({ ...llmConfig, mode: e.target.value as any })}
                        >
                            <option value="local">Local (Ollama)</option>
                            <option value="api">API Provider</option>
                        </select>
                    </div>

                    {llmConfig.mode === 'local' && (
                        <div className="form-group">
                            <label>Ollama Base URL</label>
                            <input
                                type="text"
                                value={llmConfig.ollama.baseUrl}
                                onChange={e => setLlmConfig({ ...llmConfig, ollama: { ...llmConfig.ollama, baseUrl: e.target.value } })}
                            />
                        </div>
                    )}

                    {llmConfig.mode === 'api' && (
                        <>
                            <div className="form-group">
                                <label>Provider</label>
                                <select
                                    value={llmConfig.provider || ''}
                                    onChange={e => setLlmConfig({ ...llmConfig, provider: e.target.value as any })}
                                >
                                    <option value="">Select Provider</option>
                                    <option value="openai">OpenAI</option>
                                    <option value="groq">Groq</option>
                                    <option value="gemini">Gemini</option>
                                </select>
                            </div>

                            {llmConfig.provider === 'openai' && (
                                <div className="form-group">
                                    <label>OpenAI API Key</label>
                                    <input
                                        type="password"
                                        value={llmConfig.apiKeys.openai || ''}
                                        onChange={e => setLlmConfig({ ...llmConfig, apiKeys: { ...llmConfig.apiKeys, openai: e.target.value } })}
                                    />
                                </div>
                            )}
                            {llmConfig.provider === 'groq' && (
                                <div className="form-group">
                                    <label>Groq API Key</label>
                                    <input
                                        type="password"
                                        value={llmConfig.apiKeys.groq || ''}
                                        onChange={e => setLlmConfig({ ...llmConfig, apiKeys: { ...llmConfig.apiKeys, groq: e.target.value } })}
                                    />
                                </div>
                            )}
                            {llmConfig.provider === 'gemini' && (
                                <div className="form-group">
                                    <label>Gemini API Key</label>
                                    <input
                                        type="password"
                                        value={llmConfig.apiKeys.gemini || ''}
                                        onChange={e => setLlmConfig({ ...llmConfig, apiKeys: { ...llmConfig.apiKeys, gemini: e.target.value } })}
                                    />
                                </div>
                            )}
                        </>
                    )}

                    <div className="form-group">
                        <label>Big Model Name (e.g. llama3:70b, gpt-4)</label>
                        <input
                            type="text"
                            value={llmConfig.models.bigModel}
                            onChange={e => setLlmConfig({ ...llmConfig, models: { ...llmConfig.models, bigModel: e.target.value } })}
                        />
                    </div>
                    <div className="form-group">
                        <label>Small Model Name (e.g. llama3:8b, gpt-3.5-turbo)</label>
                        <input
                            type="text"
                            value={llmConfig.models.smallModel}
                            onChange={e => setLlmConfig({ ...llmConfig, models: { ...llmConfig.models, smallModel: e.target.value } })}
                        />
                    </div>

                    <button onClick={saveLLM}>Save Configuration</button>
                </div>
            )}

            {activeTab === 'cv' && (
                <div className="section">
                    <h2>CV Management</h2>
                    <div className="upload-box">
                        <label>Upload New CV (Text/PDF)</label>
                        <input type="file" accept=".txt,.pdf,.md" onChange={handleFileUpload} disabled={isProcessing} />
                        {isProcessing && <p>Processing... Please wait.</p>}
                    </div>

                    <div className="profile-list">
                        <h3>Saved Profiles</h3>
                        {profiles.map(p => (
                            <div key={p.id} className="profile-card">
                                <strong>{p.cv_name}</strong>
                                <p>{p.summary.substring(0, 100)}...</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {activeTab === 'prefs' && (
                <div className="section">
                    <h2>Preferences</h2>
                    <div className="form-group">
                        <label>Preferred Role Titles (comma separated)</label>
                        <input
                            type="text"
                            value={prefs.preferred_role_titles.join(', ')}
                            onChange={e => setPrefs({ ...prefs, preferred_role_titles: e.target.value.split(',').map(s => s.trim()) })}
                        />
                    </div>
                    <div className="form-group">
                        <label>Preferred Locations (comma separated)</label>
                        <input
                            type="text"
                            value={prefs.preferred_locations.join(', ')}
                            onChange={e => setPrefs({ ...prefs, preferred_locations: e.target.value.split(',').map(s => s.trim()) })}
                        />
                    </div>
                    <div className="form-group checkbox">
                        <label>
                            <input
                                type="checkbox"
                                checked={prefs.remote_only}
                                onChange={e => setPrefs({ ...prefs, remote_only: e.target.checked })}
                            />
                            Remote Only
                        </label>
                    </div>
                    <div className="form-group checkbox">
                        <label>
                            <input
                                type="checkbox"
                                checked={prefs.relocation_ok}
                                onChange={e => setPrefs({ ...prefs, relocation_ok: e.target.checked })}
                            />
                            Open to Relocation
                        </label>
                    </div>
                    <div className="form-group">
                        <label>Min Salary</label>
                        <input
                            type="number"
                            value={prefs.salary_min}
                            onChange={e => setPrefs({ ...prefs, salary_min: Number(e.target.value) })}
                        />
                    </div>
                    <div className="form-group">
                        <label>Currency</label>
                        <input
                            type="text"
                            value={prefs.currency}
                            onChange={e => setPrefs({ ...prefs, currency: e.target.value })}
                        />
                    </div>

                    <button onClick={savePrefs}>Save Preferences</button>
                </div>
            )}
        </div>
    );
};

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <Options />
    </React.StrictMode>
);
