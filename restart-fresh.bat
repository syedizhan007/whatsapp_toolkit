@echo off
echo ╔════════════════════════════════════════════════════════════════╗
echo ║                                                                ║
echo ║           COMPLETE CACHE CLEAR AND SERVER RESTART             ║
echo ║                                                                ║
echo ╚════════════════════════════════════════════════════════════════╝
echo.

echo [1/4] Stopping all Node.js processes...
taskkill /F /IM node.exe 2>nul
if %ERRORLEVEL% EQU 0 (
    echo ✅ All Node processes stopped
) else (
    echo ℹ️  No Node processes were running
)
timeout /t 2 /nobreak >nul

echo.
echo [2/4] Waiting for ports to be released...
timeout /t 3 /nobreak >nul
echo ✅ Ports should now be available

echo.
echo [3/4] Starting fresh server...
start "WhatsApp Tool Server" cmd /k "node server.js"
timeout /t 3 /nobreak >nul
echo ✅ Server started

echo.
echo [4/4] IMPORTANT: Clear your browser cache NOW!
echo.
echo ╔════════════════════════════════════════════════════════════════╗
echo ║                    BROWSER CACHE CLEAR                         ║
echo ╚════════════════════════════════════════════════════════════════╝
echo.
echo Chrome/Edge:
echo   1. Press Ctrl + Shift + Delete
echo   2. Select "Cached images and files"
echo   3. Click "Clear data"
echo   4. Close ALL browser windows
echo   5. Reopen browser
echo   6. Go to: http://localhost:3000
echo.
echo OR use Incognito/Private mode:
echo   1. Press Ctrl + Shift + N (Chrome/Edge)
echo   2. Go to: http://localhost:3000
echo.
echo ═══════════════════════════════════════════════════════════════════
echo.
echo ✅ Server is running on http://localhost:3000
echo.
echo After clearing cache, the dashboard should load without errors!
echo.
pause
