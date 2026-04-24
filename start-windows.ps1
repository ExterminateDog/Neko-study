param(
  [switch]$Help
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ProjectRoot

if ($Help) {
  Write-Host "Usage: powershell -ExecutionPolicy Bypass -File .\start-windows.ps1"
  Write-Host "Starts the Neko Study web app and API service."
  exit 0
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host "Node.js is not installed or not in PATH." -ForegroundColor Red
  Write-Host "Please install Node.js 20+ first."
  exit 1
}

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  Write-Host "npm is not installed or not in PATH." -ForegroundColor Red
  exit 1
}

Write-Host "Node: $(node -v)"
Write-Host "npm: $(npm -v)"

if (-not (Test-Path -LiteralPath "node_modules")) {
  Write-Host "Installing dependencies..."
  npm install
}

Write-Host "Building frontend assets..." -ForegroundColor Yellow
npm run build

Write-Host "Starting Neko Study in single-port mode..." -ForegroundColor Green
Write-Host "Access URL: http://0.0.0.0:3001"
Write-Host "Only port 3001 needs to be opened. The backend will serve the frontend pages and API together."
Write-Host "Other devices on your LAN can access it using this machine's IP address and port 3001."
Write-Host "Press Ctrl+C to stop."
npm start
