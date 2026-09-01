@echo off
title Bookove — Local Server
echo.
echo   ╔══════════════════════════════════════╗
echo   ║         📚  BOOKOVE                  ║
echo   ║    Local Development Server          ║
echo   ╚══════════════════════════════════════╝
echo.

:: Check Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH.
    echo         Download it from https://nodejs.org
    pause
    exit /b 1
)

:: Install dependencies if needed
if not exist "node_modules" (
    echo [SETUP] Installing dependencies...
    npm install
    if %errorlevel% neq 0 (
        echo [ERROR] npm install failed.
        pause
        exit /b 1
    )
    echo.
)

:: Kill any existing process on port 3000
netstat -ano | findstr :3000 | findstr LISTENING >nul 2>nul
if %errorlevel% equ 0 (
    echo [INFO] Port 3000 is in use. Stopping existing server...
    for /f "tokens=5" %%p in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') do (
        taskkill /PID %%p /F >nul 2>nul
    )
    timeout /t 1 /nobreak >nul
)

:: Start server
echo [START] Launching Bookove on http://localhost:3000
echo.
start "" http://localhost:3000
node server.js
