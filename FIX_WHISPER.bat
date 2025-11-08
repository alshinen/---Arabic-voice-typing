@echo off
chcp 65001 >nul
echo ========================================
echo 🔧 إصلاح مشكلة Whisper
echo ========================================
echo.
echo هذا السكريبت سيقوم بـ:
echo 1. إلغاء تثبيت whisper الخاطئ
echo 2. تثبيت openai-whisper الصحيح
echo.
echo ⚠️ قد يستغرق هذا بضع دقائق...
echo.

REM إلغاء تثبيت whisper الخاطئ
echo 📦 إلغاء تثبيت whisper الخاطئ...
python -m pip uninstall whisper -y >nul 2>&1
if errorlevel 1 (
    echo ⚠️ لم يتم العثور على whisper لل卸载 (قد يكون مثبتاً باسم آخر)
)

echo.
echo 📦 تثبيت openai-whisper الصحيح...
echo ⏰ هذا قد يستغرق بضع دقائق...
python -m pip install openai-whisper

if errorlevel 1 (
    echo.
    echo ❌ فشل التثبيت
    echo 💡 حاول يدوياً: pip install openai-whisper
    pause
    exit /b 1
)

echo.
echo ✅ تم الإصلاح بنجاح!
echo.
echo 🔍 التحقق من التثبيت...
python -c "import whisper; print('✅ Whisper يعمل بشكل صحيح!')" 2>nul
if errorlevel 1 (
    echo ⚠️ قد تحتاج لإعادة تشغيل Terminal/PowerShell
)

echo.
echo 🎉 جاهز! يمكنك الآن تشغيل البرنامج
echo.
pause



