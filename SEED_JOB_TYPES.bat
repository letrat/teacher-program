@echo off
chcp 65001 >nul
cls
echo ========================================
echo   Adding Job Types (صفات الموظفين)
echo ========================================
echo.

echo Adding job types:
echo   - معلم
echo   - نشاط طلابي
echo   - موجه طلابي
echo   - موجه صحي
echo   - محضر مختبر
echo.

call node seed-job-types.js

echo.
echo Done! Job types have been added.
echo.
pause







