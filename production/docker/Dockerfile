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
COPY backend/app ./app

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

# Permisos
RUN chown -R campanya:campanya /app
USER campanya

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
