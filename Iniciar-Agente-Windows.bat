@echo off
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
  echo Falta instalar Node.js 18 o superior.
  pause
  exit /b 1
)
if not exist node_modules call npm install
start "" http://127.0.0.1:8787
npm start
pause
