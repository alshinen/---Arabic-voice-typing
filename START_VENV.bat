@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
title 🎤 Alshinen - برنامج الكتابة بالصوت

echo.
echo ════════════════════════════════════════════════════
echo     🎤 بدء تشغيل برنامج الكتابة بالصوت
echo ════════════════════════════════════════════════════
echo.

if not exist "venv\Scripts\python.exe" (
    echo ❌ البيئة الافتراضية غير موجودة. اتبع تعليمات README_VENV.md لإنشائها.
    pause
    exit /b 1
)

echo 🚀 جاري تشغيل البرنامج...
echo.

"venv\Scripts\python.exe" main_advanced.py
set "app_exit_code=%errorlevel%"

if not "%app_exit_code%"=="0" (
    echo.
    echo ⚠️ البرنامج أُغلق بشكل غير متوقع
    echo 📋 تحقق من ملفات السجل داخل مجلد logs
    echo.
) else (
    echo.
    echo ✅ تم إغلاق البرنامج بنجاح
    echo.
)

pause
exit /b %app_exit_code%
