@echo off
setlocal
title MakeMyChat -- Local AI Chat Website
cd /d "%~dp0"

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start.ps1"
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] MakeMyChat startup encountered an issue. Review the message above.
    pause
)
endlocal
