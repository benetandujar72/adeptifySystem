'use strict';
const Anthropic = require('@anthropic-ai/sdk');

/**
 * Wrapper for LLM calls (Claude first, fallback to Gemini).
 * 
 * @param {string} systemPrompt 
 * @param {string|Array} messages - Si es string, es el contenido 'user'. Si es array, pasa directo a 'messages'.
 * @param {string} agentId 
 * @param {number} temperature 
 * @param {function} updateTokens - callback (usage, agentId) => void
 * @param {number} maxTokens 
 * @returns {string} El texto generado
 */
async function callLLM(systemPrompt, messages, agentId, temperature, updateTokens, maxTokens = 8192) {
    let lastError = null;

    // Formato de mensajes
    const claudeMessages = Array.isArray(messages) ? messages : [{ role: 'user', content: messages }];

    // 1. Intentar Claude
    const anthropicKey = (process.env.ANTHROPIC_API_KEY || '').trim();
    if (anthropicKey) {
        try {
            const client = new Anthropic({ apiKey: anthropicKey, timeout: 60000 });
            const message = await client.messages.create({
                model: 'claude-sonnet-4-5-20250514',
                max_tokens: maxTokens,
                temperature: temperature,
                system: systemPrompt,
                messages: claudeMessages
            });

            if (typeof updateTokens === 'function') updateTokens(message.usage, agentId);

            return message.content
                .filter((block) => block.type === 'text')
                .map((block) => block.text)
                .join('\n');
        } catch (e) {
            console.warn(`[${agentId}] Claude error: ${e.message} - Fallback a Gemini...`);
            lastError = e;
        }
    } else {
        console.warn(`[${agentId}] No ANTHROPIC_API_KEY - Fallback a Gemini...`);
    }

    // 2. Fallback Gemini
    const apiKey = (process.env.GEMINI_API_KEY || '').trim();
    if (!apiKey) throw new Error(`[${agentId}] Missing both ANTHROPIC_API_KEY and GEMINI_API_KEY`);

    const modelsToTry = [
        "gemini-2.0-flash",
        "gemini-2.5-flash",
        "gemini-2.5-pro",
    ];

    // Convertir messages al formato de Gemini
    const geminiContents = claudeMessages.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
    }));

    for (const model of modelsToTry) {
        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    systemInstruction: { parts: [{ text: systemPrompt }] },
                    contents: geminiContents,
                    generationConfig: { temperature: temperature, maxOutputTokens: maxTokens }
                })
            });

            const data = await response.json();
            if (data.error) {
                lastError = new Error(data.error.message);
                continue;
            }
            if (!data.candidates?.length) {
                lastError = new Error(`${model} returned no candidates`);
                continue;
            }

            const candidate = data.candidates[0];
            const textPart = candidate.content?.parts?.find(p => typeof p.text === 'string' && p.text.trim().length > 0);
            if (!textPart) {
                lastError = new Error(`Gemini ${model}: no text part in response`);
                continue;
            }

            // Dummy usage update para no romper el orquestador
            if (typeof updateTokens === 'function') {
                updateTokens({ input_tokens: 0, output_tokens: 0 }, agentId);
            }

            return textPart.text;
        } catch (err) {
            lastError = err;
        }
    }

    throw lastError || new Error(`[${agentId}] Todos los intentos de Gemini han fallado.`);
}

module.exports = { callLLM };
