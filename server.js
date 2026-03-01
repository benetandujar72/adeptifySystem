
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
app.use(express.json({ limit: '15mb' }));

// --- CONFIGURACIÓ DE BRANDING ADEPTIFY.ES ---
const COLORS = {
  PRIMARY: "1B3A5C",
  SECONDARY: "2E75B6",
  ACCENT: "4A90D9",
  DARK: "1A1A1A",
  GRAY: "666666",
  LIGHT_BG: "E8F0FE",
  BORDER: "B0C4DE"
};

// --- DB CLIENT ---
let cachedSupabase = null;
const getSupabaseAdmin = () => {
  if (cachedSupabase) return cachedSupabase;
  const url = process.env.SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !key) return null;
  cachedSupabase = createClient(url, key);
  return cachedSupabase;
};

// --- GEMINI RESILIENT CALLER ---
async function callGemini(prompt, modelId = "gemini-3.1-pro-preview") {
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
    if (modelId.includes("3.1")) return callGemini(prompt, "gemini-1.5-pro");
    throw new Error(data.error.message);
  }
  
  const rawText = data.candidates[0].content.parts[0].text;
  return JSON.parse(rawText.replace(/```json|```/g, "").trim());
}

// --- CLASSE GENERADORA DE DOCX (ESTÀNDARD 12 SECCIONS) ---
class WordProposalGenerator {
  async generate(data) {
    const doc = new Document({
      styles: {
        paragraphStyles: [
          {
            id: "Normal",
            name: "Normal",
            run: { size: 22, font: "Arial", color: COLORS.DARK },
            paragraph: { alignment: AlignmentType.JUSTIFIED, spacing: { line: 276, before: 120, after: 120 }, indent: { firstLine: 420 } }
          },
          {
            id: "Heading1",
            name: "Heading 1",
            run: { size: 32, bold: true, font: "Arial", color: COLORS.PRIMARY },
            paragraph: { alignment: AlignmentType.LEFT, spacing: { before: 400, after: 200 }, outlineLevel: 0, border: { bottom: { color: COLORS.SECONDARY, size: 6, style: "single", space: 1 } } }
          },
          {
            id: "Heading2",
            name: "Heading 2",
            run: { size: 26, bold: true, font: "Arial", color: COLORS.SECONDARY },
            paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 1 }
          }
        ]
      },
      sections: [
        {
          properties: { page: { size: { width: 12240, height: 15840 } } },
          children: [
            new Paragraph({ spacing: { before: 2400 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: "ADEPTIFY SYSTEMS", bold: true, size: 56, color: COLORS.PRIMARY })] }),
            new Paragraph({ spacing: { before: 400 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: (data.proyecto?.titulo || "PROPOSTA DE TRANSFORMACIÓ DIGITAL").toUpperCase(), bold: true, size: 28, color: COLORS.SECONDARY })] }),
            new Paragraph({ spacing: { before: 4000 }, alignment: AlignmentType.RIGHT, children: [
              new TextRun({ text: `CLIENT: ${data.cliente?.nombre || '[Client]'}`, bold: true, size: 24 }),
              new TextRun({ text: "", break: 1 }),
              new TextRun({ text: `Codi: ${data.propuesta?.codigo || 'PROP-2026'}`, size: 20, color: COLORS.GRAY }),
              new TextRun({ text: "", break: 1 }),
              new TextRun({ text: `Data: ${data.propuesta?.fecha || new Date().toLocaleDateString()}`, size: 20, color: COLORS.GRAY })
            ]}),
            new Paragraph({ children: [new PageBreak()] })
          ]
        },
        {
          headers: {
            default: new Header({
              children: [new Paragraph({ border: { bottom: { color: COLORS.SECONDARY, size: 6, style: "single" } }, children: [
                new TextRun({ text: "ADEPTIFY SYSTEMS", bold: true, color: COLORS.PRIMARY, size: 16 }),
                new TextRun({ text: "\t\tProposta de Solucions Digitals", italics: true, color: COLORS.GRAY, size: 16 })
              ]})]
            })
          },
          footers: {
            default: new Footer({
              children: [new Paragraph({ border: { top: { color: COLORS.SECONDARY, size: 6, style: "single" } }, children: [
                new TextRun({ text: `CONFIDENCIAL | ${data.cliente?.nombre || 'Client'}`, color: COLORS.GRAY, size: 14 }),
                new TextRun({ text: "\t\tPàgina ", color: COLORS.GRAY, size: 14 }),
                new TextRun({ children: [PageNumber.CURRENT], color: COLORS.GRAY, size: 14 })
              ]})]
            })
          },
          children: [
            new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("ÍNDEX DE CONTINGUTS")] }),
            new TableOfContents("Índex", { headingStyleRange: "1-3", hyperlink: true }),
            new Paragraph({ children: [new PageBreak()] }),

            new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("1. RESUM EXECUTIU")] }),
            new Paragraph({ children: [new TextRun(data.proyecto?.resumen || "[Pendent]")] }),

            new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("2. CONTEXT I DIAGNÒSTIC")] }),
            new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("2.1 Anàlisi de l'Entorn Actual")] }),
            new Paragraph({ children: [new TextRun(data.diagnostico?.entorno || "[Pendent]")] }),
            new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("2.3 Identificació de Necessitats")] }),
            new Table({
              width: { size: 9360, type: WidthType.DXA },
              rows: [
                new TableRow({ children: [
                  new TableCell({ shading: { fill: COLORS.PRIMARY }, children: [new Paragraph({ children: [new TextRun({ text: "ID", color: "FFFFFF", bold: true })] })] }),
                  new TableCell({ shading: { fill: COLORS.PRIMARY }, children: [new Paragraph({ children: [new TextRun({ text: "DESCRIPCIÓ", color: "FFFFFF", bold: true })] })] }),
                  new TableCell({ shading: { fill: COLORS.PRIMARY }, children: [new Paragraph({ children: [new TextRun({ text: "PRIORITAT", color: "FFFFFF", bold: true })] })] })
                ]}),
                ...(data.diagnostico?.necesidades || []).map((n, i) => new TableRow({
                  children: [
                    new TableCell({ shading: { fill: i % 2 === 0 ? "FFFFFF" : COLORS.LIGHT_BG }, children: [new Paragraph({ text: n.id })] }),
                    new TableCell({ shading: { fill: i % 2 === 0 ? "FFFFFF" : COLORS.LIGHT_BG }, children: [new Paragraph({ text: n.descripcion })] }),
                    new TableCell({ shading: { fill: i % 2 === 0 ? "FFFFFF" : COLORS.LIGHT_BG }, children: [new Paragraph({ text: n.prioridad })] })
                  ]
                }))
              ]
            }),

            new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("3. SOLUCIÓ PROPOSADA")] }),
            new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("3.1 Visió General")] }),
            new Paragraph({ children: [new TextRun(data.solucion?.vision || "[Pendent]")] }),
            new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("3.2 Components de la Solució")] }),
            new Paragraph({ children: [new TextRun(`IA i Dades: ${data.solucion?.componentes?.ia_datos || '... '}`)] }),

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
              rows: [
                new TableRow({ children: [
                  new TableCell({ children: [new Paragraph({ spacing: { before: 1200 }, children: [new TextRun({ text: "Per Adeptify Systems SLU", bold: true })] }), new Paragraph({ children: [new TextRun("Benet Andújar, Director Estratègic") ]}) ] }),
                  new TableCell({ children: [new Paragraph({ spacing: { before: 1200 }, children: [new TextRun({ text: `Per ${data.cliente?.nombre || 'Client'}`, bold: true })] }), new Paragraph({ children: [new TextRun(data.cliente?.contacto_nombre || "Signatura representant") ]}) ] })
                ]})
              ]
            })
          ]
        }
      ]
    });
    return await Packer.toBuffer(doc);
  }
}

