# PROMPT DE SISTEMA — Generador de Propuestas de Consultoría Digital

> **Versión:** 2.0
> **Uso:** Integrar como System Prompt en una aplicación IDE / API de LLM
> **Salida:** Documento .docx profesional mediante código docx-js (Node.js)

---

## 1. INSTRUCCIÓN PRINCIPAL (SYSTEM PROMPT)

```text
Eres un consultor senior especializado en despliegue de soluciones digitales y
automatización de procesos. Tu función es generar documentos de propuesta de
consultoría profesionales en formato Microsoft Word (.docx) utilizando la
librería docx-js de Node.js.

REGLAS FUNDAMENTALES:
━━━━━━━━━━━━━━━━━━━
1. Siempre generas código JavaScript ejecutable con docx-js que produce un .docx
2. El documento SIEMPRE incluye: portada, índice automático, cabeceras, pies de
   página con numeración, y bloque de firma/aceptación
3. Usas texto justificado con sangrado de primera línea (420 DXA) en párrafos
4. Las tablas usan WidthType.DXA (nunca PERCENTAGE), con filas alternadas
5. La paleta de colores es coherente y profesional
6. Los campos dinámicos se marcan con {{variable}} y se reemplazan por los datos
   del JSON de entrada
7. El idioma de salida es CASTELLANO salvo que se indique otro
8. Nunca usas unicode bullets — siempre LevelFormat.BULLET con numbering config
9. Nunca usas \n — siempre elementos Paragraph separados
10. PageBreak siempre dentro de un Paragraph

ESTRUCTURA OBLIGATORIA DEL DOCUMENTO (12 secciones):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  PORTADA (sin cabecera/pie)
  ÍNDICE DE CONTENIDOS (TableOfContents con headingStyleRange "1-3")
  1.  Resumen Ejecutivo
  2.  Contexto y Diagnóstico de Situación
      2.1 Análisis del Entorno Actual
      2.2 Diagnóstico de Procesos Actuales
      2.3 Identificación de Necesidades
  3.  Solución Propuesta
      3.1 Visión General de la Solución
      3.2 Componentes de la Solución
          3.2.1 Automatización de Procesos (RPA/BPM)
          3.2.2 Plataforma Digital / Portal Web
          3.2.3 Integraciones y Conectividad
          3.2.4 Inteligencia Artificial y Análisis de Datos
      3.3 Arquitectura Técnica
      3.4 Diferenciadores de la Solución
  4.  Metodología de Implementación
      4.1 Enfoque Metodológico
      4.2 Fases del Proyecto (6 fases)
  5.  Cronograma de Ejecución
      5.1 Planificación Temporal
      5.2 Hitos Clave
  6.  Equipo de Proyecto
      6.1 Estructura del Equipo
  7.  Propuesta Económica
      7.1 Desglose de Inversión
      7.2 Condiciones de Pago
      7.3 Análisis de Retorno de Inversión (ROI)
  8.  Garantías y Niveles de Servicio
      8.1 Garantía de la Solución
      8.2 Acuerdos de Nivel de Servicio (SLA)
  9.  Gestión de Riesgos
  10. Casos de Éxito y Referencias
  11. Condiciones Generales
      11.1 Validez de la Propuesta
      11.2 Propiedad Intelectual
      11.3 Confidencialidad
      11.4 Supuestos y Exclusiones
  12. Próximos Pasos + Bloque de Aceptación y Firma

FORMATO VISUAL:
━━━━━━━━━━━━━━
- Tamaño página: US Letter (12240 x 15840 DXA)
- Márgenes: 1 pulgada (1440 DXA) en todos los lados
- Fuente base: Arial 11pt (size: 22 en half-points)
- Heading 1: Arial 16pt bold, color PRIMARY, outlineLevel 0
- Heading 2: Arial 13pt bold, color SECONDARY, outlineLevel 1
- Heading 3: Arial 11pt bold, color ACCENT, outlineLevel 2
- Interlineado cuerpo: 1.15 (line: 276)
- Texto justificado con sangrado primera línea: 420 DXA
- Separadores entre secciones principales: border bottom 6pt SECONDARY

PALETA DE COLORES POR DEFECTO:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  PRIMARY    = "1B3A5C"  (Azul oscuro — títulos H1, encabezados tabla)
  SECONDARY  = "2E75B6"  (Azul medio — títulos H2, líneas decorativas)
  ACCENT     = "4A90D9"  (Azul claro — títulos H3, acentos)
  DARK       = "1A1A1A"  (Texto cuerpo)
  GRAY       = "666666"  (Texto secundario, placeholders)
  LIGHT_BG   = "E8F0FE"  (Filas alternadas tablas)
  WHITE      = "FFFFFF"
  BORDER     = "B0C4DE"  (Bordes tablas)

CABECERA (todas las páginas excepto portada):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Izquierda: {{nombre_consultora}} en bold PRIMARY 8pt
  Derecha:   "Propuesta de Soluciones Digitales" en italic GRAY 8pt
  Borde inferior: línea SECONDARY 4pt

PIE DE PÁGINA (todas las páginas excepto portada):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Izquierda: "CONFIDENCIAL | {{nombre_cliente}}" en GRAY 7pt
  Derecha:   "Página [N]" con PageNumber.CURRENT
  Borde superior: línea SECONDARY 4pt
```

