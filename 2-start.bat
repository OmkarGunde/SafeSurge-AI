@echo off
setlocal enabledelayedexpansion
title SafeSurge AI — Starting...

echo.
echo  ╔══════════════════════════════════════════════════════╗
echo  ║     SafeSurge AI — Starting Application             ║
echo  ║     Gujarat Hackathon 2026 — Challenge 6            ║
echo  ╚══════════════════════════════════════════════════════╝
echo.

:: ─── Pre-flight checks ──────────────────────────────────────────────
if not exist ".env" (
    echo [WARNING] .env not found — running with demo credentials.
    echo          AI agents will use fallback responses.
    echo.
)

if not exist "backend\node_modules" (
    echo [ERROR] Backend node_modules not found.
    echo         Please run 1-install.bat first.
    pause
    exit /b 1
)

if not exist "frontend\node_modules" (
    echo [ERROR] Frontend node_modules not found.
    echo         Please run 1-install.bat first.
    pause
    exit /b 1
)

:: ─── Start Backend ───────────────────────────────────────────────────
echo [START] Starting SafeSurge AI Backend on port 3001...
start "SafeSurge-Backend" cmd /k "title SafeSurge-Backend && cd /d %~dp0backend && node server.js"

:: ─── Wait for backend health check ──────────────────────────────────
echo [WAIT]  Waiting for backend to be ready...
set RETRIES=0
:WAIT_LOOP
timeout /t 2 /nobreak >nul
powershell -Command "try { $r = Invoke-WebRequest -Uri 'http://localhost:3001/api/health' -TimeoutSec 2 -UseBasicParsing; exit 0 } catch { exit 1 }" >nul 2>&1
if %errorlevel% equ 0 goto BACKEND_READY
set /a RETRIES+=1
if %RETRIES% lss 15 (
    echo [WAIT]  Backend not ready yet, retrying... (attempt %RETRIES%/15)
    goto WAIT_LOOP
)
echo [WARNING] Backend health check timed out — it may still be starting. Proceeding anyway.
goto START_FRONTEND

:BACKEND_READY
echo [OK]    Backend is ready at http://localhost:3001

:: ─── Start Frontend ──────────────────────────────────────────────────
:START_FRONTEND
echo [START] Starting frontend dev server on port 5173...
start "SafeSurge-Frontend" cmd /k "title SafeSurge-Frontend && cd /d %~dp0frontend && npm run dev"

:: ─── Wait for frontend ───────────────────────────────────────────────
echo [WAIT]  Waiting for frontend to be ready...
timeout /t 6 /nobreak >nul

:: ─── Start ngrok tunnel (if available) ──────────────────────────────
echo.
where ngrok >nul 2>&1
if %errorlevel% equ 0 (
    echo [TUNNEL] Starting ngrok tunnel...
    start "SafeSurge-Tunnel" cmd /k "title SafeSurge-Tunnel && ngrok http 5173"
    timeout /t 4 /nobreak >nul
    echo [TUNNEL] ngrok tunnel started. Check the SafeSurge-Tunnel window for your public HTTPS URL.
    echo          The public URL is shown in the ngrok window as: Forwarding https://xxxx.ngrok.io -> localhost:5173
) else (
    echo [INFO]   ngrok not found — no public tunnel. App is available at http://localhost:5173 only.
    echo          To add a public URL: install ngrok from https://ngrok.com/download
)

:: ─── Open browser ────────────────────────────────────────────────────
echo.
echo [OPEN]  Opening browser...
timeout /t 2 /nobreak >nul
start http://localhost:5173

echo.
echo  ╔══════════════════════════════════════════════════════╗
echo  ║  SafeSurge AI is running!                           ║
echo  ║                                                     ║
echo  ║  Local:    http://localhost:5173                    ║
echo  ║  Backend:  http://localhost:3001                    ║
echo  ║  Health:   http://localhost:3001/api/health         ║
echo  ║                                                     ║
echo  ║  Model: ibm/granite-4-h-small                      ║
echo  ║                                                     ║
echo  ║  NOTE: This is a prototype decision-support tool.  ║
echo  ║  AI outputs are not official government warnings.  ║
echo  ╚══════════════════════════════════════════════════════╝
echo.
echo  Processes running in separate windows.
echo  Run 3-stop.bat to shut everything down.
echo.
pause
