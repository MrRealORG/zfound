@echo off
setlocal
title ZFound x Zeeno Soft - Production Release Builder

echo ========================================================
echo   Building ZFound x Zeeno Soft Standalone Release (.exe)
echo   Target build directory: H:\cargo_target\zfound
echo ========================================================
echo.

set "CARGO_TARGET_DIR=H:\cargo_target\zfound"
cd /d "%~dp0"
npx --yes @tauri-apps/cli build

if errorlevel 1 (
    echo.
    echo [ERROR] Build failed. Please check the logs above.
    pause
    exit /b 1
)

echo.
echo ========================================================
echo   [SUCCESS] Production Release Build Complete!
echo   Executable location:
echo   H:\cargo_target\zfound\release\zfound.exe
echo ========================================================
echo.
pause
