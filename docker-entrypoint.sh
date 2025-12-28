#!/bin/sh
set -eu

HTML_DIR="/usr/share/nginx/html"
ENV_JS="$HTML_DIR/env.js"

js_escape() {
  # Minimal JS string escape (handles backslash, quotes, newlines, CR)
  # shellcheck disable=SC2001
  printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' -e 's/\r/\\r/g' -e 's/\n/\\n/g'
}

GEMINI_API_KEY_VALUE="${GEMINI_API_KEY:-${VITE_GEMINI_API_KEY:-}}"
SUPABASE_URL_VALUE="${SUPABASE_URL:-${VITE_SUPABASE_URL:-}}"
SUPABASE_ANON_KEY_VALUE="${SUPABASE_ANON_KEY:-${VITE_SUPABASE_ANON_KEY:-}}"
SB_PUBLISHABLE_KEY_VALUE="${SB_PUBLISHABLE_KEY:-${VITE_SB_PUBLISHABLE_KEY:-}}"

{
  printf '%s\n' "// Generated at container start; do not commit.";
  printf '%s\n' "window.__ADEPTIFY_ENV__ = {";
  printf '%s\n' "  GEMINI_API_KEY: \"$(js_escape "$GEMINI_API_KEY_VALUE")\",";
  printf '%s\n' "  SUPABASE_URL: \"$(js_escape "$SUPABASE_URL_VALUE")\",";
  printf '%s\n' "  SUPABASE_ANON_KEY: \"$(js_escape "$SUPABASE_ANON_KEY_VALUE")\",";
  printf '%s\n' "  SB_PUBLISHABLE_KEY: \"$(js_escape "$SB_PUBLISHABLE_KEY_VALUE")\"";
  printf '%s\n' "};";
} > "$ENV_JS"

exec "$@"
