#!/bin/bash
# ═══════════════════════════════════════════════════════════
# SCRIPT DE DESPLEGAMENT - Campanya Consultoria Digital
# ═══════════════════════════════════════════════════════════
# Ús: ./deploy.sh [setup|start|stop|restart|logs|status|backup|ssl]
# ═══════════════════════════════════════════════════════════

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DOCKER_DIR="${PROJECT_DIR}/docker"
DOMAIN="impulsa.edutac.es"

log() { echo -e "${GREEN}[$(date +'%H:%M:%S')]${NC} $1"; }
warn() { echo -e "${YELLOW}[AVÍS]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# ── SETUP INICIAL ──
setup() {
    log "Configurant entorn de producció..."

    # Verificar Docker
    command -v docker >/dev/null 2>&1 || error "Docker no instal·lat"
    command -v docker-compose >/dev/null 2>&1 || error "Docker Compose no instal·lat"

    # Crear .env si no existeix
    if [ ! -f "${DOCKER_DIR}/.env" ]; then
        cp "${DOCKER_DIR}/.env.example" "${DOCKER_DIR}/.env"
        warn "Fitxer .env creat. EDITA'L amb les teves claus reals:"
        warn "  ${DOCKER_DIR}/.env"
        warn ""
        warn "Claus necessàries:"
        warn "  - SENDGRID_API_KEY (https://sendgrid.com)"
        warn "  - ANTHROPIC_API_KEY (https://console.anthropic.com)"
        warn "  - GEMINI_API_KEY (https://aistudio.google.com/apikey)"
        warn "  - DB_PASSWORD / REDIS_PASSWORD (genera'ls segurs)"
        warn "  - SECRET_KEY / JWT_SECRET_KEY (genera'ls segurs)"
        echo ""
        log "Generant claus segures..."
        echo ""
        echo "SECRET_KEY suggerit: $(openssl rand -hex 32)"
        echo "JWT_SECRET_KEY suggerit: $(openssl rand -hex 32)"
        echo "DB_PASSWORD suggerit: $(openssl rand -base64 24)"
        echo "REDIS_PASSWORD suggerit: $(openssl rand -base64 24)"
        return
    fi

    log "Fitxer .env ja existeix"

    # Build
    log "Construint imatges Docker..."
    cd "${DOCKER_DIR}"
    docker-compose build

    log "Setup completat. Executa: ./deploy.sh start"
}

# ── START ──
start() {
    log "Iniciant serveis..."
    cd "${DOCKER_DIR}"
    docker-compose up -d

    log "Esperant que la BD estigui llesta..."
    sleep 5

    log "Serveis iniciats:"
    docker-compose ps

    echo ""
    log "URLs:"
    echo "  API:       http://localhost:8000"
    echo "  API Docs:  http://localhost:8000/docs"
    echo "  Health:    http://localhost:8000/health"
    echo "  Dashboard: https://${DOMAIN} (requereix DNS + SSL)"
}

# ── STOP ──
stop() {
    log "Aturant serveis..."
    cd "${DOCKER_DIR}"
    docker-compose down
    log "Tots els serveis aturats"
}

# ── RESTART ──
restart() {
    stop
    sleep 2
    start
}

# ── LOGS ──
logs() {
    local service="${2:-}"
    cd "${DOCKER_DIR}"
    if [ -n "$service" ]; then
        docker-compose logs -f "$service"
    else
        docker-compose logs -f
    fi
}

# ── STATUS ──
status() {
    cd "${DOCKER_DIR}"
    echo ""
    log "Estat dels serveis:"
    docker-compose ps
    echo ""
    log "Ús de recursos:"
    docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}" \
        $(docker-compose ps -q 2>/dev/null) 2>/dev/null || true
}

# ── BACKUP ──
backup() {
    local backup_dir="${PROJECT_DIR}/backups"
    local timestamp=$(date +'%Y%m%d_%H%M%S')
    mkdir -p "$backup_dir"

    log "Fent backup de la base de dades..."
    cd "${DOCKER_DIR}"
    docker-compose exec -T db pg_dump -U campanya campanya_crm \
        > "${backup_dir}/db_backup_${timestamp}.sql"

    log "Backup desat a: ${backup_dir}/db_backup_${timestamp}.sql"

    # Netejar backups antics (>30 dies)
    find "$backup_dir" -name "db_backup_*.sql" -mtime +30 -delete
    log "Backups antics netejats"
}

# ── SSL (Let's Encrypt) ──
ssl() {
    log "Configurant certificat SSL per ${DOMAIN}..."

    cd "${DOCKER_DIR}"

    # Primer deploy sense SSL per verificació
    docker-compose run --rm certbot certonly \
        --webroot \
        --webroot-path=/var/www/certbot \
        --email bandujar@edutac.es \
        --agree-tos \
        --no-eff-email \
        -d "${DOMAIN}"

    # Reiniciar nginx amb SSL
    docker-compose restart nginx
    log "SSL configurat per ${DOMAIN}"
}

# ── GENERAR IMATGES ──
images() {
    log "Generant imatges de campanya amb Nano Banana API..."
    cd "${PROJECT_DIR}"

    source "${DOCKER_DIR}/.env" 2>/dev/null || true

    if [ -z "${GEMINI_API_KEY:-}" ]; then
        error "GEMINI_API_KEY no definida. Configura .env primer"
    fi

    python3 scripts/generate_campaign_images.py \
        --model flash \
        --lang all \
        --output images/generated

    log "Imatges generades a: images/generated/"
}

# ── MAIN ──
case "${1:-help}" in
    setup)   setup ;;
    start)   start ;;
    stop)    stop ;;
    restart) restart ;;
    logs)    logs "$@" ;;
    status)  status ;;
    backup)  backup ;;
    ssl)     ssl ;;
    images)  images ;;
    *)
        echo ""
        echo -e "${BLUE}═══ Campanya Consultoria Digital - Deploy Script ═══${NC}"
        echo ""
        echo "Ús: $0 <comanda>"
        echo ""
        echo "Comandes:"
        echo "  setup    - Configurar entorn (primera vegada)"
        echo "  start    - Iniciar tots els serveis"
        echo "  stop     - Aturar tots els serveis"
        echo "  restart  - Reiniciar serveis"
        echo "  logs     - Veure logs (opcional: logs <servei>)"
        echo "  status   - Estat dels serveis"
        echo "  backup   - Fer backup de la BD"
        echo "  ssl      - Configurar SSL Let's Encrypt"
        echo "  images   - Generar imatges amb Nano Banana API"
        echo ""
        ;;
esac
