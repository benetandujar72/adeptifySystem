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
   - `GEMINI_API_KEY` (server-side only; required for AI features when running the runtime server)
   - `VITE_SUPABASE_URL` (or `SUPABASE_URL`)
   - `VITE_SUPABASE_ANON_KEY` (or `SUPABASE_ANON_KEY`)
   - `VITE_SB_PUBLISHABLE_KEY` (or `SB_PUBLISHABLE_KEY`, optional)
3. Run the app:
   `npm run dev`

## Docker / Cloud Run

- The container serves a runtime config file at `/env.js` (no secrets).
- AI requests go through a same-origin server proxy at `/api-proxy/...` which injects `GEMINI_API_KEY` server-side.
- Build-time injection via Dockerfile `ARG`/`ENV` is intentionally not used.

## Operación / seguimiento

- Guía inicial de seguimiento: [GUIA_SEGUIMIENTO.md](GUIA_SEGUIMIENTO.md)