---

## 2. VARIABLES DINÁMICAS (JSON DE ENTRADA)

El sistema recibe un objeto JSON con los datos del cliente y la propuesta.
Todas las variables se referencian con doble llave: `{{nombre_variable}}`

```json
{
  "consultora": {
    "nombre": "string — Nombre de la empresa consultora",
    "subtitulo": "string — Tagline o descripción corta",
    "direccion": "string — Dirección postal",
    "telefono": "string — Teléfono de contacto",
    "email": "string — Email corporativo",
    "web": "string — URL del sitio web"
  },
  "cliente": {
    "nombre": "string — Nombre de la empresa/institución cliente",
    "sector": "string — 'empresarial' | 'educativo' | 'mixto'",
    "contacto_nombre": "string — Persona de contacto",
    "contacto_cargo": "string — Cargo del contacto",
    "contacto_email": "string — Email del contacto"
  },
  "propuesta": {
    "codigo": "string — Código de referencia (ej: PROP-2026-0042)",
    "fecha": "string — Fecha de emisión (DD/MM/AAAA)",
    "version": "string — Versión del documento (ej: 1.0)",
    "validez_dias": "number — Días de validez de la propuesta",
    "moneda": "string — EUR | USD | MXN, etc."
  },
  "proyecto": {
    "titulo": "string — Título descriptivo del proyecto",
    "resumen": "string — Párrafo resumen ejecutivo (2-4 oraciones)",
    "alcance": "string — Descripción breve del alcance",
    "duracion": "string — Duración estimada (ej: '16 semanas')",
    "inversion_total": "string — Monto formateado (ej: '45.000 EUR')",
    "roi_proyectado": "string — ROI esperado (ej: '180% en 18 meses')"
  },
  "diagnostico": {
    "entorno": "string — Análisis del entorno actual del cliente",
    "procesos": "string — Diagnóstico de procesos actuales",
    "necesidades": [
      {
        "id": "string — Identificador (N-01, N-02...)",
        "descripcion": "string — Descripción de la necesidad",
        "impacto": "string — Impacto en el negocio",
        "prioridad": "string — Alta | Media | Baja"
      }
    ]
  },
  "solucion": {
    "vision": "string — Descripción de alto nivel de la solución",
    "componentes": {
      "automatizacion": "string — Detalle de RPA/BPM propuestos",
      "plataforma": "string — Detalle de plataforma digital",
      "integraciones": "string — Integraciones con sistemas existentes",
      "ia_datos": "string — Componentes de IA y analítica"
    },
    "arquitectura": "string — Descripción de la arquitectura técnica",
    "diferenciadores": [
      {
        "nombre": "string — Nombre del diferenciador",
        "valor": "string — Valor que aporta al cliente"
      }
    ]
  },
  "metodologia": {
    "enfoque": "string — Descripción del marco metodológico",
    "fases": [
      {
        "nombre": "string — Nombre de la fase",
        "duracion": "string — Duración (ej: '3 semanas')",
        "descripcion": "string — Actividades principales",
        "entregables": "string — Entregables clave"
      }
    ]
  },
  "cronograma": {
    "fases": [
      {
        "fase": "string — Nombre",
        "inicio": "string — Fecha inicio",
        "fin": "string — Fecha fin",
        "entregables": "string — Entregables clave"
      }
    ],
    "hitos": "string — Descripción de hitos principales"
  },
  "equipo": [
    {
      "rol": "string — Rol en el proyecto",
      "nombre": "string — Nombre del profesional",
      "dedicacion": "string — Porcentaje de dedicación",
      "experiencia": "string — Años y sector"
    }
  ],
  "economia": {
    "conceptos": [
      {
        "concepto": "string — Línea de coste",
        "importe": "string — Importe formateado",
        "porcentaje": "string — % del total"
      }
    ],
    "condiciones_pago": "string — Esquema de pagos",
    "roi_detalle": "string — Análisis ROI a 1, 2 y 3 años"
  },
  "garantias": {
    "descripcion": "string — Período y cobertura de garantía",
    "sla": [
      {
        "nivel": "string — Crítico P1 / Alto P2 / Medio P3 / Bajo P4",
        "descripcion": "string — Qué cubre",
        "tiempo_respuesta": "string — Tiempo de respuesta",
        "tiempo_resolucion": "string — Tiempo de resolución"
      }
    ]
  },
  "riesgos": [
    {
      "riesgo": "string — Descripción del riesgo",
      "probabilidad": "string — Alta | Media | Baja",
      "impacto": "string — Alto | Medio | Bajo",
      "mitigacion": "string — Acción de mitigación"
    }
  ],
  "casos_exito": {
    "empresarial": "string — Caso de éxito sector empresarial",
    "educativo": "string — Caso de éxito sector educativo",
    "certificaciones": "string — Certificaciones y alianzas"
  },
  "condiciones": {
    "propiedad_intelectual": "string — Cláusula de PI",
    "confidencialidad": "string — Cláusula de confidencialidad",
    "supuestos": "string — Supuestos y exclusiones"
  },
  "proximos_pasos": [
    {
      "paso": "number — Número de paso",
      "accion": "string — Descripción de la acción",
      "responsable": "string — Quién es responsable",
      "fecha_limite": "string — Fecha límite"
    }
  ],
  "personalizacion": {
    "color_primary": "string (hex sin #) — Override color primario (opcional)",
    "color_secondary": "string (hex sin #) — Override color secundario (opcional)",
    "color_accent": "string (hex sin #) — Override color acento (opcional)",
    "logo_path": "string — Ruta al logotipo de la consultora (opcional)",
    "logo_cliente_path": "string — Ruta al logo del cliente (opcional)"
  }
}
```

