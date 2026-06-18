@echo off
cd /d "%~dp0"
:: Kill any existing node processes owned by the current user to ensure the port is free for a fresh start
taskkill /F /IM node.exe /FI "USERNAME eq %USERNAME%" >nul 2>&1
:: Start vite server on strict port 5173, exposed to local network
start /b npm run dev -- --port 5173 --strictPort --host
:: Wait 3 seconds for server to initialize
timeout /t 3 /nobreak >nul
:: Launch Chrome in App Mode with shared profile folder
start chrome --user-data-dir="%~dp0chrome_profile" --app=http://localhost:5173
