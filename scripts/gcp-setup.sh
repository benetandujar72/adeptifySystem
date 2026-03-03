#!/usr/bin/env bash
# =============================================================================
# Adeptify — GCP Production Setup (one-shot)
# Run from Cloud Shell inside the repo root:
#   bash scripts/gcp-setup.sh
#
# What this does (idempotent — safe to run multiple times):
#   1. Enables required GCP APIs
#   2. Creates Artifact Registry Docker repo
#   3. Creates GCS backup bucket with 30-day lifecycle
#   4. Grants all IAM roles needed by Cloud Build and Cloud Run
#   5. Creates any missing Secret Manager secrets (skips existing ones)
#   6. Prompts for SUPABASE_SERVICE_ROLE_KEY if not set
#   7. Creates the Cloud Build push trigger (auto-deploy on push to main)
#   8. Submits the first build manually
# =============================================================================
set -euo pipefail

# ── Config ───────────────────────────────────────────────────────────────────
PROJECT_ID="gen-lang-client-0757991117"
REGION="europe-west1"
AR_REPO="adeptify"
SERVICE="adeptify-consultor"
BACKUP_BUCKET="adeptify-supabase-backups"
GITHUB_OWNER="benetandujar72"
GITHUB_REPO="adeptifySystem"
TRIGGER_NAME="deploy-on-push-main"

# ── Helpers ───────────────────────────────────────────────────────────────────
info()    { echo -e "\n\033[1;34m[INFO]\033[0m $*"; }
success() { echo -e "\033[1;32m[OK]\033[0m $*"; }
warn()    { echo -e "\033[1;33m[WARN]\033[0m $*"; }
die()     { echo -e "\033[1;31m[ERROR]\033[0m $*" >&2; exit 1; }

secret_exists() { gcloud secrets describe "$1" --project="$PROJECT_ID" &>/dev/null; }
secret_has_real_value() {
  local val
  val=$(gcloud secrets versions access latest --secret="$1" --project="$PROJECT_ID" 2>/dev/null || echo "")
  [[ -n "$val" && "$val" != "PLACEHOLDER_SET_ME" ]]
}

# ── 0. Set project ─────────────────────────────────────────────────────────
info "Setting active project to $PROJECT_ID..."
gcloud config set project "$PROJECT_ID"
success "Project set."

# ── 1. Enable APIs ───────────────────────────────────────────────────────────
info "Enabling GCP APIs (this may take ~60 s the first time)..."
gcloud services enable \
  artifactregistry.googleapis.com \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  secretmanager.googleapis.com \
  storage.googleapis.com \
  --project="$PROJECT_ID"
success "APIs enabled."

# ── 2. Resolve service accounts ──────────────────────────────────────────────
info "Resolving service accounts..."
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')
CB_SA="${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com"
CR_AGENT="service-${PROJECT_NUMBER}@serverless-robot-prod.iam.gserviceaccount.com"
CR_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
echo "  Cloud Build SA : $CB_SA"
echo "  Cloud Run Agent: $CR_AGENT"
echo "  Cloud Run SA   : $CR_SA"

# ── 3. Artifact Registry repo ────────────────────────────────────────────────
info "Creating Artifact Registry repo '$AR_REPO' in $REGION..."
if ! gcloud artifacts repositories describe "$AR_REPO" \
     --location="$REGION" --project="$PROJECT_ID" &>/dev/null; then
  gcloud artifacts repositories create "$AR_REPO" \
    --repository-format=docker \
    --location="$REGION" \
    --description="Docker images for $SERVICE" \
    --project="$PROJECT_ID"
  success "Repo created."
else
  success "Repo '$AR_REPO' already exists — skipped."
fi

# ── 4. GCS backup bucket ─────────────────────────────────────────────────────
info "Creating GCS backup bucket gs://$BACKUP_BUCKET..."
if ! gsutil ls "gs://$BACKUP_BUCKET" &>/dev/null; then
  gsutil mb -p "$PROJECT_ID" -l "$REGION" "gs://$BACKUP_BUCKET"

  # 30-day auto-delete lifecycle
  cat > /tmp/lifecycle.json <<'LIFECYCLE'
{
  "rule": [{
    "action": { "type": "Delete" },
    "condition": { "age": 30 }
  }]
}
LIFECYCLE
  gsutil lifecycle set /tmp/lifecycle.json "gs://$BACKUP_BUCKET"
  rm /tmp/lifecycle.json
  success "Bucket created with 30-day lifecycle."
else
  success "Bucket 'gs://$BACKUP_BUCKET' already exists — skipped."
fi

# ── 5. IAM roles ─────────────────────────────────────────────────────────────
info "Granting IAM roles..."

grant() {
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:$1" --role="$2" --quiet 2>/dev/null && \
  echo "  ✓ $1 → $2" || echo "  (already bound or error) $1 → $2"
}

# Cloud Build needs: push images, deploy to Cloud Run, read secrets, write backups
grant "$CB_SA" roles/artifactregistry.writer
grant "$CB_SA" roles/run.admin
grant "$CB_SA" roles/iam.serviceAccountUser
grant "$CB_SA" roles/secretmanager.secretAccessor
grant "$CB_SA" roles/storage.objectCreator

# Cloud Run agent needs to pull images
grant "$CR_AGENT" roles/artifactregistry.reader

# Cloud Run runtime SA needs to read secrets injected by --set-secrets
grant "$CR_SA" roles/secretmanager.secretAccessor

success "IAM roles granted."

# ── 6. Secret Manager secrets ────────────────────────────────────────────────
info "Checking Secret Manager secrets..."

# Secrets that already exist in the console (from screenshot) — just verify
EXISTING_SECRETS=(
  GEMINI_API_KEY
  SB_PUBLISHABLE_KEY
  SMTP_PASS
  SUPABASE_ANON_KEY
  SUPABASE_DB_URL
  SUPABASE_URL
)

