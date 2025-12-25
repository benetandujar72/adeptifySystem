# Guía inicial de seguimiento (operación)

Esta guía sirve como checklist práctico para **monitorizar** el estado del servicio, **validar despliegues** y **diagnosticar incidencias** (p. ej. fallos con Gemini/Supabase) sin perder tiempo.

## 1) Objetivo y alcance

- Asegurar que la app funciona tras cada despliegue.
- Detectar rápidamente errores críticos (Gemini, Supabase, carga de UI).
- Tener un protocolo claro de actuación, comunicación y rollback.

## 2) URLs y recursos clave

- **Cloud Run (servicio principal):**
  - `https://adeptify-consultor-1061852826388.europe-west1.run.app`
- **Repositorio / CI:** Cloud Build con `cloudbuild.yaml`.
- **Secretos (Secret Manager):**
  - `GEMINI_API_KEY`
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
  - `SB_PUBLISHABLE_KEY`

## 3) Checklist post-despliegue (5–10 min)

### A. Validación funcional (navegador)

1. Abrir la URL del servicio en incógnito.
2. Verificar que la pantalla principal carga sin “pantalla en blanco”.
3. Hacer un flujo mínimo:
   - Iniciar una consulta.
   - Enviar 1–2 respuestas.
   - Generar propuesta/informe.
4. Confirmar en consola del navegador:
   - No hay errores repetidos.
   - No hay 400/401 a Gemini.

### B. Validación técnica rápida (bundle/config)

- Confirmar que el JS principal **no contiene placeholders** tipo `$GEMINI_API_KEY`.
- Confirmar que el bundle contiene el prefijo `AIza` (solo check booleano; no copiar el secreto).

Ejemplo (PowerShell, boolean-only):

```powershell
$base='https://adeptify-consultor-1061852826388.europe-west1.run.app'
$html=(Invoke-WebRequest -UseBasicParsing "$base/").Content
if($html -match '(?<path>/assets/index-[^\"]+\.js)'){ $assetPath=$Matches.path } else { throw 'asset not found' }
$js=(Invoke-WebRequest -UseBasicParsing "$base$assetPath").Content
"HasAIza=$($js.Contains('AIza'))"
"HasDollarGemini=$($js.Contains('$GEMINI_API_KEY'))"
```

Interpretación:
- `HasAIza=True` y `HasDollarGemini=False` es lo esperado.

## 4) Indicadores de “incidencia crítica”

Escalar/actuar de inmediato si ocurre cualquiera:

- Pantalla en blanco o UI bloqueada en carga.
- Errores repetidos de red:
  - `API_KEY_INVALID`, `401`, `403`, `400` persistente contra Gemini.
- Caída total del servicio (Cloud Run 5xx sostenidos).
- Errores de autenticación o fallos de carga de datos en Supabase que impidan el flujo.

## 5) Diagnóstico rápido por síntomas

### A) Gemini devuelve `API_KEY_INVALID`

Causas típicas:
- El build se ha hecho sin expandir secretos (placeholders en el bundle).
- El secreto no corresponde al proyecto/permiso actual.

Acciones:
1. Revisar el bundle (sección 3B).
2. Verificar que Cloud Build expande secretos en `cloudbuild.yaml` (paso de `docker build` ejecutado en shell).
3. Verificar que el secreto en Secret Manager es el correcto y está en el proyecto activo.

### B) Supabase “cloud no disponible” / fallback local

Causas típicas:
- Variables `SUPABASE_URL` / `SUPABASE_ANON_KEY` ausentes o inválidas.
- Reglas RLS / permisos que bloquean.
- Caídas puntuales.

Acciones:
1. Confirmar que las envs están en el bundle (o al menos no están como placeholders).
2. Revisar consola del navegador (errores de `supabase-js`).
3. Revisar logs del servicio (si hay endpoints) o comportamiento en UI.

### C) UI en blanco sin errores obvios

Acciones:
1. Abrir consola y pestaña Network.
2. Verificar que `index.html` devuelve 200 y que el JS principal carga 200.
3. Probar refresco duro (Ctrl+F5) / incógnito.

## 6) Logs y monitorización (Cloud Run / Cloud Build)

### A) Cloud Run logs (filtro recomendado)

En Cloud Logging, filtra por:
- Resource: **Cloud Run Revision**
- Service: `adeptify-consultor`

Busca:
- `severity>=ERROR`
- Mensajes repetidos en bucle
- 5xx / timeouts

### B) Cloud Build

Revisa el build más reciente:
- Paso 0 (creación de `.env.production`): debe mostrar claves con `=***`.
- Paso de `docker build`: debe llegar a `npm run build` sin placeholders.

## 7) Protocolo de actuación en incidentes

1. **Confirmar impacto** (quién, qué flujo, desde cuándo).
2. **Reproducir** (en incógnito + 1 flujo mínimo).
3. **Clasificar**:
   - P0: app no usable / Gemini bloquea el core.
   - P1: degradación (fallback Supabase, funciones secundarias).
4. **Mitigar**:
   - Rollback a la revisión previa estable (Cloud Run).
   - Re-desplegar con secretos/args corregidos.
5. **Verificar** con checklist post-despliegue.
6. **Postmortem ligero** (10 min): causa, fix, prevención.

## 8) Checklist de prevención (antes de merge/deploy)

- `npm run build` local sin errores.
- No se imprime nunca el secreto en logs.
- `cloudbuild.yaml`:
  - Los secretos se consumen vía `secretEnv`.
  - El paso `docker build` se ejecuta con shell (para expandir variables).
- Confirmar que el servicio apunta a la imagen del build correcto.

## 9) Plantilla breve de reporte de incidente

- **Título:** (ej. “Gemini API_KEY_INVALID en producción”)
- **Impacto:** (usuarios afectados, flujo bloqueado)
- **Inicio:** (hora aproximada)
- **Síntomas:** (errores consola, capturas, endpoints)
- **Causa raíz:**
- **Mitigación aplicada:** (rollback/redeploy)
- **Acción preventiva:** (cambio en CI, alertas, tests)

