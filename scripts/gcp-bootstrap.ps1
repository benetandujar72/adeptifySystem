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

Write-Host "Project: $ProjectId"
Write-Host "Region: $Region"
Write-Host "Artifact Repo: $ArtifactRepo"
Write-Host "Cloud Run Service: $CloudRunService"

try {
  gcloud --version | Out-Null
} catch {
  throw "gcloud not found. Install Google Cloud SDK and restart your terminal."
}

$auth = (gcloud auth list --format="value(account)")
if (-not $auth) {
  Write-Host "No gcloud account is logged in. Running: gcloud auth login"
  Write-Host "(This will open a browser window.)"
  Invoke-GCloud -Args @('auth', 'login')
}

Invoke-GCloud -Args @('config', 'set', 'project', $ProjectId)

Write-Host "Enabling APIs (this may take a minute)..."
Invoke-GCloud -Args @('services','enable','artifactregistry.googleapis.com','run.googleapis.com','cloudbuild.googleapis.com')

$projectNumber = (gcloud projects describe $ProjectId --format="value(projectNumber)")
if (-not $projectNumber) { throw "Could not determine projectNumber for $ProjectId" }

$cloudBuildSa = "$projectNumber@cloudbuild.gserviceaccount.com"
$cloudRunAgent = "service-$projectNumber@serverless-robot-prod.iam.gserviceaccount.com"

Write-Host "Project Number: $projectNumber"
Write-Host "Cloud Build SA: $cloudBuildSa"
Write-Host "Cloud Run Agent: $cloudRunAgent"

Write-Host "Creating Artifact Registry repo (if it does not exist)..."
& gcloud @('artifacts', 'repositories', 'describe', $ArtifactRepo, '--location', $Region) | Out-Null
if ($LASTEXITCODE -ne 0) {
  Invoke-GCloud -Args @('artifacts','repositories','create',$ArtifactRepo,'--repository-format','docker','--location',$Region,'--description',"Docker images for $CloudRunService")
}

Write-Host "Granting IAM roles to Cloud Build service account..."
Invoke-GCloud -Args @('projects', 'add-iam-policy-binding', $ProjectId, '--member', "serviceAccount:$cloudBuildSa", '--role', 'roles/artifactregistry.writer')
Invoke-GCloud -Args @('projects', 'add-iam-policy-binding', $ProjectId, '--member', "serviceAccount:$cloudBuildSa", '--role', 'roles/run.admin')
Invoke-GCloud -Args @('projects', 'add-iam-policy-binding', $ProjectId, '--member', "serviceAccount:$cloudBuildSa", '--role', 'roles/iam.serviceAccountUser')

Write-Host "Granting Artifact Registry read access for Cloud Run service agent..."
Invoke-GCloud -Args @('projects', 'add-iam-policy-binding', $ProjectId, '--member', "serviceAccount:$cloudRunAgent", '--role', 'roles/artifactregistry.reader')

Write-Host "Done. You can now run Cloud Build (or push to trigger it)."