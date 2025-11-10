@echo off
chcp 65001 >nul
title تثبيت جميع مكتبات التصحيح الإملائي

echo.
echo ════════════════════════════════════════════════════
echo   📚 تثبيت جميع مكتبات التصحيح الإملائي والنحوي
echo ════════════════════════════════════════════════════
echo.

echo 💡 سيتم تثبيت 6 مكتبات قوية:
echo.
echo    1. LanguageTool    - تدقيق نحوي شامل (30+ لغة) ⭐ الأفضل
echo    2. Jamspell        - تصحيح سريع بالسياق (5000 كلمة/ث)
echo    3. Symspellpy      - الأسرع (10x من التقليدية)
echo    4. autocorrect     - بسيط وسريع (12+ لغة)
echo    5. pyspellchecker  - خفيف (7+ لغات)
echo    6. textblob        - للإنجليزية فقط
echo.
echo ═══════════════════════════════════════════════════════
echo.

set /p choice="هل تريد تثبيت الكل؟ (Y/N): "

if /i "%choice%"=="Y" (
    goto :install_all
) else if /i "%choice%"=="N" (
    goto :menu
) else (
    echo اختيار غير صحيح!
    pause
    exit /b
)

:menu
echo.
echo اختر ما تريد تثبيته:
echo.
echo [1] LanguageTool فقط (موصى به - تدقيق شامل)
echo [2] LanguageTool + Jamspell (الأفضل للإنتاج)
echo [3] الحزمة السريعة (autocorrect + pyspellchecker)
echo [4] الحزمة الكاملة (الكل)
echo [5] إلغاء
echo.

set /p opt="اختيارك (1-5): "

if "%opt%"=="1" goto :lt_only
if "%opt%"=="2" goto :lt_jam
if "%opt%"=="3" goto :fast_pack
if "%opt%"=="4" goto :install_all
if "%opt%"=="5" exit /b

echo اختيار غير صحيح!
pause
exit /b

:lt_only
echo.
echo 📦 تثبيت LanguageTool...
call venv\Scripts\activate.bat
pip install language-tool-python
goto :done

:lt_jam
echo.
echo 📦 تثبيت LanguageTool + Jamspell (الحل الأمثل)...
call venv\Scripts\activate.bat
pip install language-tool-python jamspell
goto :done

:fast_pack
echo.
echo 📦 تثبيت الحزمة السريعة...
call venv\Scripts\activate.bat
pip install autocorrect pyspellchecker
goto :done

:install_all
echo.
echo 📦 جاري تثبيت جميع المكتبات...
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.

call venv\Scripts\activate.bat

echo [1/6] تثبيت LanguageTool...
pip install language-tool-python
if %errorlevel% neq 0 echo ❌ فشل تثبيت LanguageTool

echo.
echo [2/6] تثبيت Jamspell...
pip install jamspell
if %errorlevel% neq 0 echo ❌ فشل تثبيت Jamspell

echo.
echo [3/6] تثبيت Symspellpy...
pip install symspellpy
if %errorlevel% neq 0 echo ❌ فشل تثبيت Symspellpy

echo.
echo [4/6] تثبيت autocorrect...
pip install autocorrect
if %errorlevel% neq 0 echo ❌ فشل تثبيت autocorrect

echo.
echo [5/6] تثبيت pyspellchecker...
pip install pyspellchecker
if %errorlevel% neq 0 echo ❌ فشل تثبيت pyspellchecker

echo.
echo [6/6] تثبيت textblob...
pip install textblob
python -m textblob.download_corpora
if %errorlevel% neq 0 echo ❌ فشل تثبيت textblob

goto :done

:done
echo.
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo ✅ اكتمل التثبيت!
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.
echo 📊 ملخص المكتبات:
echo.
echo   ╔════════════════════╦═══════════╦═════════════════╗
echo   ║   المكتبة          ║  اللغات   ║  الأداء         ║
echo   ╠════════════════════╬═══════════╬═════════════════╣
echo   ║ LanguageTool       ║ 30+ لغة   ║ 500 كلمة/ث     ║
echo   ║ Jamspell           ║ 10+ لغات  ║ 5000 كلمة/ث    ║
echo   ║ Symspellpy         ║ مستقل     ║ 10000+ كلمة/ث  ║
echo   ║ autocorrect        ║ 12+ لغة   ║ 3000 كلمة/ث    ║
echo   ║ pyspellchecker     ║ 7+ لغات   ║ 2000 كلمة/ث    ║
echo   ║ textblob           ║ إنجليزية  ║ 1000 كلمة/ث    ║
echo   ╚════════════════════╩═══════════╩═════════════════╝
echo.
echo 💡 استخدام البرنامج:
echo    1. شغّل البرنامج: .\START_VENV.bat
echo    2. فعّل خيار "📝 تصحيح" في الواجهة
echo    3. البرنامج سيختار المحرك الأنسب تلقائياً
echo.
echo 🎯 التوصية:
echo    - للدقة القصوى: LanguageTool + Jamspell
echo    - للسرعة القصوى: Symspellpy أو Jamspell
echo    - للبساطة: autocorrect
echo.

pause
