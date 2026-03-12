'use strict';
/**
 * generate_pdf.js — PDF Generator for Adeptify Multi-Agent System
 *
 * Generates professionally styled PDFs from the same consolidated data
 * that generate_docx.js uses, with Adeptify brand identity.
 *
 * Exports:
 *   generatePdfBuffer(docData, datosCliente) → Buffer
 *   generateBrochurePdfBuffer()              → Buffer  (generic Adeptify services brochure)
 */

const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { getStyleRules } = require('./agents/ag11_estilo');

const S = getStyleRules();

// Brand colors
const COL = {
  meteorite: '#2F1C6A',
  purple: '#673DE6',
  lightPurple: '#8C85FF',
  body: '#333333',
  secondary: '#666666',
  white: '#FFFFFF',
  headerBg: '#2F1C6A',
  evenRow: '#F3F0FF',
  oddRow: '#FFFFFF',
  border: '#D4CCFF',
};

const MARGIN = 60;
const PW = 595.28;   // A4 width in points
const PH = 841.89;   // A4 height
const CW = PW - 2 * MARGIN; // content width

// Load bundled logo once
let LOGO_BUF = null;
try {
  const p = path.join(__dirname, 'assets', 'logo_adeptify.png');
  if (fs.existsSync(p)) LOGO_BUF = fs.readFileSync(p);
} catch (_) { }

// ── Helpers ──────────────────────────────────────────────────────────────────

