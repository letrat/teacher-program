@echo off
chcp 65001 >nul
cls
echo ========================================
echo   Create Admin User
echo ========================================
echo.

if "%1"=="" (
    set USERNAME=admin
) else (
    set USERNAME=%1
)

if "%2"=="" (
    set PASSWORD=admin123
) else (
    set PASSWORD=%2
)

if "%3"=="" (
    set NAME=مدير النظام
) else (
    set NAME=%3
)

echo Creating admin user...
echo Username: %USERNAME%
echo Password: %PASSWORD%
echo Name: %NAME%
echo.

call node create-admin.js %USERNAME% %PASSWORD% "%NAME%"

echo.
pause