// --- ENDPOINTS ---

app.post('/api/automation/capture', async (req, res) => {
  const { url } = req.body;
  try {
    console.info(`[automation] Scraping URL: ${url}`);
    const fetchResp = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Referer': 'https://www.google.com/' } });
    const html = await fetchResp.text();
    const $ = cheerio.load(html);
    const text = $('body').text().replace(/\s+/g, ' ').substring(0, 15000);
    
    const prompt = `Actua com a consultor sènior d'Adeptify. Analitza aquesta web i genera un JSON amb la següent estructura exacta:
{
  "company_name": "Nom de l'escola o empresa",
  "contact_email": "Email de contacte extret o deduït",
  "recommended_solution": "Breu descripció de la solució proposada",
  "needs_detected": ["Necessitat 1", "Necessitat 2", "Necessitat 3"],
  "recommended_services": ["Servei suggerit 1", "Servei suggerit 2"],
  "main_bottleneck": "Coll d'ampolla principal detectat",
  "estimated_budget_range": "Ex: 5.000€ - 8.000€",
  "custom_pitch": "Resum executiu o pitch personalitzat per a l'empresa"
}
IDIOMA: CATALÀ. TEXT: ${text}`;
    
    const result = await callGemini(prompt);
    res.json(result);
  } catch (e) {
    console.error("[Capture Error]", e.message);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/automation/digital-twin', async (req, res) => {
  try {
    const result = await callGemini("Actua com a motor de Digital Twin educatiu. Genera prediccions d'estrès operatiu (JSON: stress_level, critical_department, predictions[]).");
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/automation/migrate-data', async (req, res) => {
  try {
    const result = await callGemini(`Estructura les dades: ${req.body.rawData} en JSON (mapped_staff[], migration_summary).`);
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/automation/network-prospecting', async (req, res) => {
  try {
    const result = await callGemini(`Estratègia d'expansió des de ${req.body.referenceCenterName} (JSON: expansion_nodes[]).`);
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/leads/send-proposal', async (req, res) => {
  const { leadId, email, subject, body, pdfBase64, proposalData } = req.body;
  try {
    const host = process.env.SMTP_HOST;
    if (!host) throw new Error("SMTP No Configurat");
    const transporter = nodemailer.createTransport({ host, port: Number(process.env.SMTP_PORT || 587), secure: false, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } });
    
    const supabase = getSupabaseAdmin();
    let interactionId = crypto.randomUUID();
    if (supabase && leadId) await supabase.from('lead_interactions').insert({ id: interactionId, lead_id: leadId, interaction_type: 'proposal_sent', content_summary: subject, payload_json: proposalData });

    const html = `<div style="font-family:sans-serif;">${body.replace(/\n/g, '<br>')}<br><br><img src="https://consultor.adeptify.es/api/crm/track/${interactionId}.png" width="1" height="1"/></div>`;
    await transporter.sendMail({ from: process.env.SMTP_USER, to: email, subject, html, attachments: pdfBase64 ? [{ filename: 'Proposta_Adeptify.pdf', content: pdfBase64, encoding: 'base64' }] : [] });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/crm/track/:id.png', async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    if (supabase) await supabase.from('lead_interactions').update({ metadata_json: { opened_at: new Date().toISOString() } }).eq('id', req.params.id);
  } catch (e) {}
  res.writeHead(200, { 'Content-Type': 'image/gif' }).end(Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64'));
});

app.post('/api/automation/generate-docx', async (req, res) => {
  try {
    const generator = new WordProposalGenerator();
    const buffer = await generator.generate(req.body.leadData);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document').send(buffer);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

const distDir = path.join(__dirname, 'dist');
app.use(express.static(distDir));
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: "API Not Found" });
  res.sendFile(path.join(distDir, 'index.html'));
});

app.listen(PORT, () => console.log(`Adeptify 2.0 on ${PORT}`));
