// File: src/options/Options.tsx
import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { StorageService } from '../storage/storage';
import { UserProfile, UserPreferences, LLMConfig, DEFAULT_LLM_CONFIG, DEFAULT_PREFERENCES } from '../storage/schema';
import { callLLM } from '../llm/providers';
import { getCVProfilePrompt } from '../llm/prompts/cvProfilePrompt';
import './Options.css';
import { getExtensionAssetUrl } from '../utils/assetPaths';
import { Settings, FileText, Sliders, UploadCloud, Save } from 'lucide-react';

// Import pdfjs-dist
import * as pdfjsLib from 'pdfjs-dist';
// @ts-ignore
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

const appIcon = getExtensionAssetUrl('icons/sir-fills-a-lot-app-icon.png');
const profileIconAlt2 = getExtensionAssetUrl('icons/sir-fills-a-lot-app-icon-2.png');
const profileIconAlt4 = getExtensionAssetUrl('icons/sir-fills-a-lot-app-icon-4.png');
const profileIconAlt6 = getExtensionAssetUrl('icons/sir-fills-a-lot-app-icon-6.png');
const mascotIcon = getExtensionAssetUrl('icons/sir-fills-a-lot-app-mascot-idle-icon.png');

const profileIconPool = [appIcon, profileIconAlt2, profileIconAlt4, profileIconAlt6];

const getProfileIcon = (profile: UserProfile, index: number) => {
    const seed = (profile.id || profile.cv_name || `profile-${index}`) + index;
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
        hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
    }
    return profileIconPool[hash % profileIconPool.length];
};

