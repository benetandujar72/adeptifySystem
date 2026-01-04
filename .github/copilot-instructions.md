# Copilot instructions (Adeptify Systems)

## Big picture
- This is a Vite + React + TypeScript SPA (no React Router). Navigation is a **state machine** in `App.tsx` using `Phase` from `types.ts` (e.g. `LANDING → REGISTER → DYNAMIC_DIAGNOSIS → PROPOSAL`).
- Multi-tenant routing is URL-based: `/t/{tenantSlug}/...` parsed by `services/tenant.ts` and persisted per-session in `sessionStorage` (see constants in `App.tsx`).
- There is a marketing route `/consultor` rendered by `components/ConsultorLanding.tsx` (includes a contact form hitting `POST /api/contact`).

## Run / build
- Install: `npm install`
- Dev server: `npm run dev` (Vite, default port `3000`, see `vite.config.ts`)
- Production build: `npm run build`
- Production-like run (serves `dist/` + API endpoints): `node server.mjs` (uses `PORT` default `8080`, see `server.mjs`)

## Runtime config & secrets (important)
- The browser reads non-secret config from `window.__ADEPTIFY_ENV__` via `services/runtimeEnv.ts`. This is provided by `/env.js`, which is included in `index.html`.
- `/env.js` must contain **NO secrets**. It is generated at request time in `server.mjs` and in dev by Vite middleware in `vite.config.ts`.
- Gemini API calls must go through same-origin `/api-proxy/...` (never call Google endpoints directly from the browser). Client wrapper is `services/geminiService.ts`. The API key is injected server-side:
  - Dev: Vite `server.proxy['/api-proxy']` adds `GEMINI_API_KEY` (see `vite.config.ts`).
  - Prod: Express route `app.all('/api-proxy/*')` adds `GEMINI_API_KEY` (see `server.mjs`).

## Data / persistence patterns
- Supabase is the primary storage; client is created in `services/supabaseClient.ts` using runtime env first, then `import.meta.env`.
- Several services implement a **cloud-first, LocalStorage fallback** when Supabase is missing/unavailable (e.g. `services/consultationService.ts`). Preserve this behavior when extending persistence.
- Backward-compat exists for the optional `tenant_slug` column: insert/query retries without `tenant_slug` if the schema hasn’t been migrated yet (see `services/consultationService.ts`).

## Project-specific conventions
- UI copy is generally sourced from `useLanguage()` + translations (see `LanguageContext.tsx`, `translations.ts`, and usage in `components/InstitutionGate.tsx`). When adding new user-facing text, add translation keys instead of hardcoding.
- Education center search uses PostgREST `.or()` with `*` wildcards and explicit sanitization to avoid breaking the filter grammar; keep queries free of `%`, commas, and parentheses (see `services/educationCentersService.ts`).
- PDF generation is handled client-side with `jspdf` in `services/pdfExport.ts` (optional logo via `VITE_PDF_LOGO_DATA_URI` / `VITE_PDF_LOGO_URL`).

## Deployment references
- Cloud Run build/deploy pipeline is in `cloudbuild.yaml`. It writes `.env.production` for Vite (Supabase keys) and binds secrets at runtime (Gemini + SMTP).
- Production server endpoints:
  - `/env.js` (runtime config)
  - `/api-proxy/*` (Gemini proxy)
  - `/api/contact` (SMTP email)
  - `/healthz`, `/readyz` (health)
