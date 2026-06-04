@echo off
echo ========================================
echo WhatsApp Toolkit - Starting Servers
echo ========================================
echo.

echo Starting Status Server (Port 3001)...
start "Status Server" cmd /k "cd whatsapp-mcp && node status-server.js"

timeout /t 2 /nobreak >nul

echo Starting Dashboard Server (Port 3000)...
start "Dashboard Server" cmd /k "cd dashboard && node server.js"

timeout /t 2 /nobreak >nul

echo.
echo ========================================
echo Servers Started Successfully!
echo ========================================
echo.
echo Dashboard: http://localhost:3000
echo Status API: http://localhost:3001
echo.
echo Press any key to open dashboard in browser...
pause >nul

start http://localhost:3000

echo.
echo To stop servers, close the terminal windows
echo or press Ctrl+C in each window