const formatProfileDate = (timestamp?: number) => {
    if (!timestamp) return 'Never updated';
    try {
        return new Date(timestamp).toLocaleDateString();
    } catch {
        return 'Never updated';
    }
};

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
    const [defaultProfileId, setDefaultProfileId] = useState<string | null>(null);
    const [salaryMinInput, setSalaryMinInput] = useState('');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        const [p, pr, l, defaultId] = await Promise.all([
            StorageService.getProfiles(),
            StorageService.getPreferences(),
            StorageService.getLLMConfig(),
            StorageService.getDefaultProfileId()
        ]);
        setProfiles(p);
        setPrefs(pr);
        setSalaryMinInput(pr.salary_min ? String(pr.salary_min) : '');
        setLlmConfig(l);
        setDefaultProfileId(defaultId || (p[0]?.id ?? null));
    };

    const updateProfile = (profile: UserProfile, changes: Partial<UserProfile>) => {
        const updated = { ...profile, ...changes, last_updated: Date.now() };
        StorageService.saveProfile(updated).then(loadData);
    };

    const handleSetDefaultProfile = async (profileId: string) => {
        await StorageService.setDefaultProfileId(profileId);
        setDefaultProfileId(profileId);
    };

    const handleSalaryMinInputChange = (value: string) => {
        const sanitized = value.replace(/[^\d]/g, '');
        setSalaryMinInput(sanitized);
        setPrefs(prev => ({ ...prev, salary_min: sanitized === '' ? 0 : Number(sanitized) }));
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

            // Read file as Base64 for storage
            const getBase64 = (file: File): Promise<string> => {
                return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.readAsDataURL(file);
                    reader.onload = () => resolve(reader.result as string);
                    reader.onerror = error => reject(error);
                });
            };

            const base64Data = await getBase64(file);

            const newProfile: UserProfile = {
                id: crypto.randomUUID(),
                cv_name: file.name,
                raw_text: text,
                last_updated: Date.now(),
                resume_data: base64Data,
                resume_name: file.name,
                ...parsed
            };

            await StorageService.saveProfile(newProfile);
            await StorageService.setDefaultProfileId(newProfile.id);
            setProfiles(prev => [...prev, newProfile]);
            setDefaultProfileId(newProfile.id);
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
            <header className="options-header">
                <div className="header-content">
                    <div className="brand-badge">
                        <img src={appIcon} alt="Sir Fills-A-Lot" />
                    </div>
                    <div className="header-text">
                        <h1>Sir Fills-A-Lot Settings</h1>
                        <p>Configure your knight, CVs, and job preferences.</p>
                    </div>
                </div>
            </header>

            <div className="tabs-container">
                <div className="tabs">
                    <button className={activeTab === 'llm' ? 'active' : ''} onClick={() => setActiveTab('llm')}>
                        <Settings size={16} /> LLM Config
                    </button>
                    <button className={activeTab === 'cv' ? 'active' : ''} onClick={() => setActiveTab('cv')}>
                        <FileText size={16} /> CV & Profile
                    </button>
                    <button className={activeTab === 'prefs' ? 'active' : ''} onClick={() => setActiveTab('prefs')}>
                        <Sliders size={16} /> Preferences
                    </button>
                </div>
            </div>

            <div className="content-area">
                {status && <div className="status-bar">{status}</div>}

                {activeTab === 'llm' && (
                    <div className="section card">
                        <div className="card-header">
                            <h2>LLM Configuration</h2>
                        </div>
                        <div className="card-body">
                            <div className="form-group">
                                <label>Mode</label>
                                <div className="radio-group">
                                    <label className="radio-label">
                                        <input
                                            type="radio"
                                            value="local"
                                            checked={llmConfig.mode === 'local'}
                                            onChange={() => setLlmConfig({ ...llmConfig, mode: 'local' })}
                                        />
                                        Local (Ollama)
                                    </label>
                                    <label className="radio-label">
                                        <input
                                            type="radio"
                                            value="api"
                                            checked={llmConfig.mode === 'api'}
                                            onChange={() => setLlmConfig({ ...llmConfig, mode: 'api' })}
                                        />
                                        API Provider
                                    </label>
                                </div>
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
                                <div className="api-config">
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
                                </div>
                            )}

                            <div className="model-config">
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
                            </div>

                            <button onClick={saveLLM} className="btn-primary">
                                <Save size={16} /> Save Configuration
                            </button>
                        </div>
                    </div>
                )}

                {activeTab === 'cv' && (
                    <div className="section">
                        <div className="card upload-card">
                            <div className="upload-content">
                                <img src={mascotIcon} alt="Mascot" className="mascot-inline" />
                                <div className="upload-text">
                                    <h3>Upload New CV</h3>
                                    <p>Drop your CV here or click to upload. PDF or text supported.</p>
                                </div>
                                <label className="upload-btn">
                                    <UploadCloud size={20} />
                                    <span>Select File</span>
                                    <input type="file" accept=".txt,.pdf,.md" onChange={handleFileUpload} disabled={isProcessing} hidden />
                                </label>
                            </div>
                            {isProcessing && <div className="processing-indicator">Processing... Please wait.</div>}
                        </div>

                        <div className="profile-list">
                            <h3>Saved Profiles</h3>
                            {profiles.map((p, index) => {
                                const rolesPreview = (p.preferred_roles || []).filter(role => !!role).slice(0, 3);
                                return (
                                    <div key={p.id} className="profile-card card">
                                        <div className="profile-header">
                                            <div className="profile-title">
                                                <div className="profile-icon">
                                                    <img src={getProfileIcon(p, index)} alt={`${p.cv_name} icon`} />
                                                </div>
                                                <div className="profile-title-text">
                                                    <strong>{p.cv_name}</strong>
                                                    <span className="profile-updated">Updated {formatProfileDate(p.last_updated)}</span>
                                                </div>
                                            </div>
                                            <div className="profile-actions">
                                                {defaultProfileId === p.id && <span className="badge-default">Default</span>}
                                                <button
                                                    className={`btn-subtle${defaultProfileId === p.id ? ' active' : ''}`}
                                                    onClick={() => handleSetDefaultProfile(p.id)}
                                                >
                                                    {defaultProfileId === p.id ? 'Active' : 'Make Default'}
                                                </button>
                                            </div>
                                        </div>

                                        <div className="profile-meta">
                                            <div className="profile-meta-item">
                                                <span className="meta-label">Location</span>
                                                <span className="meta-value">{p.location || 'Not set'}</span>
                                            </div>
                                            <div className="profile-meta-item stretch">
                                                <span className="meta-label">Focus Roles</span>
                                                <div className="profile-tags">
                                                    {rolesPreview.length > 0 ? (
                                                        rolesPreview.map((role, roleIndex) => (
                                                            <span key={`${role}-${roleIndex}`} className="profile-tag">{role}</span>
                                                        ))
                                                    ) : (
                                                        <span className="profile-tag muted">Add preferred roles to this CV</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="profile-details-form">
                                            <div className="profile-details-group">
                                                <div className="profile-group-title">Contact Details</div>
                                                <div className="profile-fields-grid">
                                                    <label className="profile-field">
                                                        <span className="profile-field-label">Full Name</span>
                                                        <input
                                                            type="text"
                                                            value={p.full_name || ''}
                                                            onChange={e => updateProfile(p, { full_name: e.target.value })}
                                                            placeholder="Jane Appleseed"
                                                        />
                                                    </label>
                                                    <label className="profile-field">
                                                        <span className="profile-field-label">Email</span>
                                                        <input
                                                            type="email"
                                                            value={p.email || ''}
                                                            onChange={e => updateProfile(p, { email: e.target.value })}
                                                            placeholder="jane@example.com"
                                                        />
                                                    </label>
                                                    <label className="profile-field">
                                                        <span className="profile-field-label">Phone</span>
                                                        <input
                                                            type="text"
                                                            value={p.phone || ''}
                                                            onChange={e => updateProfile(p, { phone: e.target.value })}
                                                            placeholder="+1 555 123 4567"
                                                        />
                                                    </label>
                                                </div>
                                            </div>

                                            <div className="profile-details-group">
                                                <div className="profile-group-title">Links</div>
                                                <div className="profile-fields-grid">
                                                    <label className="profile-field">
                                                        <span className="profile-field-label">LinkedIn</span>
                                                        <input
                                                            type="text"
                                                            value={p.linkedin || ''}
                                                            onChange={e => updateProfile(p, { linkedin: e.target.value })}
                                                            placeholder="linkedin.com/in/..."
                                                        />
                                                    </label>
                                                    <label className="profile-field">
                                                        <span className="profile-field-label">GitHub</span>
                                                        <input
                                                            type="text"
                                                            value={p.github || ''}
                                                            onChange={e => updateProfile(p, { github: e.target.value })}
                                                            placeholder="github.com/username"
                                                        />
                                                    </label>
                                                    <label className="profile-field">
                                                        <span className="profile-field-label">Portfolio</span>
                                                        <input
                                                            type="text"
                                                            value={p.portfolio || ''}
                                                            onChange={e => updateProfile(p, { portfolio: e.target.value })}
                                                            placeholder="https://"
                                                        />
                                                    </label>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {activeTab === 'prefs' && (
                    <div className="section card">
                        <div className="card-header">
                            <h2>Preferences</h2>
                        </div>
                        <div className="card-body">
                            <div className="prefs-group">
                                <h3>Roles & Locations</h3>
                                <div className="form-group">
                                    <label>Preferred Role Titles (comma separated)</label>
                                    <input
                                        type="text"
                                        defaultValue={prefs.preferred_role_titles.join(', ')}
                                        onBlur={e => setPrefs({ ...prefs, preferred_role_titles: e.target.value.split(',').map(s => s.trim()) })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Preferred Locations (comma separated)</label>
                                    <input
                                        type="text"
                                        defaultValue={prefs.preferred_locations.join(', ')}
                                        onBlur={e => setPrefs({ ...prefs, preferred_locations: e.target.value.split(',').map(s => s.trim()) })}
                                    />
                                </div>
                            </div>

                            <div className="prefs-group">
                                <h3>Work Style</h3>
                                <div className="checkbox-row">
                                    <label className="checkbox-label">
                                        <input
                                            type="checkbox"
                                            checked={prefs.remote_only}
                                            onChange={e => setPrefs({ ...prefs, remote_only: e.target.checked })}
                                        />
                                        Remote Only
                                    </label>
                                    <label className="checkbox-label">
                                        <input
                                            type="checkbox"
                                            checked={prefs.relocation_ok}
                                            onChange={e => setPrefs({ ...prefs, relocation_ok: e.target.checked })}
                                        />
                                        Open to Relocation
                                    </label>
                                </div>
                            </div>

                            <div className="prefs-group">
                                <h3>Compensation</h3>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Min Salary</label>
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            pattern="[0-9]*"
                                            value={salaryMinInput}
                                            onChange={e => handleSalaryMinInputChange(e.target.value)}
                                            placeholder="e.g. 120000"
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
                                </div>
                            </div>

                            <button onClick={savePrefs} className="btn-primary">
                                <Save size={16} /> Save Preferences
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <Options />
    </React.StrictMode>
);
