@echo off
chcp 65001 >nul
echo.
echo ═══════════════════════════════════════════════════════
echo    🔊 تثبيت مكتبات تحويل النص إلى كلام (TTS)
echo ═══════════════════════════════════════════════════════
echo.
echo 🔄 جاري تثبيت المكتبات...
echo.

echo [1/3] تثبيت gtts (Google Text-to-Speech)...
pip install gtts

echo.
echo [2/3] تثبيت pyttsx3 (محلي - بدون إنترنت)...
pip install pyttsx3

echo.
echo [3/3] تثبيت pygame (لتشغيل الصوت)...
pip install pygame

echo.
if %ERRORLEVEL% EQU 0 (
    echo ✅ تم تثبيت مكتبات TTS بنجاح!
    echo.
    echo 💡 الآن يمكنك:
    echo    1. تشغيل البرنامج: START.bat
    echo    2. استخدام ميزة الترجمة الصوتية
    echo    3. تفعيل خيار "🔊 نطق" في قسم الترجمة
    echo.
    echo 🎯 مثال:
    echo    • اكتب أو سجّل نص بالعربي
    echo    • اختر: عربي → إنجليزي
    echo    • فعّل "🔊 نطق"
    echo    • اضغط "ترجم"
    echo    • سيتم نطق الترجمة بالإنجليزي!
    echo.
) else (
    echo ❌ فشل التثبيت!
    echo.
    echo 💡 حاول تثبيت كل مكتبة يدوياً:
    echo    pip install gtts
    echo    pip install pyttsx3
    echo    pip install pygame
    echo.
)

echo.
pause
