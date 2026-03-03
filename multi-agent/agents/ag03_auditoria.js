'use strict';
const Anthropic = require('@anthropic-ai/sdk');
const path = require('path');
const fs = require('fs');

const client = new Anthropic();
const SYSTEM_PROMPT = fs.readFileSync(
  path.join(__dirname, '../prompts/system_ag03.txt'),
  'utf-8'
);
const TEMPERATURE = 0.2;
const AGENT_ID = 'AG-03';

async function run(inputData) {
  console.log(`[${AGENT_ID}] Iniciando análisis...`);
  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8192,
    temperature: TEMPERATURE,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Analiza los siguientes datos y genera tu output en formato JSON estricto.\n\nDATOS:\n${JSON.stringify(inputData, null, 2)}`,
      },
    ],
  });

  const text = message.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n');

  return parseJson(text, inputData);
}

async function parseJson(text, inputData) {
  // Try to extract JSON from markdown code block first
  const codeBlock = text.match(/```json\s*([\s\S]*?)```/);
  const raw = codeBlock ? codeBlock[1] : text;
  const cleaned = raw.trim();

  try {
    return JSON.parse(cleaned);
  } catch (e) {
    console.warn(`[${AGENT_ID}] JSON parse failed, extracting from braces...`);
    // Try to extract from first { to last }
    const first = cleaned.indexOf('{');
    const last = cleaned.lastIndexOf('}');
    if (first !== -1 && last !== -1) {
      try {
        return JSON.parse(cleaned.substring(first, last + 1));
      } catch (e2) {
        console.warn(`[${AGENT_ID}] Brace extraction failed, retrying with strict prompt...`);
      }
    }
    return retryWithStricterPrompt(inputData, text);
  }
}

async function retryWithStricterPrompt(inputData, previousOutput) {
  console.log(`[${AGENT_ID}] Reintentando con prompt estricto...`);
  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8192,
    temperature: 0.1,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Tu respuesta anterior no fue JSON válido. Devuelve ÚNICAMENTE un objeto JSON sin markdown ni texto adicional.\n\nDatos originales:\n${JSON.stringify(inputData, null, 2)}\n\nTu respuesta anterior:\n${previousOutput.substring(0, 2000)}`,
      },
    ],
  });
  const text = message.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('');
  return JSON.parse(text.replace(/```json\s*|```/g, '').trim());
}

module.exports = { run };