function safe(v, fb = '') {
  if (v == null) return fb;
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

function needsPage(doc, h = 80) {
  return doc.y + h > PH - MARGIN - 40;
}

function ensureSpace(doc, h = 80) {
  if (needsPage(doc, h)) { doc.addPage(); doc.y = MARGIN + 10; }
}

function heading(doc, text, level = 1) {
  if (level === 1) {
    doc.addPage();
    doc.y = MARGIN + 10;
    doc.fontSize(20).font('Helvetica-Bold').fillColor(COL.meteorite)
      .text(text, MARGIN, doc.y, { width: CW });
    doc.moveTo(MARGIN, doc.y).lineTo(PW - MARGIN, doc.y)
      .strokeColor(COL.purple).lineWidth(1.5).stroke();
    doc.moveDown(0.5);
  } else if (level === 2) {
    ensureSpace(doc, 60);
    doc.moveDown(0.3);
    doc.fontSize(13).font('Helvetica-Bold').fillColor(COL.purple)
      .text(text, MARGIN, doc.y, { width: CW });
    doc.moveDown(0.3);
  } else {
    ensureSpace(doc, 50);
    doc.moveDown(0.2);
    doc.fontSize(11).font('Helvetica-Bold').fillColor(COL.lightPurple)
      .text(text, MARGIN, doc.y, { width: CW });
    doc.moveDown(0.2);
  }
}

function bodyText(doc, text, opts = {}) {
  if (!text) return;
  ensureSpace(doc, 40);
  const font = opts.bold ? 'Helvetica-Bold' : opts.italic ? 'Helvetica-Oblique' : 'Helvetica';
  doc.fontSize(10).font(font).fillColor(opts.color || COL.body)
    .text(safe(text), MARGIN, doc.y, { width: CW, align: 'justify', lineGap: 2 });
  doc.moveDown(0.3);
}

function bulletItem(doc, text) {
  if (!text) return;
  ensureSpace(doc, 30);
  doc.fontSize(10).font('Helvetica').fillColor(COL.body)
    .text(`  •  ${safe(text)}`, MARGIN, doc.y, { width: CW, lineGap: 2 });
  doc.moveDown(0.1);
}

function drawTable(doc, rows) {
  if (!rows || !Array.isArray(rows) || rows.length < 1) return;
  // Normalize
  const maxCols = Math.max(...rows.map(r => (Array.isArray(r) ? r.length : 0)));
  if (maxCols === 0) return;
  const norm = rows.map(r => {
    const a = Array.isArray(r) ? r.map(c => safe(c)) : [];
    while (a.length < maxCols) a.push('');
    return a;
  });

  const colW = CW / maxCols;
  const rH = 20;
  const fs = 7.5;

  for (let ri = 0; ri < norm.length; ri++) {
    ensureSpace(doc, rH + 5);
    const isHdr = ri === 0;
    const bg = isHdr ? COL.headerBg : (ri % 2 === 0 ? COL.evenRow : COL.oddRow);
    const tc = isHdr ? COL.white : COL.body;
    const fn = isHdr ? 'Helvetica-Bold' : 'Helvetica';
    const y = doc.y;

    for (let ci = 0; ci < maxCols; ci++) {
      const x = MARGIN + ci * colW;
      doc.save();
      doc.rect(x, y, colW, rH).fill(bg);
      doc.restore();
      doc.rect(x, y, colW, rH).strokeColor(COL.border).lineWidth(0.3).stroke();
      doc.fontSize(fs).font(fn).fillColor(tc)
        .text(norm[ri][ci], x + 3, y + 4, { width: colW - 6, height: rH - 4, ellipsis: true });
    }
    doc.y = y + rH;
  }
  doc.moveDown(0.5);
}

function tryImage(doc, base64, opts = {}) {
  if (!base64) return;
  try {
    const buf = Buffer.from(base64, 'base64');
    const w = opts.width || CW * 0.8;
    const h = opts.height || 200;
    ensureSpace(doc, h + 40);
    const x = MARGIN + (CW - w) / 2;
    doc.moveDown(0.5);
    const yBefore = doc.y;
    doc.image(buf, x, yBefore, { width: w, height: h, fit: [w, h], align: 'center', valign: 'center' });
    doc.y = yBefore + h + 15;
  } catch (e) {
    console.warn(`[PDF] Image embed failed: ${e.message}`);
  }
}

// ── Cover page ───────────────────────────────────────────────────────────────

function renderCover(doc, docData, datosCliente, vis) {
  const meta = docData.metadata || {};
  const cl = datosCliente?.cliente || docData.datos_cliente?.cliente || {};

  // Top bar
  doc.rect(0, 0, PW, 100).fill(COL.meteorite);

  // Logo
  if (LOGO_BUF) {
    try { doc.image(LOGO_BUF, (PW - 100) / 2, 15, { width: 100 }); } catch (_) { }
  }

  doc.y = 120;
  doc.fontSize(30).font('Helvetica-Bold').fillColor(COL.meteorite)
    .text('Adeptify Systems', { align: 'center', width: PW });
  doc.moveDown(0.2);
  doc.fontSize(11).font('Helvetica-Oblique').fillColor(COL.secondary)
    .text(S.marca.claim, { align: 'center', width: PW });
  doc.moveDown(1.5);

  // Cover image
  if (vis.portada_base64) {
    tryImage(doc, vis.portada_base64, { width: 380, height: 190 });
  } else {
    doc.moveDown(3);
  }

  // Branded bar
  const barY = doc.y;
  doc.rect(MARGIN + 40, barY, CW - 80, 36).fill(COL.meteorite);
  doc.fontSize(14).font('Helvetica-Bold').fillColor(COL.white)
    .text('Proposta de Transformació Digital', 0, barY + 10, { align: 'center', width: PW });
  doc.y = barY + 50;
  doc.moveDown(1);

  // Client name
  doc.fontSize(24).font('Helvetica-Bold').fillColor(COL.purple)
    .text(cl.nombre || meta.cliente || 'Client', { align: 'center' });
  doc.moveDown(0.3);
  const loc = `${safe(cl.sector)} · ${safe(cl.ubicacion)}`.replace(/^ · | · $/g, '');
  if (loc.trim()) {
    doc.fontSize(11).font('Helvetica').fillColor(COL.secondary).text(loc, { align: 'center' });
  }
  doc.moveDown(3);

  // Reference
  doc.fontSize(9).font('Helvetica').fillColor(COL.secondary)
    .text(`Ref: ${safe(meta.referencia, 'ADT-2026-001')}  ·  Data: ${safe(meta.fecha, new Date().toLocaleDateString('ca-ES'))}  ·  Versió: ${safe(meta.version, '1.0')}`, { align: 'center' });
  doc.moveDown(0.8);
  doc.fontSize(9).font('Helvetica-Bold').fillColor(COL.meteorite)
    .text('— DOCUMENT CONFIDENCIAL —', { align: 'center' });
}

// ── Sections ─────────────────────────────────────────────────────────────────

function renderS1(doc, s) {
  if (!s) return;
  heading(doc, '1. Resum Executiu');
  bodyText(doc, s.parrafo_1);
  bodyText(doc, s.parrafo_2);
  bodyText(doc, s.parrafo_3);
  if (s.tabla_resumen?.length > 1) { heading(doc, 'Taula resum', 2); drawTable(doc, s.tabla_resumen); }
}

function renderS2(doc, s) {
  if (!s) return;
  heading(doc, '2. Context i Diagnòstic');
  heading(doc, '2.1 Context Sectorial', 2); bodyText(doc, s.contexto_sectorial);
  heading(doc, '2.2 Diagnòstic Actual', 2); bodyText(doc, s.diagnostico_actual);
  if (s.tabla_sistemas?.length > 1) { heading(doc, 'Inventari de Sistemes', 3); drawTable(doc, s.tabla_sistemas); }
  if (s.cuello_botella) { heading(doc, 'Principal Coll d\'Ampolla', 3); bodyText(doc, s.cuello_botella); }
}

function renderS3(doc, s, vis) {
  if (!s) return;
  heading(doc, '3. Solució Proposada');
  heading(doc, '3.1 Visió General', 2); bodyText(doc, s.vision_general);
  tryImage(doc, vis.mockup_base64, { width: 420, height: 250 });
  if (s.componentes?.length) {
    heading(doc, '3.2 Components', 2);
    for (const c of s.componentes) {
      heading(doc, safe(c.nombre), 3);
      bodyText(doc, safe(c.descripcion));
      bodyText(doc, `Tecnologia: ${safe(c.tecnologia)}`, { bold: true });
      bodyText(doc, `Benefici: ${safe(c.beneficio)}`);
    }
  }
  if (s.arquitectura_textual) { heading(doc, '3.3 Arquitectura Tècnica', 2); bodyText(doc, s.arquitectura_textual); }
  tryImage(doc, vis.diagrama_base64, { width: 420, height: 250 });
  tryImage(doc, vis.workflow_base64, { width: 420, height: 220 });
  if (s.integraciones_clave?.length) {
    const rows = [['Des de', 'Cap a', 'Descripció'], ...s.integraciones_clave.map(i => [safe(i.de), safe(i.a), safe(i.descripcion)])];
    heading(doc, '3.4 Integracions Clau', 2); drawTable(doc, rows);
  }
  tryImage(doc, vis.integraciones_base64, { width: 420, height: 250 });
  if (s.diferenciadors?.length || s.diferenciadores?.length) {
    heading(doc, '3.5 Diferenciadors', 2);
    for (const d of (s.diferenciadors || s.diferenciadores || [])) bulletItem(doc, d);
  }
}

function renderS4(doc, s) {
  if (!s) return;
  heading(doc, '4. Metodologia');
  bodyText(doc, s.descripcion);
  if (s.tabla_fases?.length > 1) { heading(doc, 'Fases del Projecte', 2); drawTable(doc, s.tabla_fases); }
}

function renderS5(doc, s, vis) {
  if (!s) return;
  heading(doc, '5. Cronograma');
  bodyText(doc, `Durada total: ${safe(s.duracion_total)}`);
  tryImage(doc, vis.cronograma_base64, { width: 420, height: 180 });
  if (s.tabla_cronograma?.length > 1) drawTable(doc, s.tabla_cronograma);
}

function renderS6(doc, s) {
  if (!s) return;
  heading(doc, '6. DevOps i Desplegament');
  heading(doc, '6.1 Estratègia', 2); bodyText(doc, s.estrategia);
  heading(doc, '6.2 Pipeline CI/CD', 2); bodyText(doc, s.pipeline);
  heading(doc, '6.3 Monitorització', 2); bodyText(doc, s.monitorizacion);
}

function renderS7(doc, s) {
  if (!s) return;
  heading(doc, '7. Seguretat i Compliment Normatiu');
  heading(doc, '7.1 Avaluació', 2); bodyText(doc, s.evaluacion);
  heading(doc, '7.2 Compliment RGPD/LOPD', 2); bodyText(doc, s.cumplimiento_rgpd);
  heading(doc, '7.3 Confidencialitat', 2); bodyText(doc, s.clausula_confidencialidad, { italic: true });
}

function renderS8(doc, s) {
  if (!s) return;
  heading(doc, '8. Proposta Econòmica');
  if (s.tabla_conceptos?.length > 1) { heading(doc, '8.1 Detall de Conceptes', 2); drawTable(doc, s.tabla_conceptos); }
  bodyText(doc, `Subtotal sense IVA: ${safe(s.total_sin_iva)}`, { bold: true });
  bodyText(doc, `IVA (21%): ${safe(s.iva)}`);
  bodyText(doc, `TOTAL amb IVA: ${safe(s.total_con_iva)}`, { bold: true, color: COL.purple });
  if (s.tabla_pagos?.length > 1) { heading(doc, '8.2 Condicions de Pagament', 2); drawTable(doc, s.tabla_pagos); }
  if (s.roi_texto) { heading(doc, '8.3 Retorn de la Inversió (ROI)', 2); bodyText(doc, s.roi_texto); }
  if (s.tabla_roi_3anos?.length > 1) { heading(doc, 'Projecció a 3 anys', 3); drawTable(doc, s.tabla_roi_3anos); }
}

function renderS9(doc, s) {
  if (!s) return;
  heading(doc, '9. Gestió de Riscos');
  if (s.tabla_riesgos?.length > 1) drawTable(doc, s.tabla_riesgos);
}

function renderS10(doc, s) {
  if (!s) return;
  heading(doc, '10. Gestió del Canvi i Formació');
  bodyText(doc, s.descripcion);
  if (s.plan_formacion?.length) {
    heading(doc, 'Pla de Formació', 2);
    const rows = [['Sessió', 'Audiència', 'Durada', 'Format'],
    ...s.plan_formacion.map(f => [safe(f.sesion), safe(f.audiencia), safe(f.duracion), safe(f.formato)])];
    drawTable(doc, rows);
  }
}

function renderS11(doc, s) {
  if (!s) return;
  heading(doc, '11. Condicions Generals');
  bodyText(doc, s.texto_condiciones || s);
}

function renderS12(doc, s) {
  if (!s || !s.length) return;
  heading(doc, '12. Casos d\'Èxit');
  for (const c of s) {
    heading(doc, safe(c.titulo), 2);
    bodyText(doc, safe(c.descripcion));
    if (c.resultados) bodyText(doc, `Resultats: ${safe(c.resultados)}`, { bold: true });
  }
}

function renderS13(doc, s) {
  if (!s) return;
  heading(doc, '13. Pròxims Passos');
  if (s.tabla_pasos?.length > 1) drawTable(doc, s.tabla_pasos);
  if (s.llamada_accion) {
    doc.moveDown(0.5);
    bodyText(doc, s.llamada_accion, { bold: true, color: COL.purple });
  }
}

// ── Footer on every page ─────────────────────────────────────────────────────

function addHeadersFooters(doc, clientName) {
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(i);
    // Footer
    doc.save();
    doc.moveTo(MARGIN, PH - 42).lineTo(PW - MARGIN, PH - 42)
      .strokeColor(COL.purple).lineWidth(0.5).stroke();
    doc.fontSize(7).font('Helvetica').fillColor(COL.secondary)
      .text(`CONFIDENCIAL  |  ${i + 1} / ${range.count}  |  © Adeptify Systems`,
        MARGIN, PH - 35, { width: CW, align: 'center' });
    // Header (skip cover)
    if (i > 0) {
      doc.fontSize(7).font('Helvetica').fillColor(COL.secondary)
        .text(`Adeptify Systems  |  ${safe(clientName)}`, MARGIN, 15, { width: CW, align: 'right' });
      doc.moveTo(MARGIN, 28).lineTo(PW - MARGIN, 28)
        .strokeColor(COL.purple).lineWidth(0.3).stroke();
    }
    doc.restore();
  }
}

