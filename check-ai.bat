@echo off
setlocal
title MakeMyChat -- AI Connection Checker
cd /d "%~dp0"

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0check-ai.ps1"
echo.
pause
endlocal
