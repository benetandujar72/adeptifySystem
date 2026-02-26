# ═══════════════════════════════════════════════════════════
# Dockerfile - Backend API Campanya Consultoria Digital
# Multi-stage build per producció
# ═══════════════════════════════════════════════════════════

# ── Stage 1: Build ──
FROM python:3.12-slim AS builder

WORKDIR /build
COPY backend/requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# ── Stage 2: Production ──
FROM python:3.12-slim AS production

# Seguretat: no root
RUN groupadd -r campanya && useradd -r -g campanya campanya

WORKDIR /app

# Copiar dependències
COPY --from=builder /install /usr/local

# Copiar codi
COPY agents ./agents
COPY backend/app ./app
COPY campaign_crm.db ./campaign_crm.db

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD python -c "import urllib.request; import os; port = os.environ.get('PORT', '8080'); urllib.request.urlopen(f'http://localhost:{port}/health')" || exit 1

# Permisos
RUN chown -R campanya:campanya /app
USER campanya

EXPOSE 8080

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080} --workers 2"]
