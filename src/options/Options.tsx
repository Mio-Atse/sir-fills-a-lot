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
    const [showCustomBig, setShowCustomBig] = useState(false);
    const [showCustomSmall, setShowCustomSmall] = useState(false);

    const MODEL_OPTIONS: Record<string, { big: string[]; small: string[] }> = {
        gemini: {
            big: ['gemini-3-pro-preview', 'gemini-2.5-pro', 'gemini-2.5-flash'],
            small: ['gemini-2.5-flash-lite'],
        },
        openai: {
            big: ['gpt-5.1', 'gpt-4.1', 'gpt-4o'],
            small: ['gpt-5-nano', 'gpt-oss-120b'],
        },
        groq: {
            big: ['moonshotai/kimi-k2-instruct-0905', 'openai/gpt-oss-120b', 'llama-3.3-70b-versatile'],
            small: ['llama-3.1-8b-instant', 'openai/gpt-oss-20b'],
        },
        ollama: {
            big: ['ollama run llama3:8b', 'ollama run qwen:14b', 'ollama run mistral:7b', 'ollama run phi3:3.8b-mini-instruct'],
            small: [],
        },
    };

    const providerKey = llmConfig.mode === 'local' ? 'ollama' : llmConfig.provider || '';

    useEffect(() => {
        const provider = providerKey;
        const opts = provider ? MODEL_OPTIONS[provider] : undefined;
        if (!opts) return;

        // Auto-select defaults if current values are empty
        if (!showCustomBig && (!llmConfig.models.bigModel || !opts.big.includes(llmConfig.models.bigModel))) {
            setLlmConfig(prev => ({ ...prev, models: { ...prev.models, bigModel: opts.big[0] } }));
        }
        if (provider !== 'ollama') {
            if (!showCustomSmall && (!llmConfig.models.smallModel || !opts.small.includes(llmConfig.models.smallModel))) {
                setLlmConfig(prev => ({ ...prev, models: { ...prev.models, smallModel: opts.small[0] } }));
            }
        } else {
            // For Ollama, small model is not used; mirror big to keep downstream logic simple
            setLlmConfig(prev => ({ ...prev, models: { ...prev.models, smallModel: prev.models.bigModel } }));
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [providerKey, showCustomBig, showCustomSmall]);

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

        const provider = l.mode === 'local' ? 'ollama' : l.provider || '';
        const opts = provider ? MODEL_OPTIONS[provider] : undefined;
        setShowCustomBig(!(opts?.big || []).includes(l.models.bigModel));
        setShowCustomSmall(provider === 'ollama' ? false : !(opts?.small || []).includes(l.models.smallModel));
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
        if (llmConfig.mode === 'api' && !llmConfig.consentToSendData) {
            setStatus('Please confirm data sharing consent before using cloud providers.');
            return;
        }
        const normalized =
            llmConfig.mode === 'local'
                ? { ...llmConfig, models: { ...llmConfig.models, smallModel: llmConfig.models.bigModel } }
                : llmConfig;
        await StorageService.saveLLMConfig(normalized);
        setLlmConfig(normalized);
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
                                            onChange={() => {
                                                const defaultBig = MODEL_OPTIONS.ollama.big[0];
                                                setShowCustomBig(false);
                                                setShowCustomSmall(false);
                                                setLlmConfig(prev => ({
                                                    ...prev,
                                                    mode: 'local',
                                                    provider: null,
                                                    models: { ...prev.models, bigModel: defaultBig, smallModel: defaultBig }
                                                }));
                                            }}
                                        />
                                        Local (Ollama)
                                    </label>
                                    <label className="radio-label">
                                        <input
                                            type="radio"
                                            value="api"
                                            checked={llmConfig.mode === 'api'}
                                            onChange={() => {
                                                setLlmConfig(prev => ({ ...prev, mode: 'api' }));
                                            }}
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
                                        onChange={e => {
                                            const provider = e.target.value as any;
                                            const defaults = MODEL_OPTIONS[provider] || { big: [''], small: [''] };
                                            const nextBig = defaults.big[0] || '';
                                            const nextSmall = defaults.small[0] || '';
                                            setShowCustomBig(false);
                                            setShowCustomSmall(false);
                                            setLlmConfig(prev => ({
                                                ...prev,
                                                provider,
                                                models: {
                                                    ...prev.models,
                                                    bigModel: nextBig || prev.models.bigModel,
                                                    smallModel: provider === 'ollama' ? nextBig || prev.models.bigModel : (nextSmall || prev.models.smallModel)
                                                }
                                            }));
                                        }}
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
                                    <div className="form-group">
                                        <label>Data Sharing Consent</label>
                                        <label className="checkbox-label">
                                            <input
                                                type="checkbox"
                                                checked={llmConfig.consentToSendData}
                                                onChange={e => setLlmConfig({ ...llmConfig, consentToSendData: e.target.checked })}
                                            />
                                            I understand my CV/profile and job descriptions will be sent to the selected cloud provider.
                                        </label>
                                    </div>
                                </div>
                            )}

                            <div className="model-config">
                                <div className="form-group">
                                    <label>Big Model</label>
                                    <div className="model-row">
                                        <select
                                            disabled={!providerKey}
                                            value={!showCustomBig ? llmConfig.models.bigModel : ''}
                                            onChange={e => {
                                                const value = e.target.value;
                                                setShowCustomBig(false);
                                                setLlmConfig(prev => ({
                                                    ...prev,
                                                    models: { ...prev.models, bigModel: value, smallModel: providerKey === 'ollama' ? value : prev.models.smallModel }
                                                }));
                                            }}
                                        >
                                            {(MODEL_OPTIONS[providerKey]?.big || []).map(option => (
                                                <option key={option} value={option}>{option}</option>
                                            ))}
                                        </select>
                                        <button
                                            type="button"
                                            className="btn-subtle"
                                            onClick={() => {
                                                const next = !showCustomBig;
                                                setShowCustomBig(next);
                                                if (!next && providerKey) {
                                                    const first = MODEL_OPTIONS[providerKey]?.big[0];
                                                    if (first) {
                                                        setLlmConfig(prev => ({
                                                            ...prev,
                                                            models: { ...prev.models, bigModel: first, smallModel: providerKey === 'ollama' ? first : prev.models.smallModel }
                                                        }));
                                                    }
                                                }
                                            }}
                                        >
                                            {showCustomBig ? 'Use dropdown' : 'Custom model'}
                                        </button>
                                    </div>
                                    {showCustomBig && (
                                        <input
                                            type="text"
                                            value={llmConfig.models.bigModel}
                                            onChange={e => {
                                                const val = e.target.value;
                                                setLlmConfig(prev => ({
                                                    ...prev,
                                                    models: { ...prev.models, bigModel: val, smallModel: providerKey === 'ollama' ? val : prev.models.smallModel }
                                                }));
                                            }}
                                            placeholder="Enter custom big model name"
                                        />
                                    )}
                                </div>

                                {providerKey !== 'ollama' && (
                                    <div className="form-group">
                                        <label>Small Model</label>
                                        <div className="model-row">
                                            <select
                                                disabled={!providerKey || showCustomSmall}
                                                value={!showCustomSmall ? llmConfig.models.smallModel : ''}
                                                onChange={e => {
                                                    const value = e.target.value;
                                                    setShowCustomSmall(false);
                                                    setLlmConfig(prev => ({
                                                        ...prev,
                                                        models: { ...prev.models, smallModel: value }
                                                    }));
                                                }}
                                            >
                                                {(MODEL_OPTIONS[providerKey]?.small || []).map(option => (
                                                    <option key={option} value={option}>{option}</option>
                                                ))}
                                            </select>
                                            <button
                                                type="button"
                                                className="btn-subtle"
                                                onClick={() => {
                                                    const next = !showCustomSmall;
                                                    setShowCustomSmall(next);
                                                    if (!next && providerKey) {
                                                        const first = MODEL_OPTIONS[providerKey]?.small[0];
                                                        if (first) {
                                                            setLlmConfig(prev => ({
                                                                ...prev,
                                                                models: { ...prev.models, smallModel: first }
                                                            }));
                                                        }
                                                    }
                                                }}
                                            >
                                                {showCustomSmall ? 'Use dropdown' : 'Custom model'}
                                            </button>
                                        </div>
                                        {showCustomSmall && (
                                            <input
                                                type="text"
                                                value={llmConfig.models.smallModel}
                                                onChange={e => setLlmConfig(prev => ({
                                                    ...prev,
                                                    models: { ...prev.models, smallModel: e.target.value }
                                                }))}
                                                placeholder="Enter custom small model name"
                                            />
                                        )}
                                    </div>
                                )}

                                {providerKey === 'ollama' && (
                                    <p className="muted">Small model selection is ignored for local mode; the chosen big model is used for all calls.</p>
                                )}
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