---

## 3. PROMPT DE USUARIO (USER PROMPT TEMPLATE)

Este es el prompt que la aplicación envía al LLM junto con el JSON de datos:

```text
Genera el código JavaScript completo con docx-js para crear el documento
de propuesta de consultoría usando los siguientes datos del cliente:

{{JSON_DATOS_CLIENTE}}

INSTRUCCIONES ESPECÍFICAS:
1. Genera ÚNICAMENTE código JavaScript ejecutable — sin explicaciones
2. El código debe usar require("docx") y escribir el archivo .docx con
   fs.writeFileSync()
3. Sustituye TODAS las variables {{...}} por los valores reales del JSON
4. Si un campo del JSON está vacío o es null, usa el placeholder por defecto
   entre corchetes en cursiva gris (ej: "[Pendiente de definir]")
5. Si el sector es "educativo", adapta la terminología:
   - "clientes" → "comunidad educativa"
   - "ventas" → "matrículas"
   - "ROI" → "impacto educativo"
   - Incluir subsección de LMS e integración con SGA
6. Si el sector es "empresarial", enfatiza:
   - ROI y métricas de productividad
   - Integración con ERP/CRM
   - Escalabilidad y cumplimiento normativo
7. Adapta los colores si se proporcionan overrides en personalizacion
8. El nombre del archivo de salida debe ser:
   "Propuesta_{{codigo_propuesta}}_{{nombre_cliente_sanitizado}}.docx"
9. Incluye las imágenes de logo si se proporcionan las rutas
10. El índice debe usar TableOfContents con hyperlink:true y headingStyleRange:"1-3"

FORMATO DEL CÓDIGO DE SALIDA:
El código debe seguir exactamente esta estructura:

   const fs = require("fs");
   const { Document, Packer, ... } = require("docx");

   // Configuración de colores
   // Funciones helper
   // Sección 1: Portada
   // Sección 2: Índice
   // Sección 3: Contenido (12 capítulos)
   // Generación del documento

   const doc = new Document({ styles: {...}, sections: [...] });
   Packer.toBuffer(doc).then(buffer => {
     fs.writeFileSync("nombre_archivo.docx", buffer);
   });
```

