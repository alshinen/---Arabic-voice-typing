@echo off
chcp 65001 >nul
echo.
echo ═══════════════════════════════════════════════════════
echo    📦 تثبيت مكتبة الترجمة - Googletrans
echo ═══════════════════════════════════════════════════════
echo.
echo 🔄 جاري تثبيت googletrans...
echo.

pip install googletrans==4.0.0rc1

echo.
if %ERRORLEVEL% EQU 0 (
    echo ✅ تم تثبيت مكتبة الترجمة بنجاح!
    echo.
    echo 💡 الآن يمكنك:
    echo    1. تشغيل البرنامج: START.bat
    echo    2. استخدام ميزة الترجمة من الواجهة
    echo.
) else (
    echo ❌ فشل التثبيت!
    echo.
    echo 💡 حاول:
    echo    pip install deep-translator
    echo.
)

echo.
pause
