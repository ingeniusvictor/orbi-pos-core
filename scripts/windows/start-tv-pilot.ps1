param(
  [int]$Port = 8787,
  [string]$HostUrl = ""
)

$ErrorActionPreference = "Stop"
$ScriptsDir = $PSScriptRoot
$RepoRoot = Split-Path -Parent (Split-Path -Parent $ScriptsDir)

if (-not $HostUrl) {
  $HostUrl = "http://localhost:$Port/showcase"
}

Set-Location $RepoRoot

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  throw "npm no está disponible en PATH."
}

if (-not (Test-Path "node_modules")) {
  Write-Host "Instalando dependencias..." -ForegroundColor Yellow
  npm install
  if ($LASTEXITCODE -ne 0) { throw "Falló npm install." }
}

if (-not (Test-Path "apps\web\dist")) {
  Write-Host "Construyendo ORBI POS..." -ForegroundColor Yellow
  npm run build
  if ($LASTEXITCODE -ne 0) { throw "Falló npm run build." }
}

$ServerScript = Join-Path $ScriptsDir "start-orbi-pos.ps1"
$KioskScript = Join-Path $ScriptsDir "open-showcase-kiosk.ps1"

Write-Host "Iniciando servidor ORBI POS..." -ForegroundColor Green
Start-Process powershell.exe -ArgumentList @(
  "-NoExit",
  "-ExecutionPolicy", "Bypass",
  "-File", $ServerScript,
  "-Port", "$Port"
)

Write-Host "Esperando al servidor..." -ForegroundColor Yellow
$Ready = $false
for ($Attempt = 0; $Attempt -lt 20; $Attempt++) {
  Start-Sleep -Milliseconds 750
  try {
    $Health = Invoke-RestMethod -Uri "http://localhost:$Port/api/health" -TimeoutSec 2
    if ($Health.ok) {
      $Ready = $true
      break
    }
  } catch {
    # El servidor puede seguir iniciando.
  }
}

if (-not $Ready) {
  throw "ORBI POS no respondió en el puerto $Port."
}

Write-Host "Servidor listo. Abriendo Showcase..." -ForegroundColor Green
& $KioskScript -HostUrl $HostUrl
