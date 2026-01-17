@echo off
title RankMaster - Install Dependencies
echo Installing dependencies...
echo.
call npm install
if %errorlevel% neq 0 (
    echo.
    echo Error: npm install failed. Please ensure Node.js is installed.
    pause
    exit /b
)
echo.
echo Dependencies installed successfully!
echo You can now run 'run_app.bat'.
pause