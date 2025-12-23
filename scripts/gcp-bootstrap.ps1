param(
  [Parameter(Mandatory=$true)]
  [string]$ProjectId,

  [string]$Region = "europe-west1",
  [string]$ArtifactRepo = "adeptify",
  [string]$CloudRunService = "adeptify-systems"
)

$ErrorActionPreference = 'Stop'

Write-Host "Project: $ProjectId"
Write-Host "Region: $Region"
Write-Host "Artifact Repo: $ArtifactRepo"
Write-Host "Cloud Run Service: $CloudRunService"

# Ensure gcloud exists
try {
  gcloud --version | Out-Null
} catch {
  throw "gcloud not found. Install Google Cloud SDK and restart your terminal."
}

# Ensure you are logged in (interactive)
$auth = (gcloud auth list --format="value(account)")
if (-not $auth) {
  Write-Host "No gcloud account is logged in. Running: gcloud auth login"
  Write-Host "(This will open a browser window.)"
  gcloud auth login
}

# Select project
gcloud config set project $ProjectId | Out-Null

# Enable required APIs
Write-Host "Enabling APIs (this may take a minute)..."
gcloud services enable artifactregistry.googleapis.com run.googleapis.com cloudbuild.googleapis.com | Out-Null

# Project number
$projectNumber = (gcloud projects describe $ProjectId --format="value(projectNumber)")
if (-not $projectNumber) { throw "Could not determine projectNumber for $ProjectId" }

$cloudBuildSa = "$projectNumber@cloudbuild.gserviceaccount.com"
$cloudRunAgent = "service-$projectNumber@serverless-robot-prod.iam.gserviceaccount.com"

Write-Host "Project Number: $projectNumber"
Write-Host "Cloud Build SA: $cloudBuildSa"
Write-Host "Cloud Run Agent: $cloudRunAgent"

# Create Artifact Registry repo if missing
Write-Host "Creating Artifact Registry repo (if it does not exist)..."
try {
  gcloud artifacts repositories describe $ArtifactRepo --location $Region | Out-Null
} catch {
  gcloud artifacts repositories create $ArtifactRepo --repository-format=docker --location=$Region --description="Docker images for $CloudRunService" | Out-Null
}

# IAM bindings
Write-Host "Granting IAM roles to Cloud Build service account..."

gcloud projects add-iam-policy-binding $ProjectId --member="serviceAccount:$cloudBuildSa" --role="roles/artifactregistry.writer" | Out-Null
gcloud projects add-iam-policy-binding $ProjectId --member="serviceAccount:$cloudBuildSa" --role="roles/run.admin" | Out-Null
gcloud projects add-iam-policy-binding $ProjectId --member="serviceAccount:$cloudBuildSa" --role="roles/iam.serviceAccountUser" | Out-Null

Write-Host "Granting Artifact Registry read access for Cloud Run service agent..."

gcloud projects add-iam-policy-binding $ProjectId --member="serviceAccount:$cloudRunAgent" --role="roles/artifactregistry.reader" | Out-Null

Write-Host "Done. You can now run Cloud Build (or push to trigger it)."