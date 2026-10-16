<#
.SYNOPSIS
    MakeMyChat -- One-Command Windows 11 Startup Script (Pure ASCII)
.DESCRIPTION
    Automatically frees ports 8000 and 5173 if already in use, installs
    dependencies if needed, and starts both the FastAPI backend and Vite frontend.
#>

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Definition
$BackendDir  = Join-Path $ProjectRoot "backend"
$FrontendDir = Join-Path $ProjectRoot "frontend"

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  MakeMyChat -- Local AI Chat Website Startup" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

if (-not (Get-Command "python" -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] Python 3 is not installed or not in your PATH." -ForegroundColor Red
    exit 1
}

if (-not (Get-Command "node" -ErrorAction SilentlyContinue) -or -not (Get-Command "npm" -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] Node.js / npm is not installed or not in your PATH." -ForegroundColor Red
    exit 1
}

# Automatically free ports 8000 and 5173 if any old process is holding them
foreach ($port in @(8000, 5173)) {
    $lines = netstat -aon | Select-String ":$port\s+.*LISTENING"
    foreach ($line in $lines) {
        $parts = ($line.ToString().Trim() -split '\s+')
        $procId = $parts[-1]
        if ($procId -match '^\d+$' -and [int]$procId -gt 0) {
            Write-Host "[CLEANUP] Freeing port $port (stopping old PID $procId)..." -ForegroundColor Yellow
            & taskkill /F /T /PID $procId >$null 2>&1
        }
    }
}
Start-Sleep -Milliseconds 500

# Ensure backend\.env exists with pre-loaded API key
$EnvFile        = Join-Path $BackendDir ".env"
$EnvExampleFile = Join-Path $BackendDir ".env.example"

if (-not (Test-Path $EnvFile)) {
    Copy-Item -Path $EnvExampleFile -Destination $EnvFile
    Write-Host "[OK] Created backend\.env with your pre-configured API key." -ForegroundColor Green
}

# Create backend virtual environment if missing
$VenvDir    = Join-Path $BackendDir ".venv"
$VenvPython = Join-Path $VenvDir "Scripts\python.exe"
$ReqFile    = Join-Path $BackendDir "requirements.txt"
$ReqStamp   = Join-Path $VenvDir ".requirements_installed"

if (-not (Test-Path $VenvPython)) {
    Write-Host "[SETUP] Creating Python virtual environment in backend\.venv ..." -ForegroundColor Cyan
    Push-Location $BackendDir
    & python -m venv .venv
    Pop-Location
}

$NeedPipInstall = $true
if (Test-Path $ReqStamp) {
    $reqHash = (Get-FileHash $ReqFile -Algorithm SHA256).Hash
    $stampHash = (Get-Content $ReqStamp -ErrorAction SilentlyContinue | Select-Object -First 1)
    if ($reqHash -eq $stampHash) {
        $NeedPipInstall = $false
    }
}

if ($NeedPipInstall) {
    Write-Host "[SETUP] Installing Python backend packages ..." -ForegroundColor Cyan
    & $VenvPython -m pip install --upgrade pip --quiet
    & $VenvPython -m pip install -r $ReqFile
    (Get-FileHash $ReqFile -Algorithm SHA256).Hash | Set-Content -Path $ReqStamp -Encoding Ascii
    Write-Host "[OK] Backend dependencies ready." -ForegroundColor Green
}

$NodeModulesDir = Join-Path $FrontendDir "node_modules"
if (-not (Test-Path $NodeModulesDir)) {
    Write-Host "[SETUP] Installing frontend npm packages (first run) ..." -ForegroundColor Cyan
    Push-Location $FrontendDir
    & npm install
    Pop-Location
    Write-Host "[OK] Frontend dependencies ready." -ForegroundColor Green
}

Write-Host ""
Write-Host "[START] Starting MakeMyChat Backend (port 8000) and Frontend (port 5173)..." -ForegroundColor Cyan

$BackendProc = $null
$FrontendProc = $null

try {
    $BackendProc = Start-Process -FilePath $VenvPython `
        -ArgumentList "-m", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", "8000" `
        -WorkingDirectory $BackendDir `
        -PassThru -NoNewWindow

    Start-Sleep -Seconds 2

    $FrontendProc = Start-Process -FilePath "cmd.exe" `
        -ArgumentList "/c", "npm run dev" `
        -WorkingDirectory $FrontendDir `
        -PassThru -NoNewWindow

    Start-Sleep -Seconds 2

    Write-Host ""
    Write-Host "============================================================" -ForegroundColor Green
    Write-Host "  MakeMyChat is running! Open in your browser:" -ForegroundColor Green
    Write-Host "  -> http://localhost:5173" -ForegroundColor White
    Write-Host "  -> http://127.0.0.1:5173" -ForegroundColor White
    Write-Host "  Backend API : http://127.0.0.1:8000" -ForegroundColor Gray
    Write-Host "============================================================" -ForegroundColor Green
    Write-Host ""

    while (-not $BackendProc.HasExited -and -not $FrontendProc.HasExited) {
        Start-Sleep -Seconds 1
    }
} finally {
    Write-Host ""
    Write-Host "[STOP] Shutting down MakeMyChat..." -ForegroundColor Cyan
    if ($FrontendProc -and -not $FrontendProc.HasExited) {
        & taskkill /PID $FrontendProc.Id /T /F >$null 2>&1
    }
    if ($BackendProc -and -not $BackendProc.HasExited) {
        & taskkill /PID $BackendProc.Id /T /F >$null 2>&1
    }
    Write-Host "[OK] MakeMyChat stopped cleanly." -ForegroundColor Green
}

