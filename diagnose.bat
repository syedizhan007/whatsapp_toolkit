@echo off
echo.
echo ╔════════════════════════════════════════════════════════════════╗
echo ║                                                                ║
echo ║              WhatsApp Tool - Error Diagnosis                   ║
echo ║                                                                ║
echo ╚════════════════════════════════════════════════════════════════╝
echo.
echo Running diagnostics...
echo.

echo [1/5] Checking Supabase connectivity...
nslookup xrphyjkrzolqyowkkvzf.supabase.co >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ❌ CRITICAL: Cannot resolve Supabase URL
    echo    Your Supabase project URL does not exist!
    echo.
    echo    ACTION REQUIRED:
    echo    1. Get correct Supabase URL from: https://supabase.com/dashboard
    echo    2. Run: node update-supabase-config.js YOUR_URL YOUR_KEY
    echo.
) else (
    echo ✅ Supabase URL resolves correctly
)

echo.
echo [2/5] Checking required files...
if exist "update-supabase-config.js" (
    echo ✅ update-supabase-config.js exists
) else (
    echo ❌ update-supabase-config.js missing
)

if exist "fix-database.js" (
    echo ✅ fix-database.js exists
) else (
    echo ❌ fix-database.js missing
)

if exist "COMPLETE_DATABASE_SETUP.sql" (
    echo ✅ COMPLETE_DATABASE_SETUP.sql exists
) else (
    echo ❌ COMPLETE_DATABASE_SETUP.sql missing
)

echo.
echo [3/5] Checking dependencies...
if exist "node_modules" (
    echo ✅ Root dependencies installed
) else (
    echo ❌ Root dependencies missing - run: npm install
)

if exist "backend\node_modules" (
    echo ✅ Backend dependencies installed
) else (
    echo ❌ Backend dependencies missing - run: cd backend ^&^& npm install
)

echo.
echo [4/5] Checking port availability...
netstat -ano | findstr ":3000 " | findstr "LISTENING" >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo ⚠️  Port 3000 is in use
) else (
    echo ✅ Port 3000 is available
)

netstat -ano | findstr ":3001 " | findstr "LISTENING" >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo ⚠️  Port 3001 is in use
) else (
    echo ✅ Port 3001 is available
)

netstat -ano | findstr ":3002 " | findstr "LISTENING" >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo ⚠️  Port 3002 is in use
) else (
    echo ✅ Port 3002 is available
)

echo.
echo [5/5] Checking configuration files...
if exist ".env" (
    echo ✅ .env file exists
) else (
    echo ❌ .env file missing
)

echo.
echo ╔════════════════════════════════════════════════════════════════╗
echo ║                    Diagnosis Complete                          ║
echo ╚════════════════════════════════════════════════════════════════╝
echo.
echo 📋 NEXT STEPS:
echo.
echo 1. Fix Supabase connection:
echo    - Get URL and key from: https://supabase.com/dashboard
echo    - Run: node update-supabase-config.js YOUR_URL YOUR_KEY
echo.
echo 2. Setup database:
echo    - Run: node fix-database.js
echo    - Follow instructions to run SQL in Supabase
echo.
echo 3. Start servers:
echo    - Run: start-all.bat
echo.
echo 4. Test website:
echo    - Open: http://localhost:3000
echo    - Check for errors in browser console (F12)
echo.
echo 📖 For detailed instructions, read: FINAL_SUMMARY.md
echo.
pause
