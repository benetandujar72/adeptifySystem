'use strict';

/**
 * AG-11 — Director de Estilo
 * Módulo estático — NO llama a la API de Anthropic.
 * Retorna las reglas de formato y estilo de Adeptify Systems.
 */
function getStyleRules() {
  return {
    marca: {
      nombre: 'Adeptify Systems',
      claim: 'Ens adaptem a la teva realitat. Com un camaleó digital, cada solució és única.',
      web: 'https://adeptify.es',
    },
    colores: {
      meteorite_dark: '2F1C6A',
      primary_purple: '673DE6',
      meteorite_light: '8C85FF',
      texto_principal: '333333',
      texto_secundario: '666666',
      fondo_tablas_par: 'F3F0FF',
      fondo_tablas_impar: 'FFFFFF',
      bordes_tablas: 'D4CCFF',
      header_tablas_bg: '2F1C6A',
      header_tablas_text: 'FFFFFF',
      fondo_portada: '2F1C6A',
      acento_portada: '8C85FF',
    },
    tipografia: {
      principal: 'Lato',
      fallback: 'Arial',
      // docx usa half-points (1pt = 2 half-points)
      h1: { font: 'Lato', size: 32, bold: true, color: '2F1C6A', spacing_after: 200 },
      h2: { font: 'Lato', size: 26, bold: true, color: '673DE6', spacing_after: 160 },
      h3: { font: 'Lato', size: 22, bold: true, color: '8C85FF', spacing_after: 120 },
      body: { font: 'Lato', size: 22, color: '333333', spacing_after: 120, line_rule: 'auto', line: 276 },
      tabla_header: { font: 'Lato', size: 20, bold: true, color: 'FFFFFF' },
      tabla_body: { font: 'Lato', size: 20, color: '333333' },
      caption: { font: 'Lato', size: 18, color: '666666', italic: true },
      header_footer: { font: 'Lato', size: 16, color: '666666' },
    },
    pagina: {
      tamano: 'A4',
      width: 11906,
      height: 16838,
      margin_top: 1440,
      margin_bottom: 1440,
      margin_left: 1440,
      margin_right: 1440,
      content_width: 9026, // 11906 - 1440 - 1440
    },
    tablas: {
      width_total: 9026,
      width_type: 'DXA',
      shading_type: 'CLEAR',
      cell_margin_top: 80,
      cell_margin_bottom: 80,
      cell_margin_left: 120,
      cell_margin_right: 120,
      border_color: 'D4CCFF',
      border_size: 4,
      border_style: 'single',
    },
    espaciado: {
      spacing_after_paragraph: 120,
      spacing_after_heading: 160,
      indent_first_line: 0,
      page_break_before_h1: true,
    },
  };
}

/**
 * Función que llama a Gemini Flash para generar imagen y devuelve arraybuffer
 */
async function generarImagenGemini(prompt, onTokens) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("[AG-11] No GEMINI_API_KEY. Saltant generació visual.");
    return null;
  }

  const model = "gemini-3.1-flash-image-preview";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  try {
    // Estimación teórica de tokens para presupuesto
    if (onTokens) onTokens({ input_tokens: 200, output_tokens: 50 }, 'AG-11');

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      })
    });

    if (!response.ok) {
      console.warn(`[AG-11] Error HTTP ${response.status} a Gemini Img`);
      return null;
    }

    const data = await response.json();
    if (data.candidates && data.candidates[0]?.content?.parts) {
      for (const p of data.candidates[0].content.parts) {
        if (p.inlineData && p.inlineData.data) {
          return p.inlineData.data; // Data es base64
        }
      }
    }
    console.warn(`[AG-11] La resposta Gemini no contenia 'inlineData.data' per la imatge.`);
    return null;
  } catch (e) {
    console.error("[AG-11] Excepció cridant a Gemini:", e.message);
    return null;
  }
}

/**
 * Mètode run principal de l'agent. 
 * Rebrà la info d'Arquitectura, UX i Cronograma de l'orquestrador.
 */
async function run(input) {
  const metaCliente = input.cliente || {};
  const cName = metaCliente.nombre || "l'empresa client";

  // Extraiem detalls per afinar el prompt darrere scenes
  const arq = input.arquitectura?.arquitectura?.flujo_datos_principal || "Arquitectura d'automatització cloud";
  const ux = input.ux?.dashboard_principal?.funcionalidades_clave?.join(", ") || "Panell de control i indicadors d'estalvi de temps";
  const proj = input.cronograma?.cronograma?.fases || [];

  // PROMPTS VISUALS
  const promptMockup = `Generate a highly professional, modern, and detailed mockup screenshot of a software dashboard for ${cName}. 
It should feature an intuitive UI, with dark mode or sleek enterprise design, showing metrics for: ${ux}. 
Make it look like a real, high-end SaaS product interface. No text should be perfectly legible, prioritize the aesthetic and structure. Isometric angle or straight flat view.`;

  const promptDiagrama = `Generate a high-tech, futuristic but clean and professional network or architecture diagram for a digital transformation project. 
It represents: ${arq}. Use glowing neon lines, isometric 3d blocks, connected nodes, servers, and cloud icons on a dark professional background. Very sleek.`;

  const promptCronograma = `Generate a horizontal timeline or Gantt chart infographic showing a ${proj.length}-phase project. 
Modern corporate style, minimalist, using primary colors like deep blue and purple. Show milestones and connected process steps.`;

  // Paral·lelitzem les peticions
  const [mockupB64, diagramaB64, cronogramaB64] = await Promise.all([
    generarImagenGemini(promptMockup, input._onTokens),
    generarImagenGemini(promptDiagrama, input._onTokens),
    generarImagenGemini(promptCronograma, input._onTokens)
  ]);

  return {
    estilos: getStyleRules(),
    visuales: {
      mockup_base64: mockupB64,
      diagrama_base64: diagramaB64,
      cronograma_base64: cronogramaB64
    }
  };
}

module.exports = { getStyleRules, run };
