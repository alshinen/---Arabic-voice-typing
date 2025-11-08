@echo off
chcp 65001 >nul
echo.
echo ═══════════════════════════════════════════════════════
echo    📦 تثبيت PyAudio - مكتبة تسجيل الصوت
echo ═══════════════════════════════════════════════════════
echo.
echo 🔄 جاري تثبيت PyAudio...
echo.

pip install PyAudio

echo.
if %ERRORLEVEL% EQU 0 (
    echo ✅ تم تثبيت PyAudio بنجاح!
    echo.
    echo 💡 الآن يمكنك:
    echo    1. تشغيل البرنامج: START.bat
    echo    2. بدء التسجيل بالصوت
    echo.
) else (
    echo ❌ فشل التثبيت!
    echo.
    echo 💡 جرّب الطريقة البديلة:
    echo    pip install pipwin
    echo    pipwin install pyaudio
    echo.
    echo أو حمّل الملف يدوياً من:
    echo    https://www.lfd.uci.edu/~gohlke/pythonlibs/#pyaudio
    echo.
)

echo.
pause
