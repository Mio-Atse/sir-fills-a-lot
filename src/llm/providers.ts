// File: src/llm/providers.ts
import { StorageService } from '../storage/storage';
import { LLMConfig } from '../storage/schema';

export interface LLMMessage {
    role: "system" | "user" | "assistant";
    content: string;
}

export interface LLMRequestOptions {
    variant: "big" | "small";
    messages: LLMMessage[];
    temperature?: number;
    maxTokens?: number;
}

async function callOllama(config: LLMConfig, model: string, messages: LLMMessage[], options: LLMRequestOptions): Promise<string> {
    const baseUrl = config.ollama.baseUrl.replace(/\/$/, '');
    const response = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: model,
            messages: messages,
            stream: false,
            options: {
                temperature: options.temperature,
                num_predict: options.maxTokens
            }
        })
    });

    if (!response.ok) {
        throw new Error(`Ollama API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.message.content;
}

async function callOpenAI(apiKey: string, model: string, messages: LLMMessage[], options: LLMRequestOptions): Promise<string> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: model,
            messages: messages,
            temperature: options.temperature,
            max_tokens: options.maxTokens
        })
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`OpenAI API error: ${err}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
}

async function callGroq(apiKey: string, model: string, messages: LLMMessage[], options: LLMRequestOptions): Promise<string> {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: model,
            messages: messages,
            temperature: options.temperature,
            max_tokens: options.maxTokens
        })
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`Groq API error: ${err}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
}

async function callGemini(apiKey: string, model: string, messages: LLMMessage[], options: LLMRequestOptions): Promise<string> {
    // Gemini API structure is slightly different
    const contents = messages.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
    }));

    // Filter out system messages for Gemini as it handles them differently or not at all in standard chat
    // For simplicity, we prepend system message to the first user message or use specific config if available
    // Here we just merge system into first user message if present
    const systemMsg = messages.find(m => m.role === 'system');
    let finalContents = contents.filter(c => c.role !== 'system');

    if (systemMsg && finalContents.length > 0) {
        finalContents[0].parts[0].text = `${systemMsg.content}\n\n${finalContents[0].parts[0].text}`;
    }

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: finalContents,
            generationConfig: {
                temperature: options.temperature,
                maxOutputTokens: options.maxTokens
            }
        })
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`Gemini API error: ${err}`);
    }

    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
}

export async function callLLM(opts: LLMRequestOptions): Promise<string> {
    const config = await StorageService.getLLMConfig();
    const model =
        config.mode === 'local'
            ? config.models.bigModel
            : (opts.variant === 'big' ? config.models.bigModel : config.models.smallModel);

    if (config.mode === 'local') {
        return callOllama(config, model, opts.messages, opts);
    } else {
        if (!config.consentToSendData) {
            throw new Error("Cloud LLM calls are blocked until you enable data-sharing consent in the options page.");
        }
        if (!config.provider) throw new Error("No LLM provider selected");

        switch (config.provider) {
            case 'openai':
                if (!config.apiKeys.openai) throw new Error("OpenAI API key missing");
                return callOpenAI(config.apiKeys.openai, model, opts.messages, opts);
            case 'groq':
                if (!config.apiKeys.groq) throw new Error("Groq API key missing");
                return callGroq(config.apiKeys.groq, model, opts.messages, opts);
            case 'gemini':
                if (!config.apiKeys.gemini) throw new Error("Gemini API key missing");
                return callGemini(config.apiKeys.gemini, model, opts.messages, opts);
            default:
                throw new Error(`Unsupported provider: ${config.provider}`);
        }
    }
}
