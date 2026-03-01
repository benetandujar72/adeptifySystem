const express = require('express');
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const cheerio = require('cheerio');
const docx = require('docx');

const { 
  Document, Packer, Paragraph, TextRun, HeadingLevel, 
  AlignmentType, Table, TableRow, TableCell, WidthType, 
  ShadingType, PageBreak, Header, Footer, PageNumber, 
  TableOfContents 
} = docx;

const PORT = Number(process.env.PORT || 2705);
const STARTUP_TS = Date.now();

const app = express();

// --- DB CLIENT (ADMIN) ---
let cachedSupabase = null;
const getSupabaseAdmin = () => {
  if (cachedSupabase) return cachedSupabase;
  const url = process.env.SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !key) return null;
  cachedSupabase = createClient(url, key);
  return cachedSupabase;
};

// --- EMAIL TRANSPORTER ---
const getTransporter = () => {
  const user = (process.env.SMTP_USER || '').trim();
  const pass = process.env.SMTP_PASS || '';
  if (!process.env.SMTP_HOST) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE).toLowerCase() === 'true',
    auth: user ? { user, pass } : undefined
  });
};

// --- GEMINI RESILIENT CALLER ---
async function callGemini(prompt, modelId = "gemini-1.5-pro") {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) throw new Error("Missing GEMINI_API_KEY");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json" }
    })
  });

  const data = await response.json();
  
  if (data.error) {
    console.error(`[Gemini Error - ${modelId}]`, JSON.stringify(data.error));
    // Fallback to stable model if Pro Preview fails
    if (modelId.includes("3.1")) return callGemini(prompt, "gemini-1.5-pro");
    throw new Error(data.error.message);
  }

  if (!data.candidates || !data.candidates[0]?.content?.parts?.[0]?.text) {
    console.error("[Gemini Error] Unexpected response structure:", JSON.stringify(data));
    throw new Error("Stucture Error: No candidates returned from IA");
  }

  const rawText = data.candidates[0].content.parts[0].text;
  try {
    return JSON.parse(rawText.replace(/```json|```/g, "").trim());
  } catch (e) {
    console.error("[Gemini Error] Invalid JSON returned:", rawText);
    throw new Error("Invalid JSON from IA");
  }
}

// --- WORD GENERATOR ---
const COLORS = { PRIMARY: "1B3A5C", SECONDARY: "2E75B6", LIGHT_BG: "E8F0FE" };
class WordProposalGenerator {
  async generate(data) {
    const doc = new Document({
      styles: {
        paragraphStyles: [
          { id: "Normal", run: { size: 22, font: "Arial" }, paragraph: { alignment: AlignmentType.JUSTIFIED, spacing: { line: 276, before: 120, after: 120 }, indent: { firstLine: 420 } } },
          { id: "Heading1", run: { size: 32, bold: true, color: COLORS.PRIMARY }, paragraph: { spacing: { before: 400, after: 200 }, border: { bottom: { color: COLORS.SECONDARY, size: 6, style: "single" } } } }
        ]
      },
      sections: [{
        properties: { page: { size: { width: 12240, height: 15840 } } },
        children: [
          new Paragraph({ spacing: { before: 2400 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: "ADEPTIFY SYSTEMS", bold: true, size: 56, color: COLORS.PRIMARY })] }),
          new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: (data.proyecto?.titulo || "PROPOSTA ESTRATÈGICA").toUpperCase(), bold: true, size: 28, color: COLORS.SECONDARY })] }),
          new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("1. RESUM EXECUTIU")] }),
          new Paragraph({ children: [new TextRun(data.proyecto?.resumen || data.custom_pitch || "[Pendent]")] }),
          new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("7. PROPOSTA ECONÒMICA")] }),
          new Table({
            width: { size: 9360, type: WidthType.DXA },
            rows: [
              new TableRow({ children: [
                new TableCell({ shading: { fill: COLORS.PRIMARY }, children: [new Paragraph({ children: [new TextRun({ text: "CONCEPTE", color: "FFFFFF", bold: true })] })] }),
                new TableCell({ shading: { fill: COLORS.PRIMARY }, children: [new Paragraph({ children: [new TextRun({ text: "IMPORT", color: "FFFFFF", bold: true })] })] })
              ]}),
              ...(data.economia?.conceptos || []).map((c, i) => new TableRow({
                children: [
                  new TableCell({ shading: { fill: i % 2 === 0 ? "FFFFFF" : COLORS.LIGHT_BG }, children: [new Paragraph({ text: c.concepto })] }),
                  new TableCell({ shading: { fill: i % 2 === 0 ? "FFFFFF" : COLORS.LIGHT_BG }, children: [new Paragraph({ text: c.importe })] })
                ]
              }))
            ]
          }),
          new Paragraph({ children: [new PageBreak()] }),
          new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("12. PRÒXIMS PASSOS I ACCEPTACIÓ")] }),
          new Table({
            width: { size: 9360, type: WidthType.DXA },
            rows: [new TableRow({ children: [
              new TableCell({ children: [new Paragraph({ spacing: { before: 1200 }, children: [new TextRun({ text: "Per Adeptify Systems SLU", bold: true })] })] }),
              new TableCell({ children: [new Paragraph({ spacing: { before: 1200 }, children: [new TextRun({ text: `Per ${data.cliente?.nombre || 'Client'}`, bold: true })] })] })
            ]})]
          })
        ]
      }]
    });
    return await Packer.toBuffer(doc);
  }
}

