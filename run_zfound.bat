@echo off
setlocal
title ZFound Vision Intelligence Workspace
color 0B

cd /d "%~dp0"

:: Check local venv or parent venv
if exist "%~dp0venv\Scripts\python.exe" (
    set "PY_CMD=%~dp0venv\Scripts\python.exe"
) else if exist "%~dp0..\venv\Scripts\python.exe" (
    set "PY_CMD=%~dp0..\venv\Scripts\python.exe"
) else (
    where python >nul 2>&1
    if errorlevel 1 (
        echo.
        echo [ERROR] Python not found! Please run install_zfound.bat first.
        pause
        exit /b 1
    )
    set "PY_CMD=python"
)

:: Sanity check
"%PY_CMD%" -c "import webview, cv2" >nul 2>&1
if errorlevel 1 (
    echo.
    echo [NOTICE] Dependencies not installed. Running installer...
    call "%~dp0install_zfound.bat"
    exit /b %errorlevel%
)

echo.
echo ========================================================
echo   ZFound v0.1 - Minimal Vision Intelligence Workspace
echo   Branded by Zeeno Soft
echo ========================================================
echo.

"%PY_CMD%" app.py

if errorlevel 1 (
    echo.
    echo [ZFound] App exited with an error.
    echo Run install_zfound.bat to ensure all dependencies are installed.
    pause
)
