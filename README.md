<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1YfXdRqaoIcF3QDGL4UD6GVRlyUAnPtMv

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Create a `.env.local` with these variables:
   - `VITE_GEMINI_API_KEY`
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_SB_PUBLISHABLE_KEY` (optional)
3. Run the app:
   `npm run dev`

## Docker / Cloud Run

- The container serves a runtime config file at `/env.js`.
- At container start, [docker-entrypoint.sh](docker-entrypoint.sh) generates `/usr/share/nginx/html/env.js` from environment variables (prefers `GEMINI_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SB_PUBLISHABLE_KEY`).
- Build-time injection via Dockerfile `ARG`/`ENV` is intentionally not used (avoids Docker DX warnings).

## Operación / seguimiento

- Guía inicial de seguimiento: [GUIA_SEGUIMIENTO.md](GUIA_SEGUIMIENTO.md)
