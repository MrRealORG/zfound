@echo off
setlocal
title ZFound x Zeeno Soft (Rust + Tauri)

echo ========================================================
echo   Launching ZFound x Zeeno Soft (Tauri v2 + Rust)
echo   Target build directory set to H:\cargo_target\zfound
echo ========================================================
echo.

set "CARGO_TARGET_DIR=H:\cargo_target\zfound"
cd /d "%~dp0"
npx --yes @tauri-apps/cli dev
