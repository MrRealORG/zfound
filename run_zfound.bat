@echo off
setlocal
cd /d "%~dp0"
title ZFound x Zeeno Soft

echo ========================================================
echo   Launching ZFound x Zeeno Soft (Rust + Tauri v2)
echo ========================================================
echo.

if not exist "%~dp0WebView2Loader.dll" (
    if exist "H:\cargo_target\zfound\debug\WebView2Loader.dll" (
        echo Copying WebView2Loader.dll dependency...
        copy /y "H:\cargo_target\zfound\debug\WebView2Loader.dll" "%~dp0" >nul
    )
)

if not exist "%~dp0zfound.exe" (
    if exist "H:\cargo_target\zfound\debug\zfound.exe" (
        echo Copying latest zfound.exe binary...
        copy /y "H:\cargo_target\zfound\debug\zfound.exe" "%~dp0" >nul
    )
)

echo Starting ZFound application...
start "" "%~dp0zfound.exe"
