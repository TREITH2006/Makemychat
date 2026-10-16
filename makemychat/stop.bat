@echo off
setlocal
echo ============================================================
echo   Stopping MakeMyChat Frontend (5173) and Backend (8000)
echo ============================================================

for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5173" ^| findstr "LISTENING"') do (
    taskkill /F /T /PID %%a >nul 2>&1
)

for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8000" ^| findstr "LISTENING"') do (
    taskkill /F /T /PID %%a >nul 2>&1
)

echo [OK] MakeMyChat processes stopped.
endlocal
