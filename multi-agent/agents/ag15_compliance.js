'use strict';
const Anthropic = require('@anthropic-ai/sdk');
const path = require('path');
const fs = require('fs');
const { parseJsonRobust } = require('../utils/jsonRepair');

const client = new Anthropic();
const SYSTEM_PROMPT = fs.readFileSync(
    path.join(__dirname, '../prompts/system_ag15.txt'),
    'utf-8'
);
const TEMPERATURE = 0.1;
const AGENT_ID = 'AG-15';

async function run(inputData) {
    console.log(`[${AGENT_ID}] Iniciando análisis de compliance legal...`);
    const message = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 16384,
        temperature: TEMPERATURE,
        system: SYSTEM_PROMPT,
        messages: [
            {
                role: 'user',
                content: `Analiza el siguiente proyecto y genera el marco legal y de compliance COMPLETO y EXHAUSTIVO en formato JSON estricto.\n\nDADES DEL PROJECTE:\n${JSON.stringify(inputData, null, 2)}`,
            },
        ],
    });

    if (typeof inputData._onTokens === 'function') inputData._onTokens(message.usage, AGENT_ID);
    const text = message.content
        .filter((block) => block.type === 'text')
        .map((block) => block.text)
        .join('\n');

    return parseJsonRobust(text, AGENT_ID, inputData, SYSTEM_PROMPT);
}

module.exports = { run };
