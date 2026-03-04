const fs = require('fs');
const path = require('path');

const agentsDir = path.join(__dirname, 'multi-agent', 'agents');
const files = fs.readdirSync(agentsDir).filter(f => f.endsWith('.js'));

for (const file of files) {
    const filePath = path.join(agentsDir, file);
    let content = fs.readFileSync(filePath, 'utf8');

    // Remove Anthropic client lines
    content = content.replace(/const client = new Anthropic\(\);\n/, '');

    // Replace the whole run() function
    const runRegex = /async function run\(inputData\) \{[\s\S]*?module\.exports = \{ run \};/g;

    const newRunCode = `async function run(inputData) {
  console.log(\`[\${AGENT_ID}] Iniciando análisis...\`);
  
  const promptText = \`Analiza los siguientes datos y genera tu output en formato JSON estricto.\\n\\nDATOS:\\n\${JSON.stringify(inputData, null, 2)}\`;
  
  // Usamos el wrapper unificado de LLM
  const { callLLM } = require('../utils/llm');
  const text = await callLLM(SYSTEM_PROMPT, promptText, AGENT_ID, TEMPERATURE, inputData._onTokens);

  return parseJsonRobust(text, AGENT_ID, inputData, SYSTEM_PROMPT);
}

module.exports = { run };`;

    const newContent = content.replace(runRegex, newRunCode);

    if (content !== newContent) {
        fs.writeFileSync(filePath, newContent, 'utf8');
        console.log(`Pached ${file}`);
    } else {
        console.log(`Skipped ${file} (already patched or different format)`);
    }
}
