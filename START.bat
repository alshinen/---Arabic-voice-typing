@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
title برنامج الكتابة بالصوت - Voice Typing
echo ================================================
echo 🎤 برنامج الكتابة بالصوت - النسخة المتقدمة
echo ================================================
echo.
echo 🔄 جاري تشغيل البرنامج...
echo.
python main_advanced.py
set "app_exit_code=%errorlevel%"
if not "%app_exit_code%"=="0" (
    echo.
    echo ❌ حدث خطأ أثناء التشغيل
    pause
)
exit /b %app_exit_code%