// --- ENDPOINTS ---

app.post('/api/automation/capture', express.json(), async (req, res) => {
  const { url } = req.body;
  try {
    const fetchResp = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const html = await fetchResp.text();
    const $ = cheerio.load(html);
    const text = $('body').text().replace(/\s+/g, ' ').substring(0, 10000);
    
    const prompt = `Analitza aquesta web escolar i retorna JSON amb company_name, contact_email, detected_needs (array), recommended_services (array), custom_pitch, estimated_budget_range. TEXT: ${text}`;
    const result = await callGemini(prompt, "gemini-3.1-pro-preview");
    res.json(result);
  } catch (e) {
    console.error("[Capture Error]", e.message);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/leads/send-proposal', express.json({ limit: '10mb' }), async (req, res) => {
  const { leadId, email, subject, body, pdfBase64, proposalData } = req.body;
  try {
    const transporter = getTransporter();
    if (!transporter) throw new Error("Email service not configured");
    
    const supabase = getSupabaseAdmin();
    let interactionId = crypto.randomUUID();
    if (supabase && leadId) {
      const { data } = await supabase.from('lead_interactions').insert({ id: interactionId, lead_id: leadId, interaction_type: 'proposal_sent', content_summary: subject, payload_json: proposalData }).select().single();
      if (data) interactionId = data.id;
    }

    const domain = req.headers.host.includes('localhost') ? 'http://localhost:2705' : 'https://consultor.adeptify.es';
    const html = `<div style="font-family:sans-serif;">${body.replace(/\n/g, '<br>')}<br><br><img src="${domain}/api/crm/track/${interactionId}.png" width="1" height="1"/></div>`;

    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: email,
      subject: subject || 'Proposta Adeptify',
      html,
      attachments: pdfBase64 ? [{ filename: 'Proposta_Adeptify.pdf', content: pdfBase64, encoding: 'base64' }] : []
    });
    res.json({ ok: true });
  } catch (e) {
    console.error("[Mail Error]", e.message);
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/crm/track/:id.png', async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    if (supabase) await supabase.from('lead_interactions').update({ metadata_json: { opened_at: new Date().toISOString() } }).eq('id', req.params.id);
  } catch (e) {}
  const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
  res.writeHead(200, { 'Content-Type': 'image/gif', 'Cache-Control': 'no-cache' }).end(pixel);
});

app.post('/api/automation/generate-docx', express.json(), async (req, res) => {
  try {
    const generator = new WordProposalGenerator();
    const buffer = await generator.generate(req.body.leadData);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document').send(buffer);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Static SPA
const distDir = path.join(__dirname, 'dist');
app.use(express.static(distDir));
app.get('*', (req, res) => {
  try {
    const html = fs.readFileSync(path.join(distDir, 'index.html'), 'utf8');
    res.send(html.replace(/\"\/env\.js\"/g, `\"/env.js?v=${STARTUP_TS}\"`));
  } catch(e) { res.sendFile(path.join(distDir, 'index.html')); }
});

app.listen(PORT, () => console.log(`Server running on ${PORT}`));
