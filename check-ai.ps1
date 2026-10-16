<#
.SYNOPSIS
    MakeMyChat -- AI Connection Checker (LiteLLM + Ollama + Backend).
.DESCRIPTION
    Verifies, in order:
      1. Docker LiteLLM proxy container (litellm-proxy)
      2. Local Ollama models
      3. Your saved API key (~/.litellm/api_key.txt, else backend/.env)
      4. A real request to LiteLLM at OPENAI_BASE_URL/v1/chat/completions
      5. The MakeMyChat FastAPI backend health endpoint (if running)
    Safe to run any time. Never prints the raw API key.
#>

$ErrorActionPreference = "Continue"
$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Definition
$BackendDir  = Join-Path $ProjectRoot "backend"
$EnvFile     = Join-Path $BackendDir ".env"
$KeyFile     = Join-Path $HOME ".litellm\api_key.txt"

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  MakeMyChat -- AI Connection Checker (LiteLLM + Ollama)" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# --- 1. LiteLLM Docker container ---
Write-Host "[1/5] LiteLLM Docker container (litellm-proxy)" -ForegroundColor Yellow
$docker = Get-Command "docker" -ErrorAction SilentlyContinue
if ($docker) {
    $proxy = (& docker ps --filter "name=litellm-proxy" --format "{{.Names}} | {{.Status}} | {{.Ports}}" 2>&1)
    if ($proxy -and ($proxy -notmatch "error during connect")) {
        Write-Host "      [OK] $proxy" -ForegroundColor Green
    } else {
        Write-Host "      [WARN] litellm-proxy is not running here. If LiteLLM lives on your" -ForegroundColor Yellow
        Write-Host "             main/RTX PC, run this checker ON that PC instead." -ForegroundColor Yellow
    }
} else {
    Write-Host "      [SKIP] Docker not found (fine if LiteLLM runs on another PC)." -ForegroundColor Gray
}
Write-Host ""

# --- 2. Ollama models ---
Write-Host "[2/5] Ollama installed models" -ForegroundColor Yellow
$ollama = Get-Command "ollama" -ErrorAction SilentlyContinue
if ($ollama) {
    & ollama list
} else {
    Write-Host "      [SKIP] Ollama not found on this machine (fine if it runs on another PC)." -ForegroundColor Gray
}
Write-Host ""

# --- 3. API key ---
Write-Host "[3/5] API key resolution" -ForegroundColor Yellow
$key = $null
if (Test-Path $KeyFile) {
    $key = (Get-Content $KeyFile -Raw).Trim()
    if ($key) { Write-Host "      [OK] Loaded key from $KeyFile" -ForegroundColor Green }
}
if (-not $key -and (Test-Path $EnvFile)) {
    foreach ($line in Get-Content $EnvFile) {
        if ($line -match '^\s*OPENAI_API_KEY\s*=\s*(.+)$') { $key = $Matches[1].Trim() }
    }
    if ($key) { Write-Host "      [OK] Loaded key from backend\.env" -ForegroundColor Green }
}
if ($key) {
    $tail = if ($key.Length -ge 4) { $key.Substring($key.Length - 4) } else { "****" }
    Write-Host "      [INFO] Key ends with ...$tail (length $($key.Length))" -ForegroundColor Gray
} else {
    Write-Host "      [FAIL] No key found in ~/.litellm/api_key.txt or backend\.env" -ForegroundColor Red
}
Write-Host ""

# --- 4. LiteLLM chat completion ---
Write-Host "[4/5] LiteLLM OpenAI-compatible API" -ForegroundColor Yellow
$baseUrl = "http://localhost:4000/v1"
$model   = "ollama/qwen3.5:4b"
if (Test-Path $EnvFile) {
    foreach ($line in Get-Content $EnvFile) {
        if ($line -match '^\s*OPENAI_BASE_URL\s*=\s*(.+)$') { $baseUrl = $Matches[1].Trim() }
        if ($line -match '^\s*AI_MODEL\s*=\s*(.+)$')       { $model   = $Matches[1].Trim() }
    }
}
if (-not $key) {
    Write-Host "      [SKIP] No API key available to test." -ForegroundColor Gray
} else {
    $body = @{
        model    = $model
        messages = @(@{ role = "user"; content = "Reply with: API connected successfully" })
        stream   = $false
    } | ConvertTo-Json -Depth 5
    try {
        $resp = Invoke-RestMethod -Uri "$baseUrl/chat/completions" -Method Post `
            -Headers @{ Authorization = "Bearer $key" } `
            -ContentType "application/json" -Body $body -TimeoutSec 30
        $answer = $resp.choices[0].message.content
        Write-Host "      [OK] $baseUrl  model=$model" -ForegroundColor Green
        Write-Host "      [AI] $answer" -ForegroundColor Green
    } catch {
        $status = $_.Exception.Response.StatusCode.value__
        if ($status -eq 401 -or $status -eq 403) {
            Write-Host "      [FAIL] LiteLLM rejected the API key (HTTP $status)." -ForegroundColor Red
            Write-Host "             Your backend will auto-retry the O/0 spelling variants." -ForegroundColor Yellow
        } else {
            Write-Host "      [FAIL] Cannot reach $baseUrl ($($_.Exception.Message))." -ForegroundColor Red
            Write-Host "             Same PC? start LiteLLM. Other laptop? Use the main PC's IP." -ForegroundColor Yellow
        }
    }
}
Write-Host ""

# --- 5. MakeMyChat backend health ---
Write-Host "[5/5] MakeMyChat FastAPI backend" -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/health" -TimeoutSec 15
    $color = if ($health.ai_provider_reachable) { "Green" } else { "Yellow" }
    Write-Host "      backend_running=$($health.backend_running) ai_provider_reachable=$($health.ai_provider_reachable)" -ForegroundColor $color
    Write-Host "      model=$($health.model)  base_url=$($health.base_url)" -ForegroundColor Gray
    Write-Host "      $($health.ai_provider_message)" -ForegroundColor $color
} catch {
    Write-Host "      [SKIP] Backend not running on 127.0.0.1:8000 (start it with start.bat)." -ForegroundColor Gray
}
Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  Done." -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
