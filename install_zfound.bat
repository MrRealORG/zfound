@echo off
setlocal EnableDelayedExpansion
title ZFound - 1-Click Installer
color 0B

cd /d "%~dp0"

echo.
echo ==============================================================================
echo       ZFound - 1-Click Setup & Dependency Installer
echo ==============================================================================
echo.

where python >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python not found on this system!
    echo Opening https://www.python.org/downloads/ ...
    start https://www.python.org/downloads/
    echo IMPORTANT: Make sure to check "Add python.exe to PATH" during installation.
    pause
    exit /b 1
)

for /f "tokens=2" %%v in ('python --version 2^>^&1') do set "PYVER=%%v"
echo [OK] Python %PYVER% detected.
echo.

if not exist "%~dp0venv\Scripts\python.exe" (
    echo [*] Creating virtual environment in .\venv ...
    python -m venv "%~dp0venv"
)
set "PY_CMD=%~dp0venv\Scripts\python.exe"
set "PIP_CMD=%~dp0venv\Scripts\pip.exe"

echo [*] Upgrading pip...
"%PIP_CMD%" install --upgrade pip --quiet

echo [*] Installing PyTorch CPU build...
"%PIP_CMD%" install torch torchvision --index-url https://download.pytorch.org/whl/cpu --no-warn-script-location

echo [*] Installing requirements from requirements.txt...
"%PIP_CMD%" install -r "%~dp0requirements.txt" --no-warn-script-location

echo.
color 0A
echo ==============================================================================
echo   ZFound Installation Complete!
echo   Run run_zfound.bat to start.
echo ==============================================================================
echo.

pause