for s in "${EXISTING_SECRETS[@]}"; do
  if secret_exists "$s"; then
    success "Secret $s exists."
  else
    warn "Secret $s is MISSING — creating placeholder (you must update the value)."
    echo -n "PLACEHOLDER_SET_ME" | gcloud secrets create "$s" \
      --data-file=- --replication-policy=automatic --project="$PROJECT_ID"
  fi
done

# SUPABASE_SERVICE_ROLE_KEY — the only one that needs to be created
info "Checking SUPABASE_SERVICE_ROLE_KEY..."
if secret_exists "SUPABASE_SERVICE_ROLE_KEY"; then
  if secret_has_real_value "SUPABASE_SERVICE_ROLE_KEY"; then
    success "SUPABASE_SERVICE_ROLE_KEY already set."
  else
    warn "SUPABASE_SERVICE_ROLE_KEY exists but has placeholder value."
    echo ""
    echo "  Get the value from: Supabase Dashboard → Settings → API → service_role (secret key)"
    read -rp "  Paste your Supabase service_role key: " SRK
    if [[ -n "$SRK" ]]; then
      echo -n "$SRK" | gcloud secrets versions add "SUPABASE_SERVICE_ROLE_KEY" \
        --data-file=- --project="$PROJECT_ID"
      success "SUPABASE_SERVICE_ROLE_KEY updated."
    else
      warn "Skipped. You must set it before the build will succeed."
    fi
  fi
else
  echo ""
  echo "  SUPABASE_SERVICE_ROLE_KEY does not exist."
  echo "  Get the value from: Supabase Dashboard → Settings → API → service_role (secret key)"
  read -rp "  Paste your Supabase service_role key (or press Enter to skip): " SRK
  if [[ -n "$SRK" ]]; then
    echo -n "$SRK" | gcloud secrets create "SUPABASE_SERVICE_ROLE_KEY" \
      --data-file=- --replication-policy=automatic --project="$PROJECT_ID"
    success "SUPABASE_SERVICE_ROLE_KEY created."
  else
    echo -n "PLACEHOLDER_SET_ME" | gcloud secrets create "SUPABASE_SERVICE_ROLE_KEY" \
      --data-file=- --replication-policy=automatic --project="$PROJECT_ID"
    warn "Created placeholder. Update it before deploying:"
    warn "  echo -n 'REAL_KEY' | gcloud secrets versions add SUPABASE_SERVICE_ROLE_KEY --data-file=-"
  fi
fi

# ── 7. Cloud Build trigger (auto-deploy on push to main) ─────────────────────
info "Setting up Cloud Build trigger..."

if gcloud builds triggers describe "$TRIGGER_NAME" --project="$PROJECT_ID" &>/dev/null; then
  success "Trigger '$TRIGGER_NAME' already exists — skipped."
else
  # Try 1st-gen GitHub trigger (requires Cloud Build GitHub App to be connected)
  if gcloud builds triggers create github \
       --name="$TRIGGER_NAME" \
       --description="Auto-deploy adeptify-consultor on push to main" \
       --repo-name="$GITHUB_REPO" \
       --repo-owner="$GITHUB_OWNER" \
       --branch-pattern='^main$' \
       --build-config=cloudbuild.yaml \
       --project="$PROJECT_ID" 2>/tmp/trigger_err; then
    success "Trigger '$TRIGGER_NAME' created. Every push to main will deploy automatically."
  else
    warn "Could not create trigger automatically. GitHub App not connected yet."
    echo ""
    echo "  ┌─────────────────────────────────────────────────────────────────┐"
    echo "  │  MANUAL STEP (one-time, ~2 minutes):                           │"
    echo "  │  1. Open this URL in your browser:                             │"
    echo "  │     https://console.cloud.google.com/cloud-build/triggers/connect?project=$PROJECT_ID"
    echo "  │  2. Connect 'GitHub (Cloud Build GitHub App)'                  │"
    echo "  │  3. Authorize and select repo: $GITHUB_OWNER/$GITHUB_REPO     │"
    echo "  │  4. Then run this command to create the trigger:               │"
    echo "  │     gcloud builds triggers create github \\                     │"
    echo "  │       --name=$TRIGGER_NAME \\                                   │"
    echo "  │       --repo-name=$GITHUB_REPO \\                               │"
    echo "  │       --repo-owner=$GITHUB_OWNER \\                             │"
    echo "  │       --branch-pattern='^main\$' \\                             │"
    echo "  │       --build-config=cloudbuild.yaml \\                         │"
    echo "  │       --project=$PROJECT_ID                                     │"
    echo "  └─────────────────────────────────────────────────────────────────┘"
    cat /tmp/trigger_err || true
  fi
fi

# ── 8. First build ────────────────────────────────────────────────────────────
echo ""
echo "════════════════════════════════════════════════════════════"
echo "  Setup complete!"
echo ""
echo "  To launch the FIRST deploy now:"
echo "    gcloud builds submit --config cloudbuild.yaml --project=$PROJECT_ID"
echo ""
read -rp "  Launch the first build now? [y/N] " LAUNCH
if [[ "${LAUNCH,,}" == "y" ]]; then
  info "Submitting build (this will take ~5–10 minutes)..."
  gcloud builds submit --config cloudbuild.yaml --project="$PROJECT_ID"
  success "Build submitted. Check progress at:"
  echo "  https://console.cloud.google.com/cloud-build/builds?project=$PROJECT_ID"
else
  echo "  Run manually when ready:"
  echo "    gcloud builds submit --config cloudbuild.yaml --project=$PROJECT_ID"
fi

echo "════════════════════════════════════════════════════════════"
