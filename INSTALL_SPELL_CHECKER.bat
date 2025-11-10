@echo off
chcp 65001 >nul
title تثبيت المصحح الإملائي

echo.
echo ════════════════════════════════════════════════════
echo     📝 تثبيت المصحح الإملائي متعدد المحركات
echo ════════════════════════════════════════════════════
echo.

echo � يدعم البرنامج 3 محركات تصحيح:
echo    1. autocorrect (سريع - 12+ لغة) - موصى به
echo    2. pyspellchecker (خفيف - 7+ لغات)
echo    3. language-tool-python (متقدم - 30+ لغة)
echo.
echo اختر المكتبة التي تريد تثبيتها:
echo.
echo [1] autocorrect (سريع وموصى به)
echo [2] pyspellchecker (خفيف)
echo [3] language-tool-python (متقدم لكن بطيء)
echo [4] تثبيت الكل
echo.

set /p choice="اختيارك (1-4): "

if "%choice%"=="1" (
    echo.
    echo �📦 جاري تثبيت autocorrect...
    pip install autocorrect
    goto :end
)

if "%choice%"=="2" (
    echo.
    echo 📦 جاري تثبيت pyspellchecker...
    pip install pyspellchecker
    goto :end
)

if "%choice%"=="3" (
    echo.
    echo 📦 جاري تثبيت language-tool-python...
    pip install language-tool-python
    goto :end
)

if "%choice%"=="4" (
    echo.
    echo 📦 جاري تثبيت جميع المكتبات...
    pip install autocorrect pyspellchecker language-tool-python
    goto :end
)

echo.
echo ❌ اختيار غير صحيح!
goto :end

:end
if %errorlevel% equ 0 (
    echo.
    echo ✅ تم التثبيت بنجاح!
    echo.
    echo 💡 الآن يمكنك استخدام المصحح الإملائي في البرنامج
    echo    بتفعيل خيار "📝 تصحيح" في الواجهة
    echo.
    echo 📋 اللغات المدعومة حسب المحرك:
    echo    - autocorrect: 12+ لغة (en, es, fr, pt, tr, cs, pl, ru, uk, el, it, vi)
    echo    - pyspellchecker: 7+ لغات (en, es, fr, pt, de, ru, ar)
    echo    - language-tool-python: 30+ لغة (العربية، الفلبينية، وغيرها)
    echo.
) else (
    echo.
    echo ❌ فشل التثبيت!
    echo 💡 حاول مرة أخرى أو ثبت يدوياً:
    echo    pip install autocorrect
    echo.
)

pause