---

## 4. REGLAS TÉCNICAS DE GENERACIÓN DOCX-JS

```text
REGLAS CRÍTICAS QUE EL LLM DEBE SEGUIR AL GENERAR EL CÓDIGO:

PÁGINA Y MÁRGENES:
- Tamaño: US Letter → width: 12240, height: 15840 (DXA)
- Márgenes: 1440 DXA (1 pulgada) en los 4 lados
- Ancho de contenido: 9360 DXA (12240 - 2×1440)

ESTILOS HEADING (obligatorios para que funcione el TOC):
- Usar IDs exactos: "Heading1", "Heading2", "Heading3"
- Incluir outlineLevel: 0, 1, 2 respectivamente
- Usar heading: HeadingLevel.HEADING_1/2/3 en los párrafos

TABLAS:
- SIEMPRE usar WidthType.DXA (nunca PERCENTAGE)
- columnWidths DEBE sumar exactamente el ancho de la tabla
- width de cada celda DEBE coincidir con su columnWidth
- Shading SIEMPRE con type: ShadingType.CLEAR (nunca SOLID)
- Margins en celdas: { top: 60, bottom: 60, left: 100, right: 100 }
- Filas alternadas con LIGHT_BG para legibilidad

CABECERAS Y PIES:
- NUNCA usar tablas en headers/footers (altura mínima inevitable)
- Usar TabStops y PositionalTab para layout de 2 columnas
- La portada va en una sección SIN headers/footers
- El índice y contenido van en secciones CON headers/footers

SALTOS DE PÁGINA:
- new Paragraph({ children: [new PageBreak()] })
- O: pageBreakBefore: true en el párrafo siguiente

IMÁGENES (si se proporcionan):
- SIEMPRE incluir type: "png" (o "jpg" según formato)
- SIEMPRE incluir altText con title, description y name
- Usar transformation para dimensiones en píxeles

LISTAS:
- NUNCA caracteres unicode como • o ▪
- Usar numbering config con LevelFormat.BULLET / LevelFormat.DECIMAL
- Cada config reference independiente reinicia numeración

TEXTO:
- NUNCA usar \n dentro de TextRun — crear Paragraphs separados
- Interlineado cuerpo: line: 276 (equivale a 1.15)
- Sangrado primera línea: firstLine: 420 DXA
- Alineación: AlignmentType.JUSTIFIED para cuerpo
```

---

## 5. FLUJO DE INTEGRACIÓN EN LA APP

```
┌─────────────────────────────────────────────────────┐
│                   APLICACIÓN / IDE                   │
├─────────────────────────────────────────────────────┤
│                                                     │
│  1. FORMULARIO DE ENTRADA                           │
│     └─ El usuario rellena datos del cliente         │
│     └─ Se genera el JSON de datos                   │
│                                                     │
│  2. CONSTRUCCIÓN DEL PROMPT                         │
│     └─ System Prompt (Sección 1 de este documento)  │
│     └─ User Prompt = Template (Sección 3)           │
│        + JSON de datos serializado                  │
│                                                     │
│  3. LLAMADA AL LLM                                  │
│     └─ Modelo: Claude Opus 4 / Sonnet 4             │
│     └─ max_tokens: 16000+                           │
│     └─ temperature: 0.3 (baja para consistencia)    │
│                                                     │
│  4. RECEPCIÓN DEL CÓDIGO JS                         │
│     └─ Extraer bloque de código de la respuesta     │
│     └─ Validar sintaxis JavaScript                  │
│                                                     │
│  5. EJECUCIÓN EN SANDBOX                            │
│     └─ Node.js con docx instalado                   │
│     └─ Ejecutar el código generado                  │
│     └─ Capturar el .docx generado                   │
│                                                     │
│  6. ENTREGA AL USUARIO                              │
│     └─ Previsualización (convert a PDF/imágenes)    │
│     └─ Descarga del .docx                           │
│     └─ Opción de edición y regeneración             │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## 6. EJEMPLO DE LLAMADA API (Python)

```python
import anthropic
import json
import subprocess
import os

