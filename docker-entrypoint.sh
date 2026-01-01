#!/bin/sh
set -eu

HTML_DIR="/usr/share/nginx/html"
ENV_JS="$HTML_DIR/env.js"
INDEX_HTML="$HTML_DIR/index.html"

js_escape() {
  # Minimal JS string escape (handles backslash, quotes, newlines, CR)
  # shellcheck disable=SC2001
  printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' -e 's/\r/\\r/g' -e 's/\n/\\n/g'
}

GEMINI_API_KEY_VALUE="${GEMINI_API_KEY:-${VITE_GEMINI_API_KEY:-}}"
SUPABASE_URL_VALUE="${SUPABASE_URL:-${VITE_SUPABASE_URL:-}}"
SUPABASE_ANON_KEY_VALUE="${SUPABASE_ANON_KEY:-${VITE_SUPABASE_ANON_KEY:-}}"
SB_PUBLISHABLE_KEY_VALUE="${SB_PUBLISHABLE_KEY:-${VITE_SB_PUBLISHABLE_KEY:-}}"

# Used to bust browser/service-worker caches for env.js across deployments.
STARTUP_TS="$(date +%s)"

{
  printf '%s\n' "// Generated at container start; do not commit.";
  printf '%s\n' "window.__ADEPTIFY_ENV__ = {";
  printf '%s\n' "  GEMINI_API_KEY: \"$(js_escape "$GEMINI_API_KEY_VALUE")\",";
  printf '%s\n' "  SUPABASE_URL: \"$(js_escape "$SUPABASE_URL_VALUE")\",";
  printf '%s\n' "  SUPABASE_ANON_KEY: \"$(js_escape "$SUPABASE_ANON_KEY_VALUE")\",";
  printf '%s\n' "  SB_PUBLISHABLE_KEY: \"$(js_escape "$SB_PUBLISHABLE_KEY_VALUE")\"";
  printf '%s\n' "};";
} > "$ENV_JS"

# Force index.html to reference a fresh env.js URL on each container start.
# This mitigates stale SW caches that might keep serving an older /env.js.
if [ -f "$INDEX_HTML" ]; then
  # Replace any existing /env.js or /env.js?... reference.
  sed -i -E "s#src=\"/env\\.js[^\"]*\"#src=\"/env.js?v=${STARTUP_TS}\"#g" "$INDEX_HTML" || true
fi

exec "$@"
