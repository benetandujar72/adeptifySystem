<#
Bootstrap GCP project for Cloud Build and Cloud Run and Artifact Registry.
This script is safe to run multiple times.
#>

param(
  [Parameter(Mandatory=$true)]
  [string]$ProjectId,

  [string]$Region = "europe-west1",
  [string]$ArtifactRepo = "adeptify",
  [string]$CloudRunService = "adeptify-systems"
)

$ErrorActionPreference = 'Stop'

function Invoke-GCloud {
  param(
    [Parameter(Mandatory = $true)]
    [string[]]$Args
  )

  & gcloud @Args | Out-Null
  if ($LASTEXITCODE -ne 0) {
    throw "gcloud failed (exit $LASTEXITCODE): gcloud $($Args -join ' ')"
  }
}

function Invoke-GCloudCapture {
  param(
    [Parameter(Mandatory = $true)]
    [string[]]$Args
  )

  $output = & gcloud @Args 2>&1
  if ($LASTEXITCODE -ne 0) {
    $joined = ($output | Out-String).TrimEnd()
    throw "gcloud failed (exit $LASTEXITCODE): gcloud $($Args -join ' ')`n$joined"
  }
  return ($output | Out-String).TrimEnd()
}

function Test-GCloud {
  param(
    [Parameter(Mandatory = $true)]
    [string[]]$Args
  )

  & gcloud @Args | Out-Null
  return ($LASTEXITCODE -eq 0)
}

Write-Host "Project: $ProjectId"
Write-Host "Region: $Region"
Write-Host "Artifact Repo: $ArtifactRepo"
Write-Host "Cloud Run Service: $CloudRunService"

try {
  Invoke-GCloud -Args @('--version')
} catch {
  throw "gcloud not found. Install Google Cloud SDK and restart your terminal."
}

$auth = (Invoke-GCloudCapture -Args @('auth', 'list', '--format=value(account)'))
if (-not $auth) {
  Write-Host "No gcloud account is logged in. Running: gcloud auth login"
  Write-Host "(This will open a browser window.)"
  Invoke-GCloud -Args @('auth', 'login')
}

Invoke-GCloud -Args @('config', 'set', 'project', $ProjectId)

Write-Host "Enabling APIs (this may take a minute)..."
Invoke-GCloud -Args @('services','enable',
  'artifactregistry.googleapis.com',
  'run.googleapis.com',
  'cloudbuild.googleapis.com',
  'secretmanager.googleapis.com'
)

$projectNumber = (Invoke-GCloudCapture -Args @('projects', 'describe', $ProjectId, '--format=value(projectNumber)'))
if (-not $projectNumber) { throw "Could not determine projectNumber for $ProjectId" }

$cloudBuildSa = "$projectNumber@cloudbuild.gserviceaccount.com"
$cloudRunAgent = "service-$projectNumber@serverless-robot-prod.iam.gserviceaccount.com"

Write-Host "Project Number: $projectNumber"
Write-Host "Cloud Build SA: $cloudBuildSa"
Write-Host "Cloud Run Agent: $cloudRunAgent"

Write-Host "Creating Artifact Registry repo (if it does not exist)..."
if (-not (Test-GCloud -Args @('artifacts', 'repositories', 'describe', $ArtifactRepo, '--location', $Region))) {
  Invoke-GCloud -Args @('artifacts','repositories','create',$ArtifactRepo,'--repository-format','docker','--location',$Region,'--description',"Docker images for $CloudRunService")
}

$cloudRunSa = "$projectNumber-compute@developer.gserviceaccount.com"

Write-Host "Cloud Run SA (default compute): $cloudRunSa"

Write-Host "Granting IAM roles to Cloud Build service account..."
Invoke-GCloud -Args @('projects', 'add-iam-policy-binding', $ProjectId, '--member', "serviceAccount:$cloudBuildSa", '--role', 'roles/artifactregistry.writer')
Invoke-GCloud -Args @('projects', 'add-iam-policy-binding', $ProjectId, '--member', "serviceAccount:$cloudBuildSa", '--role', 'roles/run.admin')
Invoke-GCloud -Args @('projects', 'add-iam-policy-binding', $ProjectId, '--member', "serviceAccount:$cloudBuildSa", '--role', 'roles/iam.serviceAccountUser')
# Cloud Build needs to read secrets (availableSecrets in cloudbuild.yaml)
Invoke-GCloud -Args @('projects', 'add-iam-policy-binding', $ProjectId, '--member', "serviceAccount:$cloudBuildSa", '--role', 'roles/secretmanager.secretAccessor')
# Cloud Build needs to write DB backups to GCS
Invoke-GCloud -Args @('projects', 'add-iam-policy-binding', $ProjectId, '--member', "serviceAccount:$cloudBuildSa", '--role', 'roles/storage.objectCreator')

Write-Host "Granting Artifact Registry read access for Cloud Run service agent..."
Invoke-GCloud -Args @('projects', 'add-iam-policy-binding', $ProjectId, '--member', "serviceAccount:$cloudRunAgent", '--role', 'roles/artifactregistry.reader')

# Cloud Run needs to read secrets at runtime (--set-secrets in gcloud run deploy)
Write-Host "Granting Secret Manager read access for Cloud Run runtime SA..."
Invoke-GCloud -Args @('projects', 'add-iam-policy-binding', $ProjectId, '--member', "serviceAccount:$cloudRunSa", '--role', 'roles/secretmanager.secretAccessor')

Write-Host ""
Write-Host "=== Required Secret Manager secrets ==="
Write-Host "Make sure the following secrets exist (create once, then they persist):"
Write-Host "  SUPABASE_URL               — Supabase project URL"
Write-Host "  SUPABASE_ANON_KEY          — Supabase anon key"
Write-Host "  SB_PUBLISHABLE_KEY         — Supabase publishable key"
Write-Host "  SUPABASE_DB_URL            — Supabase Postgres connection string (sslmode=require)"
Write-Host "  SUPABASE_SERVICE_ROLE_KEY  — Supabase service role key (server-side admin client)"
Write-Host "  GEMINI_API_KEY             — Google Gemini API key"
Write-Host "  SMTP_PASS                  — SMTP password for outbound email"
Write-Host ""
Write-Host "To create a missing secret:"
Write-Host '  echo -n "SECRET_VALUE" | gcloud secrets create SECRET_NAME --data-file=- --replication-policy=automatic'
Write-Host '  # or to update an existing version:'
Write-Host '  echo -n "SECRET_VALUE" | gcloud secrets versions add SECRET_NAME --data-file=-'
Write-Host ""
Write-Host "Done. You can now run Cloud Build (or push to trigger it)."