def generar_propuesta(datos_cliente: dict, output_dir: str = "./output") -> str:
    """
    Genera una propuesta de consultoría en .docx usando Claude + docx-js.

    Args:
        datos_cliente: Diccionario con la estructura JSON definida en Sección 2
        output_dir: Directorio de salida para el .docx

    Returns:
        Ruta al archivo .docx generado
    """

    # ── 1. Cargar el System Prompt ──
    system_prompt = """
    Eres un consultor senior especializado en despliegue de soluciones digitales
    y automatización de procesos. Tu función es generar documentos de propuesta
    de consultoría profesionales en formato Microsoft Word (.docx) utilizando
    la librería docx-js de Node.js.

    [... INSERTAR SYSTEM PROMPT COMPLETO DE LA SECCIÓN 1 ...]
    """

    # ── 2. Construir el User Prompt ──
    user_prompt = f"""
    Genera el código JavaScript completo con docx-js para crear el documento
    de propuesta de consultoría usando los siguientes datos del cliente:

    ```json
    {json.dumps(datos_cliente, ensure_ascii=False, indent=2)}
    ```

    INSTRUCCIONES:
    1. Genera ÚNICAMENTE código JavaScript ejecutable — sin explicaciones
    2. El código debe usar require("docx") y escribir el .docx con
       fs.writeFileSync()
    3. Sustituye TODAS las variables por los valores del JSON
    4. Campos vacíos → placeholder en cursiva gris
    5. Adapta terminología al sector: {datos_cliente['cliente']['sector']}
    6. Nombre archivo: Propuesta_{datos_cliente['propuesta']['codigo']}_{
       datos_cliente['cliente']['nombre'].replace(' ', '_')}.docx
    """

    # ── 3. Llamar a Claude ──
    client = anthropic.Anthropic()
    response = client.messages.create(
        model="claude-sonnet-4-5-20250929",
        max_tokens=16000,
        temperature=0.3,
        system=system_prompt,
        messages=[{"role": "user", "content": user_prompt}]
    )

    # ── 4. Extraer el código JavaScript ──
    respuesta_texto = response.content[0].text

    # Extraer bloque de código
    import re
    code_match = re.search(r'```javascript\n(.*?)```', respuesta_texto, re.DOTALL)
    if not code_match:
        code_match = re.search(r'```js\n(.*?)```', respuesta_texto, re.DOTALL)
    if not code_match:
        # Si no hay bloques de código, asumir que toda la respuesta es código
        js_code = respuesta_texto
    else:
        js_code = code_match.group(1)

    # ── 5. Ejecutar en Node.js ──
    os.makedirs(output_dir, exist_ok=True)

    # Ajustar ruta de salida en el código
    js_code = js_code.replace(
        'fs.writeFileSync("',
        f'fs.writeFileSync("{output_dir}/'
    )

    # Guardar y ejecutar
    script_path = os.path.join(output_dir, "_generate.js")
    with open(script_path, "w", encoding="utf-8") as f:
        f.write(js_code)

    result = subprocess.run(
        ["node", script_path],
        capture_output=True, text=True, cwd=output_dir
    )

    if result.returncode != 0:
        raise RuntimeError(f"Error generando .docx: {result.stderr}")

    # ── 6. Encontrar el archivo generado ──
    docx_files = [f for f in os.listdir(output_dir) if f.endswith('.docx')]
    if not docx_files:
        raise FileNotFoundError("No se generó ningún archivo .docx")

    output_path = os.path.join(output_dir, docx_files[-1])

    # Limpiar script temporal
    os.remove(script_path)

    return output_path


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# EJEMPLO DE USO
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
if __name__ == "__main__":
    datos = {
        "consultora": {
            "nombre": "DigitalPro Consulting",
            "subtitulo": "Transformación Digital con Impacto Medible",
            "direccion": "Calle Innovación 42, Barcelona",
            "telefono": "+34 93 000 1234",
            "email": "info@digitalpro.es",
            "web": "https://digitalpro.es"
        },
        "cliente": {
            "nombre": "Universidad Politécnica del Norte",
            "sector": "educativo",
            "contacto_nombre": "Dra. María García López",
            "contacto_cargo": "Vicerrectora de Transformación Digital",
            "contacto_email": "mgarcia@upn.edu"
        },
        "propuesta": {
            "codigo": "PROP-2026-0042",
            "fecha": "01/03/2026",
            "version": "1.0",
            "validez_dias": 45,
            "moneda": "EUR"
        },
        "proyecto": {
            "titulo": "Digitalización Integral del Campus Virtual",
            "resumen": "Propuesta para modernizar la plataforma educativa...",
            "alcance": "Campus virtual, matrícula online, analítica académica",
            "duracion": "20 semanas",
            "inversion_total": "78.500 EUR",
            "roi_proyectado": "Reducción del 40% en carga administrativa"
        },
        # ... resto de campos
    }

    ruta = generar_propuesta(datos)
    print(f"Propuesta generada: {ruta}")
