'use strict';
/**
 * generate_docx.js — Generador de documentos Word para Adeptify Multi-Agent System
 *
 * Lee outputs/consolidado_final.json (generado por orchestrator.js)
 * y produce un .docx profesional con la identidad visual de Adeptify Systems.
 *
 * Uso: node generate_docx.js outputs/consolidado_final.json
 */

const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, ShadingType, AlignmentType, HeadingLevel,
  PageBreak, Header, Footer, PageNumber, NumberFormat,
  TableOfContents, StyleLevel, BorderStyle,
  convertInchesToTwip, LevelFormat,
} = require('docx');

const { getStyleRules } = require('./agents/ag11_estilo');
const S = getStyleRules();

// ─── Helpers de color ─────────────────────────────────────────────────────────
const C = S.colores;
const T = S.tipografia;
const P = S.pagina;
const TB = S.tablas;

// ─── Helpers de párrafo ───────────────────────────────────────────────────────

function heading1(text) {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_1,
    pageBreakBefore: true,
    spacing: { after: T.h1.spacing_after },
    run: { font: T.h1.font, size: T.h1.size, bold: T.h1.bold, color: T.h1.color },
  });
}

function heading2(text) {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_2,
    spacing: { after: T.h2.spacing_after },
    run: { font: T.h2.font, size: T.h2.size, bold: T.h2.bold, color: T.h2.color },
  });
}

function heading3(text) {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_3,
    spacing: { after: T.h3.spacing_after },
    run: { font: T.h3.font, size: T.h3.size, bold: T.h3.bold, color: T.h3.color },
  });
}

function body(text, opts = {}) {
  if (!text) return new Paragraph({ children: [] });
  return new Paragraph({
    alignment: opts.center ? AlignmentType.CENTER : AlignmentType.JUSTIFIED,
    spacing: { after: T.body.spacing_after, line: T.body.line },
    children: [
      new TextRun({
        text: String(text),
        font: T.body.font,
        size: T.body.size,
        color: opts.color || T.body.color,
        bold: opts.bold || false,
        italics: opts.italic || false,
      }),
    ],
  });
}

function bullet(text) {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { after: 80 },
    children: [
      new TextRun({ text: String(text), font: T.body.font, size: T.body.size, color: T.body.color }),
    ],
  });
}

function spacer() {
  return new Paragraph({ children: [], spacing: { after: 160 } });
}

// ─── Helper de tabla ──────────────────────────────────────────────────────────

function makeTable(rows, colWidths) {
  if (!rows || rows.length === 0) return spacer();

  const numCols = rows[0].length;
  const defaultWidths = Array(numCols).fill(Math.floor(TB.width_total / numCols));
  const widths = colWidths || defaultWidths;

  return new Table({
    width: { size: TB.width_total, type: WidthType.DXA },
    borders: {
      top:    { style: BorderStyle.SINGLE, size: TB.border_size, color: TB.border_color },
      bottom: { style: BorderStyle.SINGLE, size: TB.border_size, color: TB.border_color },
      left:   { style: BorderStyle.SINGLE, size: TB.border_size, color: TB.border_color },
      right:  { style: BorderStyle.SINGLE, size: TB.border_size, color: TB.border_color },
      insideH:{ style: BorderStyle.SINGLE, size: TB.border_size, color: TB.border_color },
      insideV:{ style: BorderStyle.SINGLE, size: TB.border_size, color: TB.border_color },
    },
    rows: rows.map((row, rowIdx) => {
      const isHeader = rowIdx === 0;
      return new TableRow({
        tableHeader: isHeader,
        children: row.map((cell, colIdx) => {
          const bgColor = isHeader ? C.header_tablas_bg
            : rowIdx % 2 === 0 ? C.fondo_tablas_par : C.fondo_tablas_impar;
          return new TableCell({
            width: { size: widths[colIdx] || defaultWidths[colIdx], type: WidthType.DXA },
            shading: { type: ShadingType.CLEAR, fill: bgColor },
            margins: {
              top: TB.cell_margin_top, bottom: TB.cell_margin_bottom,
              left: TB.cell_margin_left, right: TB.cell_margin_right,
            },
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: cell !== null && cell !== undefined ? String(cell) : '',
                    font: isHeader ? T.tabla_header.font : T.tabla_body.font,
                    size: isHeader ? T.tabla_header.size : T.tabla_body.size,
                    bold: isHeader ? T.tabla_header.bold : false,
                    color: isHeader ? T.tabla_header.color : T.tabla_body.color,
                  }),
                ],
              }),
            ],
          });
        }),
      });
    }),
  });
}

