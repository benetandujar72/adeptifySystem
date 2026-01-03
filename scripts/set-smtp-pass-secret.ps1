param(
  [Parameter(Mandatory = $false)]
  [string]$ProjectId = "gen-lang-client-0757991117",

  [Parameter(Mandatory = $false)]
  [string]$SecretName = "SMTP_PASS"
)

$ErrorActionPreference = "Stop"

Write-Host "Adding Secret Manager version for '$SecretName' in project '$ProjectId'..." -ForegroundColor Cyan
Write-Host "You will be prompted for the SMTP password; it will NOT be echoed." -ForegroundColor Cyan

$sec = Read-Host "SMTP password" -AsSecureString
$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)

try {
  $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
}
finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
}

try {
  $tmp = New-TemporaryFile
  [IO.File]::WriteAllText($tmp.FullName, $plain, [Text.Encoding]::UTF8)

  & gcloud secrets versions add $SecretName --data-file $tmp.FullName --project $ProjectId
  if (-not $?) {
    throw "gcloud failed to add secret version"
  }

  Write-Host "Secret version added successfully." -ForegroundColor Green
}
finally {
  if ($tmp -and (Test-Path $tmp.FullName)) {
    Remove-Item $tmp.FullName -Force
  }
}
