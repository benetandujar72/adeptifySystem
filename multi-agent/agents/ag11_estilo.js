'use strict';

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

/**
 * AG-11 — Director de Estilo y Generación Visual
 *
 * Estrategia de generación "SI O SI":
 * 1. Intenta Gemini para imágenes creativas (mockup, diagrama, cronograma).
 * 2. Si falla Gemini, usa el generador local Python/PIL (generate_images.py).
 * 3. Si falla Python, usa dummyimage.com como último recurso.
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
      content_width: 9026,
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
 * Último recurso: Imagen de placeholder con texto.
 */
async function generarImagenPlaceholder(label) {
  try {
    const text = encodeURIComponent("Adeptify - " + label);
    const url = `https://dummyimage.com/800x450/2F1C6A/8C85FF.png&text=${text}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error("Status " + response.status);
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer).toString('base64');
  } catch (e) {
    console.error(`[AG-11] Error en placeholder para ${label}:`, e.message);
    return "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
  }
}

/**
 * Construye el JSON de entrada que generate_images.py espera,
 * a partir de los datos parciales que recibe AG-11 del orquestador.
 */
function buildImageInput(input) {
  const datosCliente = input.datos_cliente || input;
  const cliente = datosCliente.cliente || {};
  const arq = input.arquitectura || {};
  const ux = input.ux || {};
  const proj = input.cronograma || {};
  const integ = input.tecnologia || input.integraciones || {};
  const solucion = input.solucion || {};

  // Componentes de la solución
  const componentes = arq.componentes_solucion
    || arq.arquitectura?.componentes
    || solucion.componentes_solucion
    || [];

  // Flujo de datos
  const flujo = arq.arquitectura?.flujo_datos_principal
    || arq.flujo_datos_principal
    || '';

  // Fases del cronograma
  const cronograma = proj.cronograma || proj;
  const fases = cronograma.fases || [];
  const duracion_total = cronograma.duracion_total || '';

  // Features del dashboard
  const dashboard = ux.dashboard_principal || {};
  const features = dashboard.funcionalidades_clave
    || dashboard.features
    || ['Panel de control', 'Métricas', 'Automatización', 'Integraciones'];

  // Integraciones
  const mapa_integ = integ.mapa_integraciones
    || integ.integraciones
    || [];

  return {
    datos_cliente: {
      cliente: {
        nombre: cliente.nombre || datosCliente.nombre || 'Cliente',
        sector: cliente.sector || datosCliente.sector || '',
      },
    },
    ag04_arquitectura: {
      componentes_solucion: componentes,
      arquitectura: {
        flujo_datos_principal: flujo,
      },
    },
    ag05_ux: {
      dashboard_principal: {
        funcionalidades_clave: features,
      },
    },
    ag06_integraciones: {
      mapa_integraciones: mapa_integ,
    },
    ag07_proyecto: {
      cronograma: {
        fases: fases,
        duracion_total: duracion_total,
      },
    },
  };
}

/**
 * Ejecuta el script Python local para generar imágenes PIL.
 */
function generarImagenesLocales(inputData) {
  const scriptDir = path.resolve(__dirname, '..');
  const scriptPath = path.join(scriptDir, 'generate_images.py');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ag11-local-'));
  const tmpJson = path.join(tmpDir, 'input.json');

  if (!fs.existsSync(scriptPath)) {
    console.error('[AG-11] ERROR: No se encontró generate_images.py en:', scriptPath);
    return {};
  }

  try {
    // Verificar que PIL está disponible
    try {
      execSync('python3 -c "from PIL import Image, ImageDraw, ImageFont; print(\'PIL OK\')"', {
        timeout: 10000,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch (pilErr) {
      console.warn('[AG-11] PIL/Pillow no encontrado. Intentando instalar...');
      try {
        execSync('pip3 install Pillow --break-system-packages --quiet', {
          timeout: 60000,
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'pipe'],
        });
        console.log('[AG-11] Pillow instalado correctamente.');
      } catch (installErr) {
        console.error('[AG-11] ERROR: No se pudo instalar Pillow:', installErr.message);
        return {};
      }
    }

    fs.writeFileSync(tmpJson, JSON.stringify(inputData), 'utf8');
    console.log('[AG-11] Generando imágenes locales con Python...');
    const stdout = execSync(`python3 "${scriptPath}" "${tmpJson}" "${tmpDir}"`, {
      timeout: 45000,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: scriptDir,
    });

    const manifestPath = path.join(tmpDir, 'images_manifest.json');
    if (fs.existsSync(manifestPath)) {
      return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    }

    const jsonMatch = stdout.match(/--- JSON_OUTPUT_START ---\s*([\s\S]*?)\s*--- JSON_OUTPUT_END ---/);
    if (jsonMatch) return JSON.parse(jsonMatch[1]);

    return {};
  } catch (err) {
    console.error('[AG-11] Error en generador Python:', err.message);
    if (err.stderr) {
      console.error('[AG-11] stderr:', typeof err.stderr === 'string' ? err.stderr.slice(0, 800) : err.stderr.toString().slice(0, 800));
    }
    return {};
  } finally {
    try {
      if (fs.existsSync(tmpDir)) {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    } catch (e) { /* ignore */ }
  }
}

/**
 * Intenta generar imagen con Gemini (Imagen-3 fallback o Flash).
 */
async function intentarGeminiImagen(prompt, onTokens, label) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("[AG-11] No GEMINI_API_KEY. Saltant generació visual principal, usando fallback.");
    return null;
  }

  const targetModel = "gemini-3.1-flash-image-preview";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${apiKey}`;

  try {
    if (onTokens) onTokens({ input_tokens: 300, output_tokens: 100 }, 'AG-11');
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      signal: AbortSignal.timeout(18000)
    });

    if (!res.ok) {
      console.warn(`[AG-11] Error HTTP ${res.status} a Gemini Img. Fallback activado.`);
      return null;
    }
    const data = await res.json();
    const parts = data.candidates?.[0]?.content?.parts || [];
    for (const p of parts) {
      if (p.inlineData?.data) return p.inlineData.data;
    }
    console.warn(`[AG-11] La resposta Gemini no contenia 'inlineData.data' per la imatge. Fallback activado.`);
    return null;
  } catch (e) {
    console.warn(`[AG-11] Excepció cridant a Gemini para ${label}:`, e.message, "- Usando fallback.");
    return null;
  }
}

