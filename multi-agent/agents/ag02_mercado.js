'use strict';
const Anthropic = require('@anthropic-ai/sdk');
const path = require('path');
const fs = require('fs');
const { parseJsonRobust } = require('../utils/jsonRepair');

const SYSTEM_PROMPT = fs.readFileSync(
  path.join(__dirname, '../prompts/system_ag02.txt'),
  'utf-8'
);
const TEMPERATURE = 0.4;
const AGENT_ID = 'AG-02';

async function run(inputData) {
  console.log(`[${AGENT_ID}] Iniciando análisis...`);
  
  const promptText = `Analiza los siguientes datos y genera tu output en formato JSON estricto.\n\nDATOS:\n${JSON.stringify(inputData, null, 2)}`;
  
  // Usamos el wrapper unificado de LLM
  const { callLLM } = require('../utils/llm');
  const text = await callLLM(SYSTEM_PROMPT, promptText, AGENT_ID, TEMPERATURE, inputData._onTokens);

  return parseJsonRobust(text, AGENT_ID, inputData, SYSTEM_PROMPT);
}

module.exports = { run };
