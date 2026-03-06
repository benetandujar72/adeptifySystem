require('dotenv').config();
const fetch = require('node-fetch'); // Assuming node-fetch or similar if not native

async function testClaude() {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) {
        console.log("❌ ANTHROPIC_API_KEY is missing");
        return;
    }
    console.log("Testing Claude API...");
    try {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': key.trim(),
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: "claude-3-haiku-20240307",
                max_tokens: 10,
                messages: [{ role: 'user', content: "Hi" }]
            })
        });
        console.log(`Claude Status: ${res.status}`);
        const data = await res.json();
        if (res.ok) console.log("✅ Claude OK");
        else console.log("❌ Claude Error:", JSON.stringify(data));
    } catch (e) {
        console.log("❌ Claude Exception:", e.message);
    }
}

async function testGemini() {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
        console.log("❌ GEMINI_API_KEY is missing");
        return;
    }
    console.log("Testing Gemini API...");
    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key.trim()}`;
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: "Hi" }] }] })
        });
        console.log(`Gemini Status: ${res.status}`);
        const data = await res.json();
        if (res.ok) console.log("✅ Gemini OK");
        else console.log("❌ Gemini Error:", JSON.stringify(data));
    } catch (e) {
        console.log("❌ Gemini Exception:", e.message);
    }
}

(async () => {
    await testClaude();
    console.log("---");
    await testGemini();
})();
