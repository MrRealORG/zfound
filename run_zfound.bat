@echo off
setlocal
cd /d "%~dp0"
title ZFound x Zeeno Soft v0.1

echo.
echo ========================================================
echo   ZFound v0.1 - Minimal Vision Intelligence Workspace
echo   Branded by Zeeno Soft
echo ========================================================
echo.

python app.py

if errorlevel 1 (
    echo.
    echo [ZFound] App exited with an error.
    pause
)
