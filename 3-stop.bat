@echo off
title SafeSurge AI — Stopping

echo.
echo [STOP] Stopping SafeSurge AI processes...
echo.

:: Kill backend (node server.js on port 3001)
echo [STOP] Stopping backend (port 3001)...
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":3001 " ^| findstr "LISTENING"') do (
    echo        Killing PID %%p
    taskkill /PID %%p /F >nul 2>&1
)

:: Kill frontend (Vite on port 5173)
echo [STOP] Stopping frontend (port 5173)...
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":5173 " ^| findstr "LISTENING"') do (
    echo        Killing PID %%p
    taskkill /PID %%p /F >nul 2>&1
)

:: Kill ngrok
echo [STOP] Stopping ngrok tunnel...
taskkill /IM ngrok.exe /F >nul 2>&1

:: Close named windows
taskkill /FI "WINDOWTITLE eq SafeSurge-Backend" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq SafeSurge-Frontend" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq SafeSurge-Tunnel" /F >nul 2>&1

echo.
echo [OK]   All SafeSurge AI processes stopped.
echo.
pause