/**
 * Orquestador de generación visual por imagen.
 */
async function obtenerImagen(prompt, keyInLocal, label, localResults, onTokens) {
  // 1. Intentar Gemini
  const geminiImg = await intentarGeminiImagen(prompt, onTokens, label);
  if (geminiImg) {
    console.log(`[AG-11] ✅ Imagen '${label}' generada con Gemini.`);
    return geminiImg;
  }

  // 2. Usar resultado local de Python
  if (localResults[keyInLocal]) {
    console.log(`[AG-11] ✅ Imagen '${label}' obtenida de generador local.`);
    return localResults[keyInLocal];
  }

  // 3. DummyImage placeholder
  console.warn(`[AG-11] ⚠️ Imagen '${label}' no disponible, usando placeholder.`);
  return await generarImagenPlaceholder(label);
}

/**
 * Método RUN principal.
 * Recibe datos de Arquitectura, UX, Cronograma, Solución e Integraciones
 * del orquestador, genera TODAS las imágenes con Python PIL, y retorna
 * las reglas de estilo + las imágenes en base64.
 *
 * @param {object} input - Datos del orquestador
 * @returns {object} { estilos, visuales }
 */
async function run(input) {
  console.log('[AG-11] Iniciando motor visual SI o SI...');

  // 1. Construir input para el generador de imágenes local
  const imageInputForLocal = buildImageInput(input);

  const clientName = imageInputForLocal.datos_cliente?.cliente?.nombre || 'Cliente';
  const numComponents = (imageInputForLocal.ag04_arquitectura?.componentes_solucion || []).length;
  const numPhases = (imageInputForLocal.ag07_proyecto?.cronograma?.fases || []).length;
  const numIntegrations = (imageInputForLocal.ag06_integraciones?.mapa_integraciones || []).length;

  console.log(`[AG-11] Datos de entrada: cliente="${clientName}", componentes=${numComponents}, fases=${numPhases}, integraciones=${numIntegrations}`);

  // 2. Generar pool de imágenes base con Python (rápido y garantizado offline)
  const localResults = generarImagenesLocales(imageInputForLocal);

  // Prompts para Gemini
  const pMockup = `Generate a modern software dashboard mockup for ${clientName}. Sleek UI, professional charts.`;
  const pDiagram = `Technical architecture diagram for ${clientName}. Cloud nodes, security layers, professional.`;
  const pCron = `Project timeline Gantt chart for ${clientName}. Colorful phases, milestones.`;

  // 3. Generación paralela de imágenes con fallback
  const [mockup, diagrama, cronograma] = await Promise.all([
    obtenerImagen(pMockup, 'mockup_base64', 'Mockup UX', localResults, input._onTokens),
    obtenerImagen(pDiagram, 'diagrama_base64', 'Arquitectura', localResults, input._onTokens),
    obtenerImagen(pCron, 'cronograma_base64', 'Cronograma', localResults, input._onTokens)
  ]);

  const visuales = {
    logo_base64: localResults.logo_base64 || null,
    logo_white_base64: localResults.logo_white_base64 || null,
    portada_base64: localResults.cover_base64 || null,
    mockup_base64: mockup,
    diagrama_base64: diagrama,
    cronograma_base64: cronograma,
    workflow_base64: localResults.workflow_base64 || null,
    integraciones_base64: localResults.integraciones_base64 || null
  };

  // 4. Log de resultados
  const generadas = Object.entries(visuales).filter(([, v]) => v && v !== "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=").map(([k]) => k);
  const fallidas = Object.entries(visuales).filter(([, v]) => !v || v === "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=").map(([k]) => k);

  if (generadas.length > 0) {
    console.log(`[AG-11] ✅ Imágenes generadas (${generadas.length}): ${generadas.join(', ')}`);
  }
  if (fallidas.length > 0) {
    console.warn(`[AG-11] ⚠️ Imágenes no disponibles (${fallidas.length}): ${fallidas.join(', ')}`);
  }

  // Reportar uso de tokens (estimación local, sin API externa)
  if (input._onTokens) {
    input._onTokens({ input_tokens: 50, output_tokens: 50 }, 'AG-11');
  }

  return {
    estilos: getStyleRules(),
    visuales
  };
}

module.exports = { getStyleRules, run };
