# PowerShell script to launch ProcureGuard-AI Dual Portals and Backend
param (
    [string]$Target = "all" # "client", "admin", "backend", "all"
)

Write-Host "=====================================================================" -ForegroundColor Cyan
Write-Host "   PROCUREGUARD-AI DUAL SOVEREIGN PORTAL RUNNER" -ForegroundColor Cyan
Write-Host "=====================================================================" -ForegroundColor Cyan
Write-Host "Client (MSME Vendor): http://localhost:3000" -ForegroundColor Green
Write-Host "Admin  (Govt Auditor): http://localhost:3001" -ForegroundColor Yellow
Write-Host "Backend (FastAPI):     http://localhost:8000" -ForegroundColor Magenta
Write-Host "=====================================================================" -ForegroundColor Cyan

if ($Target -eq "all" -or $Target -eq "backend") {
    Write-Host "[1/3] Starting Backend Server (Port 8000)..." -ForegroundColor Magenta
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd d:\fed-learning\main\backend; python -m uvicorn src.main:app --host 0.0.0.0 --port 8000 --reload"
}

if ($Target -eq "all" -or $Target -eq "client") {
    Write-Host "[2/3] Starting MSME Client Portal (Port 3000)..." -ForegroundColor Green
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd d:\fed-learning\main\frontend-client; npm run dev"
}

if ($Target -eq "all" -or $Target -eq "admin") {
    Write-Host "[3/3] Starting Government Admin Portal (Port 3001)..." -ForegroundColor Yellow
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd d:\fed-learning\main\frontend-admin; npm run dev"
}

Write-Host "`nAll requested services launched in separate windows!" -ForegroundColor Cyan
