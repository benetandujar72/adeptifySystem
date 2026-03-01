const docx = require("docx");
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  AlignmentType, Table, TableRow, TableCell, WidthType,
  ShadingType, PageBreak, Header, Footer, PageNumber,
  TableOfContents, LevelFormat, BorderStyle
} = docx;

class WordProposalGenerator {
  async generate(data) {
    // 1. SAFE DATA DESTRUCTURING WITH DEFAULTS
    const d = {
      consultora: data.consultora || {},
      cliente: data.cliente || {},
      propuesta: data.propuesta || {},
      proyecto: data.proyecto || {},
      diagnostico: data.diagnostico || {},
      solucion: data.solucion || { componentes: {} },
      metodologia: data.metodologia || {},
      cronograma: data.cronograma || {},
      equipo: data.equipo || [],
      economia: data.economia || {},
      garantias: data.garantias || {},
      riesgos: data.riesgos || [],
      casos_exito: data.casos_exito || {},
      condiciones: data.condiciones || {},
      proximos_pasos: data.proximos_pasos || [],
      personalizacion: data.personalizacion || {}
    };

    const val = (v) => v || "[Pendiente de definir]";
    const isEdu = d.cliente.sector === "educativo";

    // 2. COLORS
    const COLORS = {
      PRIMARY: (d.personalizacion.color_primary || "1B3A5C").replace('#', ''),
      SECONDARY: (d.personalizacion.color_secondary || "2E75B6").replace('#', ''),
      ACCENT: (d.personalizacion.color_accent || "4A90D9").replace('#', ''),
      DARK: "1A1A1A",
      GRAY: "666666",
      LIGHT_BG: "E8F0FE",
      WHITE: "FFFFFF",
      BORDER: "B0C4DE"
    };

    // 3. HELPER FUNCTIONS
    const createHeading1 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(text)] });
    const createHeading2 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(text)] });
    const createHeading3 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun(text)] });
    const createText = (text) => new Paragraph({ children: [new TextRun(text)] });
    const createBullet = (text) => new Paragraph({ children: [new TextRun(text)], bullet: { level: 0 } });

    const createTable = (headers, rows, widths) => {
      const tableRows = [
        new TableRow({
          children: headers.map((h, i) => new TableCell({
            width: { size: widths[i], type: WidthType.DXA },
            shading: { fill: COLORS.PRIMARY, type: ShadingType.CLEAR, color: "auto" },
            margins: { top: 60, bottom: 60, left: 100, right: 100 },
            children: [new Paragraph({ children: [new TextRun({ text: h, color: COLORS.WHITE, bold: true })] })]
          }))
        }),
        ...rows.map((r, rowIndex) => new TableRow({
          children: r.map((cellText, cellIndex) => new TableCell({
            width: { size: widths[cellIndex], type: WidthType.DXA },
            shading: { fill: rowIndex % 2 === 0 ? COLORS.WHITE : COLORS.LIGHT_BG, type: ShadingType.CLEAR, color: "auto" },
            margins: { top: 60, bottom: 60, left: 100, right: 100 },
            children: [new Paragraph({ text: cellText || "" })]
          }))
        }))
      ];
      return new Table({ width: { size: 9360, type: WidthType.DXA }, rows: tableRows });
    };

    // 4. BUILDING BODY SECTIONS
    const bodyContent = [];

    // 1. Resumen Ejecutivo
    bodyContent.push(createHeading1("1. Resumen Ejecutivo"));
    bodyContent.push(createText(val(d.proyecto.resumen)));
    bodyContent.push(createText(`Alcance principal: ${val(d.proyecto.alcance)}`));

    // 2. Contexto y Diagnóstico
    bodyContent.push(createHeading1("2. Contexto y Diagnóstico de Situación"));
    bodyContent.push(createHeading2("2.1 Análisis del Entorno Actual"));
    bodyContent.push(createText(val(d.diagnostico.entorno)));
    bodyContent.push(createHeading2("2.2 Diagnóstico de Procesos Actuales"));
    bodyContent.push(createText(val(d.diagnostico.procesos)));
    bodyContent.push(createHeading2("2.3 Identificación de Necesidades"));
    if (d.diagnostico.necesidades && d.diagnostico.necesidades.length > 0) {
      bodyContent.push(createTable(
        ["ID", "Descripción", "Impacto", "Prioridad"],
        d.diagnostico.necesidades.map(n => [n.id, n.descripcion, n.impacto, n.prioridad]),
        [1000, 4360, 2500, 1500]
      ));
    } else {
      bodyContent.push(createText(val(null)));
    }

    // 3. Solución Propuesta
    bodyContent.push(createHeading1("3. Solución Propuesta"));
    bodyContent.push(createHeading2("3.1 Visión General de la Solución"));
    bodyContent.push(createText(val(d.solucion.vision)));

    bodyContent.push(createHeading2("3.2 Componentes de la Solución"));
    bodyContent.push(createHeading3("3.2.1 Automatización de Procesos (RPA/BPM)"));
    bodyContent.push(createText(val(d.solucion.componentes.automatizacion)));
    bodyContent.push(createHeading3(isEdu ? "3.2.2 Plataforma Digital / Campus Virtual y SGA" : "3.2.2 Plataforma Digital / Portal Web"));
    bodyContent.push(createText(val(d.solucion.componentes.plataforma)));
    bodyContent.push(createHeading3(isEdu ? "3.2.3 Integraciones (SGA, ERP)" : "3.2.3 Integraciones y Conectividad"));
    bodyContent.push(createText(val(d.solucion.componentes.integraciones)));
    bodyContent.push(createHeading3("3.2.4 Inteligencia Artificial y Análisis de Datos"));
    bodyContent.push(createText(val(d.solucion.componentes.ia_datos)));

    bodyContent.push(createHeading2("3.3 Arquitectura Técnica"));
    bodyContent.push(createText(val(d.solucion.arquitectura)));

    bodyContent.push(createHeading2("3.4 Diferenciadores de la Solución"));
    if (d.solucion.diferenciadores && d.solucion.diferenciadores.length > 0) {
      d.solucion.diferenciadores.forEach(dif => {
        bodyContent.push(createBullet(`${dif.nombre}: ${dif.valor}`));
      });
    } else {
      bodyContent.push(createText(val(null)));
    }

    // 4. Metodología de Implementación
    bodyContent.push(createHeading1("4. Metodología de Implementación"));
    bodyContent.push(createHeading2("4.1 Enfoque Metodológico"));
    bodyContent.push(createText(val(d.metodologia.enfoque)));
    bodyContent.push(createHeading2("4.2 Fases del Proyecto"));
    if (d.metodologia.fases && d.metodologia.fases.length > 0) {
      bodyContent.push(createTable(
        ["Fase", "Duración", "Descripción", "Entregables"],
        d.metodologia.fases.map(f => [f.nombre, f.duracion, f.descripcion, f.entregables]),
        [1500, 1500, 4000, 2360]
      ));
    } else {
      bodyContent.push(createText(val(null)));
    }

    // 5. Cronograma de Ejecución
    bodyContent.push(createHeading1("5. Cronograma de Ejecución"));
    bodyContent.push(createHeading2("5.1 Planificación Temporal"));
    if (d.cronograma.fases && d.cronograma.fases.length > 0) {
      bodyContent.push(createTable(
        ["Fase", "Inicio", "Fin", "Entregables"],
        d.cronograma.fases.map(f => [f.fase, f.inicio, f.fin, f.entregables]),
        [3000, 1500, 1500, 3360]
      ));
    } else {
      bodyContent.push(createText(val(null)));
    }
    bodyContent.push(createHeading2("5.2 Hitos Clave"));
    bodyContent.push(createText(val(d.cronograma.hitos)));

    // 6. Equipo de Proyecto
    bodyContent.push(createHeading1("6. Equipo de Proyecto"));
    bodyContent.push(createHeading2("6.1 Estructura del Equipo"));
    if (d.equipo && d.equipo.length > 0) {
      bodyContent.push(createTable(
        ["Rol", "Nombre", "Dedicación", "Experiencia"],
        d.equipo.map(e => [e.rol, e.nombre, e.dedicacion, e.experiencia]),
        [2500, 2500, 1500, 2860]
      ));
    } else {
      bodyContent.push(createText(val(null)));
    }

    // 7. Propuesta Económica
    bodyContent.push(createHeading1("7. Propuesta Económica"));
    bodyContent.push(createHeading2("7.1 Desglose de Inversión"));
    if (d.economia.conceptos && d.economia.conceptos.length > 0) {
      bodyContent.push(createTable(
        ["Concepto", "Importe", "% del Total"],
        d.economia.conceptos.map(e => [e.concepto, e.importe, e.porcentaje]),
        [5000, 2500, 1860]
      ));
    } else {
      bodyContent.push(createText(val(null)));
    }
    bodyContent.push(createText(`Inversión Total: ${val(d.proyecto.inversion_total)} ${val(d.propuesta.moneda)}`));

    bodyContent.push(createHeading2("7.2 Condiciones de Pago"));
    bodyContent.push(createText(val(d.economia.condiciones_pago)));
    bodyContent.push(createHeading2(isEdu ? "7.3 Análisis de Retorno / Impacto Educativo (ROI)" : "7.3 Análisis de Retorno de Inversión (ROI)"));
    bodyContent.push(createText(`Proyección: ${val(d.proyecto.roi_proyectado)}`));
    bodyContent.push(createText(val(d.economia.roi_detalle)));

    // 8. Garantías y Niveles de Servicio
    bodyContent.push(createHeading1("8. Garantías y Niveles de Servicio"));
    bodyContent.push(createHeading2("8.1 Garantía de la Solución"));
    bodyContent.push(createText(val(d.garantias.descripcion)));
    bodyContent.push(createHeading2("8.2 Acuerdos de Nivel de Servicio (SLA)"));
    if (d.garantias.sla && d.garantias.sla.length > 0) {
      bodyContent.push(createTable(
        ["Nivel", "Descripción", "Respuesta", "Resolución"],
        d.garantias.sla.map(s => [s.nivel, s.descripcion, s.tiempo_respuesta, s.tiempo_resolucion]),
        [1500, 4500, 1680, 1680]
      ));
    } else {
      bodyContent.push(createText(val(null)));
    }

    // 9. Gestión de Riesgos
    bodyContent.push(createHeading1("9. Gestión de Riesgos"));
    if (d.riesgos && d.riesgos.length > 0) {
      bodyContent.push(createTable(
        ["Riesgo", "Probabilidad", "Impacto", "Mitigación"],
        d.riesgos.map(r => [r.riesgo, r.probabilidad, r.impacto, r.mitigacion]),
        [3500, 1500, 1500, 2860]
      ));
    } else {
      bodyContent.push(createText(val(null)));
    }

    // 10. Casos de Éxito y Referencias
    bodyContent.push(createHeading1("10. Casos de Éxito y Referencias"));
    bodyContent.push(createText(isEdu ? val(d.casos_exito.educativo) : val(d.casos_exito.empresarial)));
    bodyContent.push(createText(val(d.casos_exito.certificaciones)));

    // 11. Condiciones Generales
    bodyContent.push(createHeading1("11. Condiciones Generales"));
    bodyContent.push(createHeading2("11.1 Validez de la Propuesta"));
    bodyContent.push(createText(`Esta propuesta tiene una validez de ${val(d.propuesta.validez_dias)} días a partir de la fecha de emisión (${val(d.propuesta.fecha)}).`));
    bodyContent.push(createHeading2("11.2 Propiedad Intelectual"));
    bodyContent.push(createText(val(d.condiciones.propiedad_intelectual)));
    bodyContent.push(createHeading2("11.3 Confidencialidad"));
    bodyContent.push(createText(val(d.condiciones.confidencialidad)));
    bodyContent.push(createHeading2("11.4 Supuestos y Exclusiones"));
    bodyContent.push(createText(val(d.condiciones.supuestos)));

    // 12. Próximos Pasos + Bloque de Firma
    bodyContent.push(new Paragraph({ children: [new PageBreak()] }));
    bodyContent.push(createHeading1("12. Próximos Pasos y Aceptación"));
    if (d.proximos_pasos && d.proximos_pasos.length > 0) {
      bodyContent.push(createTable(
        ["Paso", "Acción", "Responsable", "Fecha Límite"],
        d.proximos_pasos.map(p => [p.paso?.toString(), p.accion, p.responsable, p.fecha_limite]),
        [800, 4500, 2060, 2000]
      ));
    } else {
      bodyContent.push(createText(val(null)));
    }

    bodyContent.push(new Paragraph({ spacing: { before: 800 }, children: [new TextRun("FIRMADO Y ACEPTADO:")] }));

    const signatureTable = new Table({
      width: { size: 9360, type: WidthType.DXA },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 4680, type: WidthType.DXA },
              margins: { top: 100, bottom: 100, left: 100, right: 100 },
              borders: { top: { style: BorderStyle.NIL }, left: { style: BorderStyle.NIL }, right: { style: BorderStyle.NIL }, bottom: { style: BorderStyle.NIL } },
              children: [
                new Paragraph({ spacing: { before: 1200 }, children: [new TextRun({ text: `Por ${val(d.consultora.nombre)}`, bold: true })] }),
                new Paragraph({ children: [new TextRun({ text: "Firma responsable", color: COLORS.GRAY })] })
              ]
            }),
            new TableCell({
              width: { size: 4680, type: WidthType.DXA },
              margins: { top: 100, bottom: 100, left: 100, right: 100 },
              borders: { top: { style: BorderStyle.NIL }, left: { style: BorderStyle.NIL }, right: { style: BorderStyle.NIL }, bottom: { style: BorderStyle.NIL } },
              children: [
                new Paragraph({ spacing: { before: 1200 }, children: [new TextRun({ text: `Por ${val(d.cliente.nombre)}`, bold: true })] }),
                new Paragraph({ children: [new TextRun({ text: val(d.cliente.contacto_nombre), color: COLORS.GRAY })] }),
                new Paragraph({ children: [new TextRun({ text: val(d.cliente.contacto_cargo), color: COLORS.GRAY })] })
              ]
            })
          ]
        })
      ]
    });
    bodyContent.push(signatureTable);


    // 5. ASSEMBLE DOCUMENT
    const doc = new Document({
      styles: {
        paragraphStyles: [
          {
            id: "Normal",
            name: "Normal",
            run: { size: 22, font: "Arial", color: COLORS.DARK },
            paragraph: {
              alignment: AlignmentType.JUSTIFIED,
              spacing: { line: 276, before: 120, after: 120 },
              indent: { firstLine: 420 }
            }
          },
          {
            id: "Heading1",
            name: "Heading 1",
            run: { size: 32, bold: true, font: "Arial", color: COLORS.PRIMARY },
            paragraph: {
              alignment: AlignmentType.LEFT,
              spacing: { before: 400, after: 200 },
              outlineLevel: 0,
              border: { bottom: { color: COLORS.SECONDARY, size: 6, space: 1, style: BorderStyle.SINGLE } }
            }
          },
          {
            id: "Heading2",
            name: "Heading 2",
            run: { size: 26, bold: true, font: "Arial", color: COLORS.SECONDARY },
            paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 1 }
          },
          {
            id: "Heading3",
            name: "Heading 3",
            run: { size: 22, bold: true, font: "Arial", color: COLORS.ACCENT },
            paragraph: { spacing: { before: 120, after: 120 }, outlineLevel: 2 }
          }
        ]
      },
      sections: [
        // COVER PAGE
        {
          properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
          children: [
            // Note: Since docx.js image handling requires absolute local paths or array buffers, 
            // text-based logo is used here. A future iteration can embed the exact PNG if available.
            new Paragraph({
              spacing: { before: 2400 }, alignment: AlignmentType.CENTER, children: [
                new TextRun({ text: "adeptify", bold: true, size: 56, color: "00A0E3" }) // Blue
              ]
            }),
            new Paragraph({
              spacing: { before: 400 }, alignment: AlignmentType.CENTER, children: [
                new TextRun({ text: "ADEPTIFY", bold: true, size: 40, color: "111827" }) // Slate-900
              ]
            }),
            new Paragraph({
              spacing: { before: 200, after: 800 }, alignment: AlignmentType.CENTER, children: [
                new TextRun({ text: "Ens adaptem a la teva realitat. Com un camaleó digital, cada solució és única.", italics: true, size: 24, color: "4F46E5" }) // Indigo-600
              ]
            }),
            new Paragraph({
              border: { bottom: { color: "111827", size: 6, space: 1, style: BorderStyle.SINGLE } },
              spacing: { after: 1200 }, children: []
            }),
            new Paragraph({
              spacing: { before: 1200, after: 200 }, alignment: AlignmentType.CENTER, children: [
                new TextRun({ text: "PROPOSTA DE SOLUCIONS DIGITALS", bold: true, size: 48, color: "1E1B4B" }) // Indigo-950
              ]
            }),
            new Paragraph({
              spacing: { after: 1200 }, alignment: AlignmentType.CENTER, children: [
                new TextRun({ text: "I AUTOMATITZACIÓ DE PROCESSOS", bold: true, size: 36, color: "6366F1" }) // Indigo-500
              ]
            }),
            new Paragraph({
              border: { bottom: { color: "C7D2FE", size: 6, space: 1, style: BorderStyle.SINGLE } }, // Indigo-200
              spacing: { after: 1200 }, children: []
            }),
            new Paragraph({
              spacing: { before: 2000, after: 200 }, alignment: AlignmentType.CENTER, children: [
                new TextRun({ text: "Preparat per a:", size: 28, color: "64748B" }) // Slate-500
              ]
            }),
            new Paragraph({
              spacing: { after: 1200 }, alignment: AlignmentType.CENTER, children: [
                new TextRun({ text: val(d.cliente.nombre, "Institució"), bold: true, size: 40, color: "1E1B4B" })
              ]
            }),
            new Paragraph({
              spacing: { before: 1000 }, alignment: AlignmentType.CENTER, children: [
                new TextRun({ text: `Referència: ${d.propuesta.referencia || "PROP-XXXX-XXXX"}`, size: 20, color: "64748B" }),
                new TextRun({ text: "", break: 1 }),
                new TextRun({ text: `Data: ${d.propuesta.fecha || new Date().toLocaleDateString()}`, size: 20, color: "64748B" }),
                new TextRun({ text: "", break: 1 }),
                new TextRun({ text: `Versió: ${d.propuesta.version || "1.0"}`, size: 20, color: "64748B" })
              ]
            }),
            new Paragraph({ children: [new PageBreak()] })
          ]
        },
        // CONTENT SECTIONS WITH HEADERS/FOOTERS
        {
          properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
          headers: {
            default: new Header({
              children: [
                new Paragraph({
                  border: { bottom: { color: COLORS.SECONDARY, size: 4, space: 1, style: BorderStyle.SINGLE } },
                  children: [
                    new TextRun({ text: val(d.consultora.nombre, "Adeptify Systems"), bold: true, color: COLORS.PRIMARY, size: 16 }),
                    new TextRun({ text: "\t\tPropuesta de Soluciones Digitales", italics: true, color: COLORS.GRAY, size: 16 })
                  ]
                })
              ]
            })
          },
          footers: {
            default: new Footer({
              children: [
                new Paragraph({
                  border: { top: { color: COLORS.SECONDARY, size: 4, space: 1, style: BorderStyle.SINGLE } },
                  children: [
                    new TextRun({ text: `CONFIDENCIAL | ${val(d.cliente.nombre)}`, color: COLORS.GRAY, size: 14 }),
                    new TextRun({ text: "\t\tPágina ", color: COLORS.GRAY, size: 14 }),
                    new TextRun({ children: [PageNumber.CURRENT], color: COLORS.GRAY, size: 14 })
                  ]
                })
              ]
            })
          },
          children: [
            new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("ÍNDICE DE CONTENIDOS")] }),
            new TableOfContents("Índice", { headingStyleRange: "1-3", hyperlink: true }),
            new Paragraph({ children: [new PageBreak()] }),
            ...bodyContent
          ]
        }
      ]
    });

    return await Packer.toBuffer(doc);
  }
}

module.exports = { WordProposalGenerator };
