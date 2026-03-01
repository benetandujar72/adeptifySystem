
import { 
  Document, Packer, Paragraph, TextRun, HeadingLevel, 
  AlignmentType, Table, TableRow, TableCell, WidthType, 
  ShadingType, PageBreak, Header, Footer, PageNumber, 
  TableOfContents, ImageRun
} from "docx";

const COLORS = {
  PRIMARY: "1B3A5C",
  SECONDARY: "2E75B6",
  ACCENT: "4A90D9",
  DARK: "1A1A1A",
  LIGHT_BG: "E8F0FE",
  BORDER: "B0C4DE"
};

export class WordProposalGenerator {
  async generate(data, images) {
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
              border: { bottom: { color: COLORS.SECONDARY, size: 6, style: "single", space: 1 } }
            }
          }
        ]
      },
      sections: [
        {
          properties: { page: { size: { width: 12240, height: 15840 } } },
          children: [
            new Paragraph({ spacing: { before: 2400 }, alignment: AlignmentType.CENTER, children: [
              new TextRun({ text: "ADEPTIFY SYSTEMS", bold: true, size: 56, color: COLORS.PRIMARY })
            ]}),
            new Paragraph({ spacing: { before: 400 }, alignment: AlignmentType.CENTER, children: [
              new TextRun({ text: (data.proyecto.titulo || "PROPOSTA ESTRATÈGICA").toUpperCase(), bold: true, size: 28, color: COLORS.SECONDARY })
            ]}),
            new Paragraph({ spacing: { before: 4000 }, alignment: AlignmentType.RIGHT, children: [
              new TextRun({ text: `CLIENT: \${data.cliente.nombre}`, bold: true, size: 24 }),
              new TextRun({ text: "
", break: 1 }),
              new TextRun({ text: `PROPOSTA: \${data.propuesta.codigo}`, size: 20 }),
              new TextRun({ text: "
", break: 1 }),
              new TextRun({ text: `DATA: \${data.propuesta.fecha}`, size: 20 })
            ]}),
            new Paragraph({ children: [new PageBreak()] })
          ]
        },
        {
          headers: {
            default: new Header({
              children: [
                new Paragraph({
                  border: { bottom: { color: COLORS.SECONDARY, size: 6, style: "single" } },
                  children: [
                    new TextRun({ text: "ADEPTIFY SYSTEMS | CONSULTORIA DIGITAL", bold: true, color: COLORS.PRIMARY, size: 16 }),
                    new TextRun({ text: "		Proposta Estratègica de Transformació", italics: true, color: "666666", size: 16 })
                  ]
                })
              ]
            })
          },
          footers: {
            default: new Footer({
              children: [
                new Paragraph({
                  border: { top: { color: COLORS.SECONDARY, size: 6, style: "single" } },
                  children: [
                    new TextRun({ text: `CONFIDENCIAL | \${data.cliente.nombre}`, color: "666666", size: 14 }),
                    new TextRun({ text: "		Pàgina ", color: "666666", size: 14 }),
                    new TextRun({ children: [PageNumber.CURRENT], color: "666666", size: 14 })
                  ]
                })
              ]
            })
          },
          children: [
            new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("ÍNDEX DE CONTINGUTS")] }),
            new TableOfContents("Continguts", { headingStyleRange: "1-3", hyperlink: true }),
            new Paragraph({ children: [new PageBreak()] }),

            new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("1. RESUM EXECUTIU")] }),
            new Paragraph({ children: [new TextRun(data.proyecto.resumen || "[Pendent]")] }),

            new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("2. CONTEXT I DIAGNÒSTIC DE SITUACIÓ")] }),
            new Paragraph({ children: [new TextRun(data.diagnostico.entorno || "[Pendent]")] }),
            
            new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("3. SOLUCIÓ PROPOSADA")] }),
            new Paragraph({ children: [new TextRun(data.solucion.vision || "[Pendent]")] }),
            
            new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("7. PROPUESTA ECONÒMICA")] }),
            new Table({
              width: { size: 9360, type: WidthType.DXA },
              rows: [
                new TableRow({
                  children: [
                    new TableCell({ shading: { fill: COLORS.PRIMARY }, children: [new Paragraph({ children: [new TextRun({ text: "CONCEPTE", color: "FFFFFF", bold: true })] })] }),
                    new TableCell({ shading: { fill: COLORS.PRIMARY }, children: [new Paragraph({ children: [new TextRun({ text: "IMPORT", color: "FFFFFF", bold: true })] })] })
                  ]
                }),
                ...(data.economia.conceptos || []).map((c, i) => new TableRow({
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
                new TableRow({
                  children: [
                    new TableCell({ children: [
                      new Paragraph({ spacing: { before: 1200 }, children: [new TextRun({ text: "Per Adeptify Systems SLU", bold: true })] }),
                      new Paragraph({ children: [new TextRun("Benet Andújar, Director Estratègic")] })
                    ]}),
                    new TableCell({ children: [
                      new Paragraph({ spacing: { before: 1200 }, children: [new TextRun({ text: `Per \${data.cliente.nombre}`, bold: true })] }),
                      new Paragraph({ children: [new TextRun(`Dra. María García López`)] })
                    ]})
                  ]
                })
              ]
            })
          ]
        }
      ]
    });

    return await Packer.toBuffer(doc);
  }
}
