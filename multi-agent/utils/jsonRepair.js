'use strict';
const Anthropic = require('@anthropic-ai/sdk');
const client = new Anthropic();

/**
 * Detecta si un texto JSON está truncado comprobando:
 * - Número de { sin cerrar o [ sin cerrar
 * - Cadenas de texto abiertas (número impar de " no escapadas fuera de contexto)
 */
function detectTruncation(text) {
    let braces = 0;
    let brackets = 0;
    let inString = false;
    let escaped = false;

    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (escaped) { escaped = false; continue; }
        if (ch === '\\' && inString) { escaped = true; continue; }
        if (ch === '"') { inString = !inString; continue; }
        if (inString) continue;
        if (ch === '{') braces++;
        else if (ch === '}') braces--;
        else if (ch === '[') brackets++;
        else if (ch === ']') brackets--;
    }

    // Truncado si hay strings sin cerrar o estructuras sin cerrar
    return inString || braces > 0 || brackets > 0;
}

/**
 * Extraer JSON bien formado entre el primer { y el último } válido.
 * Esto es seguro SOLO si el JSON no está truncado.
 */
function extractJsonBlock(text) {
    const first = text.indexOf('{');
    const firstArr = text.indexOf('[');
    // Preferir el primero que aparezca
    const start = (first === -1) ? firstArr :
        (firstArr === -1) ? first :
            Math.min(first, firstArr);
    if (start === -1) return null;

    const isObj = text[start] === '{';
    const openChar = isObj ? '{' : '[';
    const closeChar = isObj ? '}' : ']';

    let depth = 0;
    let inString = false;
    let escaped = false;
    let endPos = -1;

    for (let i = start; i < text.length; i++) {
        const ch = text[i];
        if (escaped) { escaped = false; continue; }
        if (ch === '\\' && inString) { escaped = true; continue; }
        if (ch === '"') { inString = !inString; continue; }
        if (inString) continue;
        if (ch === openChar) depth++;
        else if (ch === closeChar) {
            depth--;
            if (depth === 0) { endPos = i; break; }
        }
    }

    if (endPos === -1) return null;
    return text.substring(start, endPos + 1);
}

/**
 * Parsea un JSON de forma robusta:
 * 1. Limpiar markdown
 * 2. Intentar parseo directo
 * 3. Extraer bloque JSON válido (si no hay truncación)
 * 4. Si hay truncación → continuar con Claude
 * 5. Fallback: retry con prompt estricto
 */
async function parseJsonRobust(text, agentId = 'AGENT', inputData = null, systemPrompt = '') {
    // 1. Limpiar markdown
    let cleaned = text.trim();
    const codeBlock = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlock) cleaned = codeBlock[1].trim();

    // 2. Intentar parseo directo
    try {
        return JSON.parse(cleaned);
    } catch (_) { /* continuar */ }

    // 3. Detectar si hay truncación
    const truncated = detectTruncation(cleaned);

    if (!truncated) {
        // Intentar extraer el bloque JSON válido
        const block = extractJsonBlock(cleaned);
        if (block) {
            try {
                return JSON.parse(block);
            } catch (_) { /* continuar */ }
        }
    }

    // 4. JSON truncado o inválido → reparación via Claude
    console.warn(`[${agentId}] JSON invàlid/truncat detectat (truncat=${truncated}). Reparant via Claude...`);
    try {
        return await repairTruncatedJson(cleaned, agentId, inputData, systemPrompt);
    } catch (repairErr) {
        console.warn(`[${agentId}] Reparació fallida: ${repairErr.message}`);
    }

    // 5. Último recurso: retry con prompt estricto
    if (inputData) {
        return retryStrictPrompt(agentId, inputData, systemPrompt);
    }

    throw new Error(`[${agentId}] No s'ha pogut parsejar el JSON després de tots els intents`);
}

/**
 * Usa Claude para completar un JSON truncado usando la técnica de prefill del assistant.
 */
async function repairTruncatedJson(truncatedText, agentId, inputData, systemPrompt) {
    // Limitar el texto truncado a 10000 chars para no exceder context
    const snippet = truncatedText.substring(0, 10000);

    const repairMsg = await client.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 8192,
        temperature: 0,
        system: 'Ets un assistent expert en reparació de JSON. El teu únic treball és completar el JSON truncat. Respon ÚNICAMENT amb el fragment que falta (el que cal afegir al final) per tancar el JSON correctament. Sense cap explicació ni text addicional.',
        messages: [
            {
                role: 'user',
                content: `El siguiente JSON está incompleto (truncado). Devuelve ÚNICAMENTE el fragmento de texto que falta al final para que el JSON sea válido y completo. No repitas nada del JSON ya existente.\n\nJSON TRUNCADO:\n${snippet}`
            }
        ]
    });

    const continuation = repairMsg.content
        .filter(b => b.type === 'text')
        .map(b => b.text)
        .join('');

    const combined = truncatedText + continuation;

    // Intentar parsear directo
    try {
        return JSON.parse(combined);
    } catch (_) { /* continuar */ }

    // Intentar extraer bloque válido
    const block = extractJsonBlock(combined);
    if (block) {
        return JSON.parse(block);
    }

    throw new Error(`[${agentId}] La continuació de Claude no ha generat un JSON vàlid`);
}

/**
 * Reintenta la llamada al agente con un prompt más estricto y datos resumidos.
 */
async function retryStrictPrompt(agentId, inputData, systemPrompt) {
    console.log(`[${agentId}] Reintentant amb prompt estricte...`);
    const message = await client.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 8192,
        temperature: 0,
        system: systemPrompt || 'Responde ÚNICAMENTE con JSON válido y completo, sin markdown ni texto adicional.',
        messages: [
            {
                role: 'user',
                content: `Genera un JSON válido y COMPLETO (con todas las llaves cerradas). Sin markdown. Sin texto adicional.\n\nDatos:\n${JSON.stringify(inputData, null, 2).substring(0, 3000)}`
            }
        ]
    });
    const text = message.content.filter(b => b.type === 'text').map(b => b.text).join('');
    const cleaned = text.replace(/```json\s*|```/g, '').trim();
    return JSON.parse(cleaned);
}

module.exports = { parseJsonRobust };