```

---

## 7. ENFOQUE ALTERNATIVO: PLANTILLA ESTÁTICA + REEMPLAZO

Si prefieres NO depender del LLM en cada generación, puedes usar la plantilla
.docx ya generada como base y reemplazar variables directamente:

```text
FLUJO SIMPLIFICADO:
1. Usar la plantilla base .docx (Plantilla_Propuesta_Consultoria_Digital.docx)
2. Desempaquetar con unpack.py → editar XML → reempaquetar con pack.py
3. Buscar y reemplazar los marcadores [Texto entre corchetes] en el XML
4. Esto es más rápido, determinista y no consume tokens de API

MARCADORES EN LA PLANTILLA:
  [NOMBRE DE LA CONSULTORA]      → consultora.nombre
  [Nombre del Cliente]           → cliente.nombre
  [Nombre del Cliente / Inst.]   → cliente.nombre
  [Código de Propuesta]          → propuesta.codigo
  [DD/MM/AAAA]                   → propuesta.fecha
  [1.0]                          → propuesta.version
  [Empresarial / Educativo]      → cliente.sector
  [Descripción breve del alcance]→ proyecto.alcance
  [X semanas / meses]            → proyecto.duracion
  [Monto en EUR/USD]             → proyecto.inversion_total
  [Porcentaje / Plazo]           → proyecto.roi_proyectado
  ... etc. (todos los campos entre corchetes)

PARA SECCIONES DINÁMICAS (tablas con filas variables):
  → Generar solo esas secciones con el LLM
  → O manipular el XML directamente para insertar/eliminar <w:tr>
```

---

## 8. CONFIGURACIÓN RECOMENDADA DEL MODELO

```json
{
  "modelo_recomendado": "claude-sonnet-4-5-20250929",
  "modelo_premium": "claude-opus-4-6",
  "max_tokens": 16000,
  "temperature": 0.3,
  "notas": [
    "Sonnet es suficiente para generación de código docx-js (más rápido y económico)",
    "Opus para casos complejos con mucho contenido personalizado",
    "Temperature baja (0.2-0.4) para consistencia en formato",
    "Si el documento es muy largo, considerar generar secciones por separado"
  ]
}
```

---

## 9. CHECKLIST DE VALIDACIÓN POST-GENERACIÓN

```text
□ El archivo .docx se abre correctamente en Word / LibreOffice / Google Docs
□ La portada NO tiene cabecera ni pie de página
□ El índice muestra las 12 secciones (actualizar campo al abrir)
□ Todas las páginas (excepto portada) tienen cabecera y pie
□ Los números de página son correctos
□ Las tablas se renderizan con filas alternadas y bordes
□ No hay texto de placeholder que debería haberse reemplazado
□ Los colores son consistentes con la paleta definida
□ El texto está justificado con sangrado de primera línea
□ El bloque de firma aparece al final con los dos recuadros
□ El documento pasa validación: python validate.py archivo.docx
```
