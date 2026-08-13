@echo off
setlocal enabledelayedexpansion
title SafeSurge AI — Install Dependencies

echo.
echo  ╔══════════════════════════════════════════════════════╗
echo  ║     SafeSurge AI — Dependency Installer             ║
echo  ║     Gujarat Hackathon 2026 — Challenge 6            ║
echo  ╚══════════════════════════════════════════════════════╝
echo.

:: ─── Check required tools ───────────────────────────────────────────
echo [CHECK] Verifying required tools...
echo.

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [MISSING] Node.js is NOT installed.
    echo          Please install Node.js v18+ from https://nodejs.org/
    echo          Then re-run this script.
    pause
    exit /b 1
) else (
    for /f "tokens=*" %%v in ('node --version') do echo [OK]    Node.js %%v
)

where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo [MISSING] npm is NOT found. Please reinstall Node.js.
    pause
    exit /b 1
) else (
    for /f "tokens=*" %%v in ('npm --version') do echo [OK]    npm %%v
)

:: ─── Check .env file ────────────────────────────────────────────────
echo.
if not exist ".env" (
    echo [WARNING] .env file not found.
    echo          Copy .env.example to .env and fill in your watsonx credentials.
    echo          The app will still run in demo mode without credentials,
    echo          but AI agents will use fallback responses.
    echo.
    copy .env.example .env >nul 2>&1
    echo          Created .env from .env.example as a starting point.
) else (
    echo [OK]    .env file found
)

:: ─── Install backend dependencies ───────────────────────────────────
echo.
echo [INSTALL] Installing backend dependencies...
cd backend
npm install
if %errorlevel% neq 0 (
    echo [ERROR] Backend npm install failed. Check the error above.
    pause
    exit /b 1
)
echo [OK]    Backend dependencies installed
cd ..

:: ─── Install frontend dependencies ──────────────────────────────────
echo.
echo [INSTALL] Installing frontend dependencies...
cd frontend
npm install
if %errorlevel% neq 0 (
    echo [ERROR] Frontend npm install failed. Check the error above.
    pause
    exit /b 1
)
echo [OK]    Frontend dependencies installed
cd ..

:: ─── Check ngrok (optional) ─────────────────────────────────────────
echo.
where ngrok >nul 2>&1
if %errorlevel% neq 0 (
    echo [INFO]  ngrok not found — public URL tunnel will be skipped.
    echo         To enable a public URL: download ngrok from https://ngrok.com/download
    echo         and add it to your PATH, then re-run 2-start.bat
) else (
    for /f "tokens=*" %%v in ('ngrok version 2^>nul') do echo [OK]    ngrok found: %%v
)

echo.
echo  ╔══════════════════════════════════════════════════════╗
echo  ║  Installation complete!                             ║
echo  ║  Next: double-click 2-start.bat to launch the app  ║
echo  ╚══════════════════════════════════════════════════════╝
echo.
pause
