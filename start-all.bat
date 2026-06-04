@echo off
echo ========================================
echo  WhatsApp Tool - Start All Servers
echo ========================================
echo.

echo [1/4] Starting Root Server (Port 3000)...
start "WhatsApp Tool - Root Server" cmd /k "node server.js"
timeout /t 3 /nobreak >nul

echo [2/4] Starting Backend Server (Port 3001)...
start "WhatsApp Tool - Backend Server" cmd /k "cd backend && node server.js"
timeout /t 3 /nobreak >nul

echo [3/4] Starting Dashboard Server (Port 3002)...
start "WhatsApp Tool - Dashboard Server" cmd /k "cd dashboard && node server.js"
timeout /t 3 /nobreak >nul

echo [4/4] All servers started!
echo.
echo ========================================
echo  Server URLs:
echo ========================================
echo  Root Server:      http://localhost:3000
echo  Backend Server:   http://localhost:3001
echo  Dashboard Server: http://localhost:3002
echo ========================================
echo.
echo Press any key to exit this window...
echo (Server windows will remain open)
pause >nul
