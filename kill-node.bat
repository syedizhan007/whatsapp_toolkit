@echo off
echo Killing all Node.js processes...
taskkill /F /IM node.exe 2>nul
if %errorlevel% equ 0 (
    echo Success: All Node.js processes killed
) else (
    echo No Node.js processes found running
)
echo.
echo Port 3000 should now be free.
echo.
echo Now you can start the server:
echo cd C:\Users\kk\Desktop\whatsapptool\backend
echo node server.js
pause