// ─── Header y Footer ──────────────────────────────────────────────────────────

function createHeader(clientName) {
  return new Header({
    children: [
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: C.primary_purple } },
        children: [
          new TextRun({ text: 'Adeptify Systems  |  ', font: T.header_footer.font, size: T.header_footer.size, bold: true, color: C.meteorite_dark }),
          new TextRun({ text: clientName || 'Proposta Digital', font: T.header_footer.font, size: T.header_footer.size, color: C.texto_secundario }),
        ],
      }),
    ],
  });
}

function createFooter() {
  return new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        border: { top: { style: BorderStyle.SINGLE, size: 2, color: C.primary_purple } },
        children: [
          new TextRun({ text: 'CONFIDENCIAL  |  ', font: T.header_footer.font, size: T.header_footer.size, color: C.texto_secundario }),
          new TextRun({ children: [PageNumber.CURRENT], font: T.header_footer.font, size: T.header_footer.size, color: C.texto_secundario }),
          new TextRun({ text: ' / ', font: T.header_footer.font, size: T.header_footer.size, color: C.texto_secundario }),
          new TextRun({ children: [PageNumber.TOTAL_PAGES], font: T.header_footer.font, size: T.header_footer.size, color: C.texto_secundario }),
          new TextRun({ text: '  |  © Adeptify Systems', font: T.header_footer.font, size: T.header_footer.size, color: C.texto_secundario }),
        ],
      }),
    ],
  });
}

// ─── Portada (sin header/footer) ──────────────────────────────────────────────

function buildCoverSection(doc_data) {
  const meta = doc_data.metadata || {};
  const cliente = doc_data.datos_cliente?.cliente || {};
  return [
    new Paragraph({ children: [], spacing: { after: 2400 } }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({ text: 'Adeptify Systems', font: T.h1.font, size: 60, bold: true, color: C.meteorite_dark }),
      ],
      spacing: { after: 200 },
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({ text: S.marca.claim, font: T.body.font, size: 22, italic: true, color: C.texto_secundario }),
      ],
      spacing: { after: 1600 },
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      shading: { type: ShadingType.CLEAR, fill: C.meteorite_dark },
      children: [
        new TextRun({ text: `  Proposta de Transformació Digital  `, font: T.h2.font, size: 32, bold: true, color: 'FFFFFF', break: 1 }),
      ],
      spacing: { after: 600 },
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({ text: cliente.nombre || meta.cliente || 'Client', font: T.h1.font, size: 44, bold: true, color: C.primary_purple }),
      ],
      spacing: { after: 400 },
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({ text: `${cliente.sector || ''} · ${cliente.ubicacion || ''}`.replace(/^ · | · $/, ''), font: T.body.font, size: 22, color: C.texto_secundario }),
      ],
      spacing: { after: 2000 },
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({ text: `Referència: ${meta.referencia || 'ADT-2026-001'}`, font: T.body.font, size: 20, color: C.texto_secundario }),
        new TextRun({ text: `  ·  Data: ${meta.fecha || new Date().toLocaleDateString('ca-ES')}`, font: T.body.font, size: 20, color: C.texto_secundario }),
        new TextRun({ text: `  ·  Versió: ${meta.version || '1.0'}`, font: T.body.font, size: 20, color: C.texto_secundario }),
      ],
      spacing: { after: 400 },
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: '— DOCUMENT CONFIDENCIAL —', font: T.body.font, size: 20, bold: true, color: C.meteorite_light })],
    }),
  ];
}

