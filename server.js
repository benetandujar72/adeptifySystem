
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
  const host = (process.env.SMTP_HOST || '').trim();
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true';
  const user = (process.env.SMTP_USER || '').trim();
  const pass = process.env.SMTP_PASS || '';
  if (!host) return null;
  return nodemailer.createTransport({ host, port, secure, auth: user ? { user, pass } : undefined });
};

// --- WORD GENERATOR SERVICE ---
const COLORS = {
  PRIMARY: "1B3A5C",
  SECONDARY: "2E75B6",
  LIGHT_BG: "E8F0FE"
};

class WordProposalGenerator {
  async generate(data) {
    const doc = new Document({
      styles: {
        paragraphStyles: [
          {
            id: "Normal", run: { size: 22, font: "Arial" },
            paragraph: { alignment: AlignmentType.JUSTIFIED, spacing: { line: 276, before: 120, after: 120 }, indent: { firstLine: 420 } }
          },
          {
            id: "Heading1", run: { size: 32, bold: true, color: COLORS.PRIMARY },
            paragraph: { spacing: { before: 400, after: 200 }, border: { bottom: { color: COLORS.SECONDARY, size: 6, style: "single" } } }
          }
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
              new TableCell({ children: [new Paragraph({ spacing: { before: 1200 }, children: [new TextRun({ text: `Per \${data.cliente?.nombre || 'Client'}`, bold: true })] })] })
            ]})]
          })
        ]
      }]
    });
    return await Packer.toBuffer(doc);
  }
}

// --- API ENDPOINTS ---

// CRM Tracking Pixel
app.get('/api/crm/track/:id.png', async (req, res) => {
  const supabase = getSupabaseAdmin();
  if (supabase) {
    await supabase.from('lead_interactions').update({ metadata_json: { opened_at: new Date().toISOString() } }).eq('id', req.params.id);
  }
  const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
  res.writeHead(200, { 'Content-Type': 'image/gif', 'Cache-Control': 'no-cache' }).end(pixel);
});

// Capture & Scrape
app.post('/api/automation/capture', express.json(), async (req, res) => {
  const { url } = req.body;
  try {
    const resp = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } });
    const html = await resp.text();
    const $ = cheerio.load(html);
    const text = $('body').text().replace(/\s+/g, ' ').substring(0, 10000);
    const apiKey = (process.env.GEMINI_API_KEY || '').trim();
    const prompt = `Analitza aquesta web i retorna JSON: company_name, contact_email, detected_needs[], custom_pitch, estimated_budget_range. TEXT: \${text}`;
    const gUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-pro-preview:generateContent?key=\${apiKey}`;
    const gResp = await fetch(gUrl, { method: 'POST', body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json" } }) });
    const gData = await gResp.json();
    res.json(JSON.parse(gData.candidates[0].content.parts[0].text));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Send Proposal
app.post('/api/leads/send-proposal', express.json({ limit: '10mb' }), async (req, res) => {
  const { leadId, email, subject, body, pdfBase64, proposalData } = req.body;
  try {
    const transporter = getTransporter();
    if (!transporter) throw new Error("No SMTP");
    
    const supabase = getSupabaseAdmin();
    let interactionId = crypto.randomUUID();
    if (supabase && leadId) {
      const { data } = await supabase.from('lead_interactions').insert({ id: interactionId, lead_id: leadId, interaction_type: 'proposal_sent', content_summary: subject, payload_json: proposalData }).select().single();
      if (data) interactionId = data.id;
    }

    const domain = req.headers.host.includes('localhost') ? 'http://localhost:2705' : 'https://consultor.adeptify.es';
    const html = `<div style="font-family:sans-serif;">\${body.replace(/\n/g, '<br>')}<br><br><img src="\${domain}/api/crm/track/\${interactionId}.png" width="1" height="1"/></div>`;

    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: email,
      subject: subject || 'Proposta Adeptify',
      html,
      attachments: pdfBase64 ? [{ filename: 'Proposta_Adeptify.pdf', content: pdfBase64, encoding: 'base64' }] : []
    });

    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DOCX Generation
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
    res.send(html.replace(/\"\/env\.js\"/g, `\"/env.js?v=\${STARTUP_TS}\"`));
  } catch(e) { res.sendFile(path.join(distDir, 'index.html')); }
});

app.listen(PORT, () => console.log(`Server running on \${PORT}`));
