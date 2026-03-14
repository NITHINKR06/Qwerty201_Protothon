@echo off
title VaidikaAI - Startup
color 0A
echo ============================================
echo   VaidikaAI - One-Click Startup
echo ============================================
echo.

cd /d "%~dp0"

:: 1. Start Ollama (if not already running)
echo [1/3] Starting Ollama...
tasklist /FI "IMAGENAME eq ollama.exe" 2>NUL | find /I "ollama.exe" >NUL
if %ERRORLEVEL% NEQ 0 (
    start "" "C:\Users\pslna\AppData\Local\Programs\Ollama\ollama.exe" serve
    echo       Ollama started.
    timeout /t 3 /nobreak >NUL
) else (
    echo       Ollama already running.
)

:: 2. Start Python Backend (server.py)
echo [2/3] Starting FastAPI Backend on port 8000...
start "VaidikaAI Backend" cmd /k "cd /d %~dp0 && python server.py"
timeout /t 3 /nobreak >NUL

:: 3. Start React Frontend (Vite dev server)
echo [3/3] Starting React Frontend on port 8080...
start "VaidikaAI Frontend" cmd /k "cd /d %~dp0\v1 && npm run dev"
timeout /t 3 /nobreak >NUL

echo.
echo ============================================
echo   All services started!
echo.
echo   Frontend:  http://localhost:8080
echo   Backend:   http://localhost:8000
echo   Ollama:    http://localhost:11434
echo ============================================
echo.
echo Press any key to open the app in browser...
pause >NUL
start http://localhost:8080
