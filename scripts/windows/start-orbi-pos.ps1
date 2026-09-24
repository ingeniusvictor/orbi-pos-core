param(
  [int]$Port = 8787
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)

Set-Location $RepoRoot

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw "Node.js no está disponible en PATH."
}

if (-not (Test-Path "apps\web\dist")) {
  Write-Host "Build web no encontrado. Ejecutando npm run build..." -ForegroundColor Yellow
  npm run build
  if ($LASTEXITCODE -ne 0) { throw "Falló npm run build." }
}

$env:PORT = "$Port"
Write-Host "Iniciando ORBI POS en http://localhost:$Port/" -ForegroundColor Green
npm start
