@echo off
echo ========================================
echo  WhatsApp Tool - Stop All Servers
echo ========================================
echo.

echo Stopping all Node.js processes...
taskkill /F /IM node.exe 2>nul

if %ERRORLEVEL% EQU 0 (
    echo.
    echo All servers stopped successfully!
) else (
    echo.
    echo No running servers found.
)

echo.
pause