// ── Main exports ─────────────────────────────────────────────────────────────

/**
 * generatePdfBuffer — builds a full multi-agent proposal PDF from consolidated data
 * @param {object} docData - The AG-12 document object (or consolidado_final)
 * @param {object} [datosCliente] - Client data for cover page
 * @returns {Promise<Buffer>}
 */
async function generatePdfBuffer(docData, datosCliente) {
  const dd = docData.documento || docData;
  const cd = datosCliente || docData.datos_cliente || dd.datos_cliente || {};
  const clientName = cd?.cliente?.nombre || dd.metadata?.cliente || 'Client';
  const vis = dd.ag11_estilo?.visuales || docData.ag11_estilo?.visuales || {};

  // Fallback logo
  if (!vis.logo_base64 && LOGO_BUF) {
    vis.logo_base64 = LOGO_BUF.toString('base64');
  }

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
      bufferPages: true,
      info: {
        Title: `Proposta Adeptify — ${clientName}`,
        Author: 'Adeptify Systems',
        Subject: 'Proposta de Transformació Digital',
      },
    });

    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    try {
      renderCover(doc, dd, cd, vis);

      const tryRender = (fn, ...args) => {
        try { fn(doc, ...args); }
        catch (e) { console.warn(`[PDF] Section render error: ${e.message}`); }
      };

      tryRender(renderS1, dd.s1_resumen_ejecutivo);
      tryRender(renderS2, dd.s2_contexto_diagnostico);
      tryRender(renderS3, dd.s3_solucion, vis);
      tryRender(renderS4, dd.s4_metodologia);
      tryRender(renderS5, dd.s5_cronograma, vis);
      tryRender(renderS6, dd.s6_devops);
      tryRender(renderS7, dd.s7_seguridad);
      tryRender(renderS8, dd.s8_economia);
      tryRender(renderS9, dd.s9_riesgos);
      tryRender(renderS10, dd.s10_change_management);
      tryRender(renderS11, dd.s11_condiciones);
      tryRender(renderS12, dd.s12_casos_exito);
      tryRender(renderS13, dd.s13_proximos_pasos);

      addHeadersFooters(doc, clientName);
    } catch (e) {
      console.error('[PDF] Fatal render error:', e.message);
    }

    doc.end();
  });
}

