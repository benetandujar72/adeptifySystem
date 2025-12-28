Param(
  [Parameter(Mandatory = $false)]
  [string]$DbUrl = "postgresql://postgres@db.cqqifwjzljxtiphdcyyi.supabase.co:5432/postgres?sslmode=require",

  [Parameter(Mandatory = $false)]
  [string]$CsvPath = ""
)

$ErrorActionPreference = 'Stop'

function Get-PlaintextFromSecureString([Security.SecureString]$Secure) {
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Secure)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
}

function Strip-PasswordFromDbUrl([string]$Url) {
  # Converts: postgresql://user:pass@host:5432/db -> postgresql://user@host:5432/db
  # Leaves query string intact.
  if ($Url -match '^(postgres(?:ql)?://[^/:@]+):[^@]*@(.+)$') {
    return ($Matches[1] + '@' + $Matches[2])
  }
  return $Url
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$psqlScript = Join-Path $repoRoot 'scripts/import-centers-cat.psql'

if (-not (Test-Path $psqlScript)) {
  throw "Missing psql script: $psqlScript"
}

if ([string]::IsNullOrWhiteSpace($CsvPath)) {
  $CsvPath = Join-Path $repoRoot 'totcat-centres-educatius.csv'
}

if (-not (Test-Path $CsvPath)) {
  throw "Missing CSV file: $CsvPath"
}

# Docker mount uses /work; psql needs a path inside the container for \copy.
$csvPathInContainer = '/work/totcat-centres-educatius.csv'

# Prefer using PGPASSWORD if already set, otherwise prompt securely.
$plainPassword = $env:PGPASSWORD
if ([string]::IsNullOrEmpty($plainPassword)) {
  $secure = Read-Host -Prompt 'Postgres password (will not be shown)' -AsSecureString
  $plainPassword = Get-PlaintextFromSecureString $secure
}

if ([string]::IsNullOrEmpty($plainPassword)) {
  throw 'Password is required (PGPASSWORD or prompt).'
}

$dbUrlNoPw = Strip-PasswordFromDbUrl $DbUrl

Write-Host "Using DB URL: $dbUrlNoPw" -ForegroundColor Cyan
Write-Host "Using CSV: $CsvPath" -ForegroundColor Cyan
Write-Host 'Running import via dockerized psql...' -ForegroundColor Cyan

# Mount the repo root so /work/scripts/import-centers-cat.psql exists.
# Also ensure the CSV is present at /work/totcat-centres-educatius.csv.
$targetCsv = Join-Path $repoRoot 'totcat-centres-educatius.csv'
if ((Resolve-Path $CsvPath).Path -ne (Resolve-Path $targetCsv).Path) {
  Copy-Item -Force $CsvPath $targetCsv
}

docker run --rm `
  -v "${repoRoot}:/work" `
  -w /work `
  -e "PGPASSWORD=$plainPassword" `
  postgres:16-alpine `
  psql "$dbUrlNoPw" -v ON_ERROR_STOP=1 -v csv_path="$csvPathInContainer" -f /work/scripts/import-centers-cat.psql

if ($LASTEXITCODE -ne 0) {
  throw "Import failed with exit code $LASTEXITCODE"
}

Write-Host 'Import completed successfully.' -ForegroundColor Green
