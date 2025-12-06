@echo off
chcp 65001 >nul
title Installing and Running Project

REM الانتقال إلى مجلد المشروع
cd /d "%~dp0"

echo.
echo ========================================
echo   Installing Dependencies
echo ========================================
echo.
echo Current directory: %CD%
echo.

call npm install

if %errorlevel% neq 0 (
    echo.
    echo ERROR: Failed to install dependencies!
    echo Please check your npm installation.
    pause
    exit /b %errorlevel%
)

echo.
echo ========================================
echo   Starting Development Server
echo ========================================
echo.
echo Server will start at http://localhost:3000
echo Press Ctrl+C to stop the server
echo.

call npm run dev

pause