// ─── Secciones del documento ──────────────────────────────────────────────────

function buildSection(children) {
  return children.filter(Boolean);
}

function safeText(v, fallback = '') {
  if (v === null || v === undefined) return fallback;
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

function safeArray(v) {
  if (!v) return [];
  if (Array.isArray(v)) return v;
  return [v];
}

function renderSection1(s1) {
  if (!s1) return [];
  const items = [
    heading1('1. Resum Executiu'),
    body(s1.parrafo_1), spacer(),
    body(s1.parrafo_2), spacer(),
    body(s1.parrafo_3), spacer(),
  ];
  if (s1.tabla_resumen && s1.tabla_resumen.length > 1) {
    items.push(heading2('Taula resum'), makeTable(s1.tabla_resumen, [1800, 2100, 2600, 2526]), spacer());
  }
  return items;
}

function renderSection2(s2) {
  if (!s2) return [];
  const items = [
    heading1('2. Context i Diagnòstic'),
    heading2('2.1 Context Sectorial'),
    body(s2.contexto_sectorial), spacer(),
    heading2('2.2 Diagnòstic Actual'),
    body(s2.diagnostico_actual), spacer(),
  ];
  if (s2.tabla_sistemas && s2.tabla_sistemas.length > 1) {
    items.push(heading3('Inventari de Sistemes'), makeTable(s2.tabla_sistemas, [2200, 2600, 1400, 2826]), spacer());
  }
  if (s2.cuello_botella) {
    items.push(heading3('Principal Coll d\'Ampolla'), body(s2.cuello_botella), spacer());
  }
  return items;
}

function renderSection3(s3) {
  if (!s3) return [];
  const items = [
    heading1('3. Solució Proposada'),
    heading2('3.1 Visió General'),
    body(s3.vision_general), spacer(),
  ];
  if (s3.componentes && s3.componentes.length) {
    items.push(heading2('3.2 Components de la Solució'));
    for (const c of s3.componentes) {
      items.push(
        heading3(safeText(c.nombre)),
        body(safeText(c.descripcion)),
        body(`Tecnologia: ${safeText(c.tecnologia)}`, { bold: true }),
        body(`Benefici: ${safeText(c.beneficio)}`),
        spacer(),
      );
    }
  }
  if (s3.arquitectura_textual) {
    items.push(heading2('3.3 Arquitectura Tècnica'), body(s3.arquitectura_textual), spacer());
  }
  if (s3.integraciones_clave && s3.integraciones_clave.length) {
    const integRows = [['Des de', 'Cap a', 'Descripció'], ...s3.integraciones_clave.map(i => [safeText(i.de), safeText(i.a), safeText(i.descripcion)])];
    items.push(heading2('3.4 Integracions Clau'), makeTable(integRows, [2200, 2200, 4626]), spacer());
  }
  if (s3.diferenciadores && s3.diferenciadores.length) {
    items.push(heading2('3.5 Diferenciadors'));
    for (const d of s3.diferenciadores) items.push(bullet(safeText(d)));
    items.push(spacer());
  }
  return items;
}

function renderSection4(s4) {
  if (!s4) return [];
  const items = [heading1('4. Metodologia'), body(s4.descripcion), spacer()];
  if (s4.tabla_fases && s4.tabla_fases.length > 1) {
    items.push(heading2('Fases del Projecte'), makeTable(s4.tabla_fases, [2000, 1200, 3200, 2626]), spacer());
  }
  return items;
}

function renderSection5(s5) {
  if (!s5) return [];
  const items = [heading1('5. Cronograma'), body(`Durada total: ${safeText(s5.duracion_total)}`), spacer()];
  if (s5.tabla_cronograma && s5.tabla_cronograma.length > 1) {
    items.push(makeTable(s5.tabla_cronograma, [3000, 1200, 4826]), spacer());
  }
  return items;
}

function renderSection6(s6) {
  if (!s6) return [];
  return [
    heading1('6. DevOps i Desplegament'),
    heading2('6.1 Estratègia de Desplegament'), body(s6.estrategia), spacer(),
    heading2('6.2 Pipeline CI/CD'), body(s6.pipeline), spacer(),
    heading2('6.3 Monitorització'), body(s6.monitorizacion), spacer(),
  ];
}

function renderSection7(s7) {
  if (!s7) return [];
  return [
    heading1('7. Seguretat i Compliment Normatiu'),
    heading2('7.1 Avaluació de Seguretat'), body(s7.evaluacion), spacer(),
    heading2('7.2 Compliment RGPD/LOPD'), body(s7.cumplimiento_rgpd), spacer(),
    heading2('7.3 Clàusula de Confidencialitat'), body(s7.clausula_confidencialidad, { italic: true }), spacer(),
  ];
}

function renderSection8(s8) {
  if (!s8) return [];
  const items = [heading1('8. Proposta Econòmica')];
  if (s8.tabla_conceptos && s8.tabla_conceptos.length > 1) {
    items.push(heading2('8.1 Detall de Conceptes'), makeTable(s8.tabla_conceptos, [4200, 900, 1200, 2726]), spacer());
  }
  items.push(
    body(`Subtotal sense IVA: ${safeText(s8.total_sin_iva)}`, { bold: true }),
    body(`IVA (21%): ${safeText(s8.iva)}`),
    body(`TOTAL amb IVA: ${safeText(s8.total_con_iva)}`, { bold: true, color: C.primary_purple }),
    spacer(),
  );
  if (s8.tabla_pagos && s8.tabla_pagos.length > 1) {
    items.push(heading2('8.2 Condicions de Pagament'), makeTable(s8.tabla_pagos, [3200, 1600, 4226]), spacer());
  }
  if (s8.roi_texto) {
    items.push(heading2('8.3 Retorn de la Inversió (ROI)'), body(s8.roi_texto), spacer());
  }
  if (s8.tabla_roi_3anos && s8.tabla_roi_3anos.length > 1) {
    items.push(heading3('Projecció a 3 anys'), makeTable(s8.tabla_roi_3anos, [1800, 2000, 2000, 3226]), spacer());
  }
  return items;
}

function renderSection9(s9) {
  if (!s9) return [];
  const items = [heading1('9. Gestió de Riscos')];
  if (s9.tabla_riesgos && s9.tabla_riesgos.length > 1) {
    items.push(makeTable(s9.tabla_riesgos, [800, 2600, 700, 900, 4026]), spacer());
  }
  return items;
}

function renderSection10(s10) {
  if (!s10) return [];
  const items = [heading1('10. Gestió del Canvi i Formació'), body(s10.descripcion), spacer()];
  if (s10.plan_formacion && s10.plan_formacion.length) {
    items.push(heading2('Pla de Formació'));
    const formRows = [['Sessió', 'Audiència', 'Durada', 'Format'],
      ...s10.plan_formacion.map(f => [safeText(f.sesion), safeText(f.audiencia), safeText(f.duracion), safeText(f.formato)])];
    items.push(makeTable(formRows, [2600, 2200, 1200, 3026]), spacer());
  }
  return items;
}

function renderSection11(s11) {
  if (!s11) return [];
  return [heading1('11. Condicions Generals'), body(s11.texto_condiciones || s11), spacer()];
}

function renderSection12(s12) {
  if (!s12 || !s12.length) return [];
  const items = [heading1('12. Casos d\'Èxit')];
  for (const caso of s12) {
    items.push(heading2(safeText(caso.titulo)), body(safeText(caso.descripcion)));
    if (caso.resultados) items.push(body(`Resultats: ${safeText(caso.resultados)}`, { bold: true }));
    items.push(spacer());
  }
  return items;
}

function renderSection13(s13) {
  if (!s13) return [];
  const items = [heading1('13. Pròxims Passos')];
  if (s13.tabla_pasos && s13.tabla_pasos.length > 1) {
    items.push(makeTable(s13.tabla_pasos, [600, 3400, 2000, 3026]), spacer());
  }
  if (s13.llamada_accion) {
    items.push(spacer(), body(s13.llamada_accion, { bold: true, color: C.primary_purple }));
  }
  return items;
}

// ─── Generador principal ──────────────────────────────────────────────────────

async function generateDocx(consolidadoPath) {
  const raw = JSON.parse(fs.readFileSync(consolidadoPath, 'utf-8'));

  // El consolidado puede tener el documento en raw.documento o ser el documento directamente
  const doc_data = raw.documento || raw;
  const datosCliente = raw.datos_cliente || doc_data.datos_cliente || {};
  const clientName = datosCliente?.cliente?.nombre || doc_data.metadata?.cliente || 'Client';

  const cover = buildCoverSection({ ...doc_data, datos_cliente: datosCliente });

  const mainChildren = [
    ...renderSection1(doc_data.s1_resumen_ejecutivo),
    ...renderSection2(doc_data.s2_contexto_diagnostico),
    ...renderSection3(doc_data.s3_solucion),
    ...renderSection4(doc_data.s4_metodologia),
    ...renderSection5(doc_data.s5_cronograma),
    ...renderSection6(doc_data.s6_devops),
    ...renderSection7(doc_data.s7_seguridad),
    ...renderSection8(doc_data.s8_economia),
    ...renderSection9(doc_data.s9_riesgos),
    ...renderSection10(doc_data.s10_change_management),
    ...renderSection11(doc_data.s11_condiciones),
    ...renderSection12(doc_data.s12_casos_exito),
    ...renderSection13(doc_data.s13_proximos_pasos),
  ];

  const document = new Document({
    title: `Proposta Adeptify — ${clientName}`,
    description: 'Proposta de Transformació Digital generada per Adeptify Multi-Agent System',
    styles: {
      default: {
        document: {
          run: { font: T.body.font, size: T.body.size, color: T.body.color },
          paragraph: { spacing: { after: T.body.spacing_after } },
        },
      },
    },
    sections: [
      // ── Portada (sin header/footer) ─────────────────────────────────────────
      {
        properties: {
          page: {
            size: { width: P.width, height: P.height },
            margin: { top: P.margin_top, bottom: P.margin_bottom, left: P.margin_left, right: P.margin_right },
            pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL },
          },
        },
        children: cover,
      },
      // ── Contenido principal (con header/footer) ─────────────────────────────
      {
        properties: {
          page: {
            size: { width: P.width, height: P.height },
            margin: { top: P.margin_top + 400, bottom: P.margin_bottom + 400, left: P.margin_left, right: P.margin_right },
          },
        },
        headers: { default: createHeader(clientName) },
        footers: { default: createFooter() },
        children: mainChildren,
      },
    ],
  });

  const buffer = await Packer.toBuffer(document);

  const outputDir = path.join(path.dirname(consolidadoPath));
  const safeName = clientName.replace(/[^a-zA-Z0-9À-ÿ\s]/g, '').replace(/\s+/g, '_').substring(0, 40);
  const date = new Date().toISOString().slice(0, 10);
  const outputPath = path.join(outputDir, `Proposta_Adeptify_${safeName}_${date}.docx`);

  fs.writeFileSync(outputPath, buffer);
  console.log(`\n✅ Document generat: ${outputPath}`);
  return outputPath;
}

// ─── Entry point ──────────────────────────────────────────────────────────────
if (require.main === module) {
  const inputFile = process.argv[2] || 'outputs/consolidado_final.json';
  const filePath = path.isAbsolute(inputFile) ? inputFile : path.join(process.cwd(), inputFile);

  if (!fs.existsSync(filePath)) {
    console.error(`[ERROR] No se encontró: ${filePath}`);
    console.error('Uso: node generate_docx.js outputs/consolidado_final.json');
    process.exit(1);
  }

  generateDocx(filePath).catch((err) => {
    console.error('[ERROR FATAL]', err);
    process.exit(1);
  });
}

module.exports = { generateDocx };