// Multilingual content for brochure PDF
const BROCHURE_CONTENT = {
  ca: {
    title: 'Adeptify Systems — Serveis',
    claim: 'Ens adaptem a la teva realitat. Com un camaleó digital, cada solució és única.',
    heading: 'Consultoria Estratègica en Intel·ligència Artificial',
    intro: 'A Adeptify, ens especialitzem en transformació digital per a centres educatius i institucions. ' +
      'Combinem IA avançada, automatització de processos i consultoria estratègica per generar impacte real.',
    servicesTitle: 'Els Nostres Serveis',
    services: [
      { name: 'GESTIÓ DE GUÀRDIES', desc: 'Automatització total del quadrant de substitucions diàries mitjançant IA. Redueix el temps de gestió un 90%.' },
      { name: 'ASSISTATUT v3.1', desc: "Control d'assistència intel·ligent per a 7 classes simultànies amb anàlisi predictiu d'absentisme." },
      { name: 'ROYAL MATH', desc: "Plataforma gamificada d'aprenentatge matemàtic amb itineraris personalitzats adaptats al ritme de cada alumne." },
      { name: 'qViC v2.0', desc: 'Sistema de gestió de qualitat educativa certificat i automatitzat per facilitar auditories i millora contínua.' },
    ],
    moto: "És la tecnologia qui s'adapta al client i no viceversa",
    motoBody: "Adeptify desenvolupa solucions completament a mida i personalitzades. Provem el vostre ecosistema educatiu amb un enfocament totalment individualitzat.",
    whyTitle: 'Per Què Adeptify?',
    values: [
      'IA aplicada específicament al sector educatiu',
      "Més de 15 anys d'experiència en transformació digital",
      'Resultats mesurables: ROI clar des del primer trimestre',
      'Acompanyament integral: consultoria + desenvolupament + formació',
      'Compliment normatiu: RGPD, LOPD, ISO 27001',
    ],
    ctaTitle: 'Vol veure com ho fem?',
    ctaBody: 'Agenda una sessió de consultoria estratègica personalitzada.',
    privacy: "Aquest missatge i els seus arxius adjunts poden contenir informació confidencial. D'acord amb el RGPD, l'informem que les seves dades personals només es faran servir per a mantenir la relació empresarial amb la pròpia institució i de manera única, i no es faran servir per altres entitats.",
    pageLabel: (i, n) => `Pàgina ${i + 1} de ${n}`,
    filename: 'Adeptify_Informacio_General.pdf',
  },
  es: {
    title: 'Adeptify Systems — Servicios',
    claim: 'Nos adaptamos a tu realidad. Como un camaleón digital, cada solución es única.',
    heading: 'Consultoría Estratégica en Inteligencia Artificial',
    intro: 'En Adeptify, nos especializamos en transformación digital para centros educativos e instituciones. ' +
      'Combinamos IA avanzada, automatización de procesos y consultoría estratégica para generar impacto real.',
    servicesTitle: 'Nuestros Servicios',
    services: [
      { name: 'GESTIÓN DE GUARDIAS', desc: 'Automatización total del cuadrante de sustituciones diarias mediante IA. Reduce el tiempo de gestión un 90%.' },
      { name: 'ASSISTATUT v3.1', desc: 'Control de asistencia inteligente para 7 clases simultáneas con análisis predictivo de absentismo.' },
      { name: 'ROYAL MATH', desc: 'Plataforma gamificada de aprendizaje matemático con itinerarios personalizados adaptados al ritmo de cada alumno.' },
      { name: 'qViC v2.0', desc: 'Sistema de gestión de calidad educativa certificado y automatizado para facilitar auditorías y mejora continua.' },
    ],
    moto: 'Es la tecnología quien se adapta al cliente, no al revés',
    motoBody: 'Adeptify desarrolla soluciones completamente a medida y personalizadas. Abordamos tu ecosistema educativo con un enfoque totalmente individualizado.',
    whyTitle: '¿Por qué Adeptify?',
    values: [
      'IA aplicada específicamente al sector educativo',
      'Más de 15 años de experiencia en transformación digital',
      'Resultados medibles: ROI claro desde el primer trimestre',
      'Acompañamiento integral: consultoría + desarrollo + formación',
      'Cumplimiento normativo: RGPD, LOPDGDD, ISO 27001',
    ],
    ctaTitle: '¿Quieres ver cómo lo hacemos?',
    ctaBody: 'Agenda una sesión de consultoría estratégica personalizada.',
    privacy: 'Este mensaje y sus archivos adjuntos pueden contener información confidencial. De acuerdo con el RGPD, le informamos de que sus datos personales únicamente se utilizarán para mantener la relación empresarial con la propia institución y no se cederán a terceros.',
    pageLabel: (i, n) => `Página ${i + 1} de ${n}`,
    filename: 'Adeptify_Informacion_General.pdf',
  },
  eu: {
    title: 'Adeptify Systems — Zerbitzuak',
    claim: 'Zure errealitatearen arabera moldatzen gara. Kamaleoi digital bat bezala, soluzio bakoitza bakarra da.',
    heading: 'Adimen Artifizialeko Aholkularitza Estrategikoa',
    intro: 'Adeptifyn, hezkuntza zentroen eta erakundeen eraldaketa digitalean espezializatzen gara. ' +
      'IA aurreratua, prozesuen automatizazioa eta aholkularitza estrategikoa konbinatzen ditugu benetako eragina sortzeko.',
    servicesTitle: 'Gure Zerbitzuak',
    services: [
      { name: 'GUARDIAREN KUDEAKETA', desc: 'Eguneroko ordezko koadrantea IA bidez erabat automatizatzea. Kudeaketa denbora %90 murrizten du.' },
      { name: 'ASSISTATUT v3.1', desc: '7 aldi bereko klasetarako presentzia-kontrol adimentsua absentismoaren analisi prediktiboaren bidez.' },
      { name: 'ROYAL MATH', desc: 'Ikasle bakoitzaren erritmora egokitutako ibilbide pertsonalizatuekin matematika ikasteko plataforma gamifikatua.' },
      { name: 'qViC v2.0', desc: 'Auditoriak eta etengabeko hobekuntza errazteko hezkuntza-kalitatearen kudeaketa sistema ziurtatu eta automatizatua.' },
    ],
    moto: 'Teknologia da bezeroaren beharretara moldatzen dena, ez alderantziz',
    motoBody: 'Adeptifyk guztiz pertsonalizatutako eta egokitutako soluzioak garatzen ditu. Zure hezkuntza ekosistema ikuspegi guztiz indibidualizatuarekin lantzen dugu.',
    whyTitle: 'Zergatik Adeptify?',
    values: [
      'Hezkuntza sektorera bereziki aplikatutako IA',
      'Eraldaketa digitalean 15 urte baino gehiagoko esperientzia',
      'Neurgarriak diren emaitzak: lehen hiruhilekotik ROI argia',
      'Laguntza integrala: aholkularitza + garapena + prestakuntza',
      'Arauzko betetzea: ERREOE, DATUAK, ISO 27001',
    ],
    ctaTitle: 'Nola egiten dugun ikusi nahi al duzu?',
    ctaBody: 'Antolatu aholkularitza estrategiko saio pertsonalizatu bat.',
    privacy: 'Mezu honek eta bere eranskinak informazio konfidentziala eduki dezakete. EBEren arabera, jakinarazten dizugu zure datu pertsonalak erakundearekin negozio-harremana mantentzeko soilik erabiliko direla eta ez zaizkiela hirugarrenei lagako.',
    pageLabel: (i, n) => `${i + 1}. orrialdea ${n}etik`,
    filename: 'Adeptify_Informazio_Orokorra.pdf',
  },
};

