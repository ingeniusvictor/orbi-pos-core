param(
  [string]$HostUrl = "http://localhost:8787/showcase"
)

$ErrorActionPreference = "Stop"

$Candidates = @(
  "$env:ProgramFiles(x86)\Microsoft\Edge\Application\msedge.exe",
  "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe"
) | Where-Object { $_ -and (Test-Path $_) }

if (-not $Candidates) {
  throw "No se encontró Microsoft Edge. Abre manualmente: $HostUrl"
}

$Edge = $Candidates[0]
Write-Host "Abriendo ORBI Showcase en modo kiosco: $HostUrl" -ForegroundColor Green

Start-Process -FilePath $Edge -ArgumentList @(
  "--kiosk",
  $HostUrl,
  "--edge-kiosk-type=fullscreen",
  "--no-first-run",
  "--disable-pinch"
)
