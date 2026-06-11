@echo off
REM WhatsApp Toolkit - Hugging Face Deployment Script (Windows)
REM Run this script after logging in with: hf auth login

echo ================================================================
echo   WhatsApp Toolkit - Hugging Face Spaces Deployment
echo ================================================================
echo.

REM Check if logged in
echo [1/5] Checking HF CLI authentication...
hf auth whoami >nul 2>&1
if errorlevel 1 (
    echo ERROR: Not logged into Hugging Face CLI
    echo.
    echo Please run: hf auth login
    echo Get your token from: https://huggingface.co/settings/tokens
    pause
    exit /b 1
)
echo ✓ Authenticated
echo.

REM Navigate to project directory
cd /d "%~dp0"

REM Create Space
echo [2/5] Creating Space on Hugging Face...
hf repos create izhan5/whatsapp-toolkit --type space --sdk docker 2>nul
if errorlevel 1 (
    echo Space already exists or creation skipped
) else (
    echo ✓ Space created successfully
)
echo.

REM Add HF remote
echo [3/5] Setting up git remote...
git remote | findstr /c:"hf" >nul
if errorlevel 1 (
    git remote add hf https://huggingface.co/spaces/izhan5/whatsapp-toolkit
    echo ✓ Added HF remote
) else (
    echo Space remote already exists
)
echo.

REM Push to Hugging Face
echo [4/5] Deploying to Hugging Face Spaces...
git push hf main
echo.

echo [5/5] Deployment Complete!
echo.
echo ================================================================
echo   NEXT STEPS
echo ================================================================
echo.
echo 1. Configure Environment Variables:
echo    https://huggingface.co/spaces/izhan5/whatsapp-toolkit/settings
echo.
echo    Add these secrets:
echo    - GROQ_API_KEY
echo    - SUPABASE_URL
echo    - SUPABASE_ANON_KEY
echo.
echo 2. Monitor Build:
echo    https://huggingface.co/spaces/izhan5/whatsapp-toolkit/logs
echo.
echo 3. Access Your App:
echo    https://izhan5-whatsapp-toolkit.hf.space
echo.
echo Build time: approximately 5-10 minutes
echo.
pause