/**
 * generateBrochurePdfBuffer — generic Adeptify services brochure for email attachment
 * @param {string} lang — 'ca' | 'es' | 'eu' (default 'ca')
 * @returns {Promise<Buffer>}
 */
async function generateBrochurePdfBuffer(lang = 'ca') {
  const T = BROCHURE_CONTENT[lang] || BROCHURE_CONTENT.ca;
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
      bufferPages: true,
      info: { Title: T.title, Author: 'Adeptify Systems' },
    });

    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    try {
      // Cover bar
      doc.rect(0, 0, PW, 90).fill(COL.meteorite);
      if (LOGO_BUF) {
        try { doc.image(LOGO_BUF, (PW - 90) / 2, 10, { width: 90 }); } catch (_) { }
      }

      doc.y = 110;
      doc.fontSize(26).font('Helvetica-Bold').fillColor(COL.meteorite)
        .text('Adeptify Systems', { align: 'center' });
      doc.moveDown(0.2);
      doc.fontSize(11).font('Helvetica-Oblique').fillColor(COL.secondary)
        .text(T.claim, { align: 'center' });
      doc.moveDown(1);

      // Divider
      doc.moveTo(MARGIN + 80, doc.y).lineTo(PW - MARGIN - 80, doc.y)
        .strokeColor(COL.purple).lineWidth(1).stroke();
      doc.moveDown(1);

      // Intro
      doc.fontSize(14).font('Helvetica-Bold').fillColor(COL.purple)
        .text(T.heading, MARGIN, doc.y, { width: CW, align: 'center' });
      doc.moveDown(0.8);

      doc.fontSize(10).font('Helvetica').fillColor(COL.body)
        .text(T.intro, MARGIN, doc.y, { width: CW, align: 'justify', lineGap: 3 });
      doc.moveDown(1);

      // Services
      doc.fontSize(14).font('Helvetica-Bold').fillColor(COL.meteorite)
        .text(T.servicesTitle, MARGIN);
      doc.moveDown(0.5);

      for (const svc of T.services) {
        ensureSpace(doc, 60);
        doc.rect(MARGIN, doc.y, CW, 0.5).fill(COL.border);
        doc.moveDown(0.3);
        doc.fontSize(11).font('Helvetica-Bold').fillColor(COL.purple).text(svc.name, MARGIN);
        doc.fontSize(9.5).font('Helvetica').fillColor(COL.body)
          .text(svc.desc, MARGIN, doc.y, { width: CW, lineGap: 2 });
        doc.moveDown(0.6);
      }

      doc.moveDown(1);

      // Customization emphasis and examples
      ensureSpace(doc, 100);
      doc.rect(MARGIN, doc.y, CW, 2).fill(COL.purple);
      doc.moveDown(1);
      doc.fontSize(15).font('Helvetica-Bold').fillColor(COL.purple)
        .text(T.moto, MARGIN, doc.y, { width: CW, align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(10).font('Helvetica').fillColor(COL.body)
        .text(T.motoBody, MARGIN, doc.y, { width: CW, align: 'center' });
      doc.moveDown(1);

      try {
        const p1 = path.join(__dirname, '..', 'public', 'images', 'projects', 'assistatut.png');
        const p2 = path.join(__dirname, '..', 'public', 'images', 'projects', 'matchcare.png');
        if (fs.existsSync(p1)) {
          ensureSpace(doc, 190);
          tryImage(doc, fs.readFileSync(p1).toString('base64'), { width: 380, height: 170 });
        }
        if (fs.existsSync(p2)) {
          ensureSpace(doc, 190);
          tryImage(doc, fs.readFileSync(p2).toString('base64'), { width: 380, height: 170 });
        }
      } catch (e) { console.warn('Could not load project images:', e.message); }

      doc.moveDown(1);

      // Value proposition
      doc.fontSize(14).font('Helvetica-Bold').fillColor(COL.meteorite)
        .text(T.whyTitle, MARGIN);
      doc.moveDown(0.5);

      for (const v of T.values) bulletItem(doc, v);

      doc.moveDown(1.5);

      // CTA bar
      ensureSpace(doc, 90);
      const ctaY = doc.y;
      doc.rect(MARGIN, ctaY, CW, 75).fill(COL.meteorite);
      doc.fontSize(13).font('Helvetica-Bold').fillColor(COL.white)
        .text(T.ctaTitle, MARGIN + 20, ctaY + 10, { width: CW - 40 });
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#fff')
        .text('consultor.adeptify.es', MARGIN + 20, ctaY + 28, { width: CW - 40, link: 'https://consultor.adeptify.es/', underline: true });
      doc.fontSize(9).font('Helvetica').fillColor('#D4CCFF')
        .text(T.ctaBody, MARGIN + 20, ctaY + 44, { width: CW - 40 });
      doc.fontSize(9).font('Helvetica').fillColor(COL.white)
        .text('hola@adeptify.es  ·  Tel: 690831770  ·  C. Independencia 3, Local 2, 08290 Cerdanyola del Valles', MARGIN + 20, ctaY + 58, { width: CW - 40 });

      // Footer
      const range = doc.bufferedPageRange();
      for (let i = 0; i < range.count; i++) {
        doc.switchToPage(i);
        doc.save();

        doc.moveTo(MARGIN, PH - 50).lineTo(PW - MARGIN, PH - 50)
          .strokeColor(COL.border).lineWidth(0.5).stroke();

        doc.fontSize(6).font('Helvetica').fillColor(COL.secondary)
          .text(T.privacy, MARGIN, PH - 45, { width: CW - 65, align: 'justify' });

        doc.fontSize(7).font('Helvetica-Bold').fillColor(COL.meteorite)
          .text(T.pageLabel(i, range.count), PW - MARGIN - 60, PH - 40, { width: 60, align: 'right' });

        doc.fontSize(7).font('Helvetica').fillColor(COL.secondary)
          .text('Adeptify Systems | hola@adeptify.es | Tel: 690831770 | C. Independencia 3, Local 2, 08290 Cerdanyola del Valles, Barcelona',
            MARGIN, PH - 20, { width: CW, align: 'center' });

        doc.restore();
      }
    } catch (e) {
      console.error('[PDF Brochure] Error:', e.message);
    }

    doc.end();
  });
}

module.exports = { generatePdfBuffer, generateBrochurePdfBuffer };
