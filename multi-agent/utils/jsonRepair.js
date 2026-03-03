'use strict';
const Anthropic = require('@anthropic-ai/sdk');
const client = new Anthropic();

/**
 * Parsea un JSON de forma robusta:
 * 1. Intenta parsear directamente
 * 2. Extrae entre { } o [ ]
 * 3. Si hay truncación ("Unterminated string"), usa Claude para completar el JSON
 */
async function parseJsonRobust(text, agentId = 'AGENT', inputData = null, systemPrompt = '') {
    // 1. Limpiar markdown
    let cleaned = text.trim();
    const codeBlock = cleaned.match(/```json\s*([\s\S]*?)```/);
    if (codeBlock) cleaned = codeBlock[1].trim();

    // 2. Intentar parseo directo
    try {
        return JSON.parse(cleaned);
    } catch (e) {
        // 3. Extraer entre llaves
        const first = cleaned.indexOf('{');
        const last = cleaned.lastIndexOf('}');
        if (first !== -1 && last !== -1) {
            try {
                return JSON.parse(cleaned.substring(first, last + 1));
            } catch (_) { }
        }

        // 4. JSON truncado — usar continuación de Claude para completar
        if (e.message && (e.message.includes('Unterminated') || e.message.includes('position'))) {
            console.warn(`[${agentId}] JSON truncat detectat. Intentant reparació via Claude...`);
            return repairTruncatedJson(cleaned, agentId, inputData, systemPrompt);
        }

        // 5. Fallback: reintentar con prompt estricto
        if (inputData) {
            return retryStrictPrompt(agentId, inputData, systemPrompt, text);
        }

        throw new Error(`[${agentId}] JSON invàlid: ${e.message}`);
    }
}

/**
 * Usa la API de Claude con "prefill" del assistant para continuar un JSON truncado.
 */
async function repairTruncatedJson(truncatedText, agentId, inputData, systemPrompt) {
    try {
        // El text truncado es el inicio del output de l'assistant
        // Li diem a Claude que continuï des d'on es va quedar
        const repairMsg = await client.messages.create({
            model: 'claude-sonnet-4-6',
            max_tokens: 8192,
            temperature: 0,
            system: systemPrompt || 'Ets un assistent que completa JSON truncat. Continua el JSON exactament des d\'on s\'ha tallat, sense repetir el contingut anterior.',
            messages: [
                {
                    role: 'user',
                    content: `El siguiente JSON quedó incompleto/truncado. Complétalo desde donde se cortó y devuelve ÚNICAMENTE el fragmento que falta para que sea JSON válido (NO repitas el contenido que ya existe):\n\nJSON TRUNCADO:\n${truncatedText.substring(0, 8000)}`
                }
            ]
        });

        const continuation = repairMsg.content
            .filter(b => b.type === 'text')
            .map(b => b.text)
            .join('');

        const combined = truncatedText + continuation;

        // Intentar parsear el resultado combinado
        try {
            return JSON.parse(combined);
        } catch (_) {
            // Si sigue fallando, buscar JSON bien formado en el resultado combinado
            const first = combined.indexOf('{');
            const last = combined.lastIndexOf('}');
            if (first !== -1 && last !== -1) {
                return JSON.parse(combined.substring(first, last + 1));
            }
        }
    } catch (repairErr) {
        console.warn(`[${agentId}] Reparació fallida: ${repairErr.message}`);
    }

    // Último recurso: retry con prompt estricto y datos reducidos
    if (inputData) return retryStrictPrompt(agentId, inputData, systemPrompt, truncatedText);
    throw new Error(`[${agentId}] No s'ha pogut reparar el JSON truncat`);
}

/**
 * Reintenta la llamada con un prompt más estricto y datos resumidos.
 */
async function retryStrictPrompt(agentId, inputData, systemPrompt, previousOutput = '') {
    console.log(`[${agentId}] Reintentant amb prompt estricte i max_tokens reduïts per assegurar JSON complet...`);
    const message = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 8192,
        temperature: 0.1,
        system: systemPrompt || 'Responde ÚNICAMENTE con JSON válido, sin markdown ni texto adicional.',
        messages: [
            {
                role: 'user',
                content: `Responde ÚNICAMENTE con un objeto JSON válido y completo. Sin markdown. Sin texto adicional. El JSON debe estar completamente cerrado.\n\nDatos:\n${JSON.stringify(inputData, null, 2).substring(0, 4000)}`
            }
        ]
    });
    const text = message.content.filter(b => b.type === 'text').map(b => b.text).join('');
    const cleaned = text.replace(/```json\s*|```/g, '').trim();
    return JSON.parse(cleaned);
}

module.exports = { parseJsonRobust };
