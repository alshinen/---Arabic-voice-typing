@echo off
chcp 65001 >nul
cls
echo ================================================================
echo            🔧 إصلاح تلقائي - Voice Typing Advanced
echo ================================================================
echo.

REM التحقق من صلاحيات Administrator
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ⚠️  تحذير: يُفضل تشغيل هذا الملف كـ Administrator
    echo    انقر بزر الماوس الأيمن واختر "Run as administrator"
    echo.
    pause
)

echo 📍 فحص Python...
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Python غير مثبت!
    echo.
    echo 💡 قم بتثبيت Python من:
    echo    https://www.python.org/downloads/
    echo.
    echo    ⚠️  تأكد من تفعيل خيار "Add Python to PATH"
    pause
    exit /b 1
)

python --version
echo ✅ Python مثبت
echo.

echo ================================================================
echo                    🚀 بدء التثبيت
echo ================================================================
echo.

echo 📦 تحديث pip...
python -m pip install --upgrade pip
echo.

echo ================================================================
echo           📦 تثبيت المكتبات الأساسية
echo ================================================================
echo.

REM المكتبات الحرجة
echo [1/8] تثبيت numpy...
python -m pip install numpy
echo.

echo [2/8] تثبيت Pillow...
python -m pip install Pillow
echo.

echo [3/8] تثبيت SpeechRecognition...
python -m pip install SpeechRecognition
echo.

echo [4/8] تثبيت PyAudio...
echo ℹ️  PyAudio قد يحتاج إلى pipwin على Windows
python -m pip install PyAudio
if errorlevel 1 (
    echo ⚠️  فشل التثبيت العادي، محاولة استخدام pipwin...
    python -m pip install pipwin
    pipwin install pyaudio
)
echo.

echo [5/8] تثبيت keyboard...
python -m pip install keyboard
echo.

echo [6/8] تثبيت pyautogui...
python -m pip install pyautogui
echo.

echo [7/8] تثبيت pyperclip...
python -m pip install pyperclip
echo.

echo [8/8] تثبيل customtkinter...
python -m pip install customtkinter
echo.

echo ================================================================
echo          📦 تثبيت محركات التعرف (اختياري)
echo ================================================================
echo.

echo 💬 هل تريد تثبيت Vosk للعمل بدون إنترنت؟ (y/n)
set /p install_vosk="> "
if /i "%install_vosk%"=="y" (
    echo تثبيت Vosk...
    python -m pip install vosk
    echo.
    echo ✅ تم تثبيت Vosk
    echo ⚠️  لا تنسى تحميل النموذج العربي من:
    echo    https://alphacephei.com/vosk/models
    echo.
)

echo.
echo 💬 هل تريد تثبيت Whisper للدقة العالية؟ (y/n)
echo    ⚠️  يحتاج مساحة كبيرة (1-3 GB)
set /p install_whisper="> "
if /i "%install_whisper%"=="y" (
    echo تثبيت openai-whisper...
    echo هذا قد يستغرق بعض الوقت...
    python -m pip install openai-whisper
    echo.
    echo ✅ تم تثبيت Whisper
    echo.
)

echo ================================================================
echo                  🔍 الفحص النهائي
echo ================================================================
echo.

echo جاري فحص المكتبات المثبتة...
python -c "import sys; packages = ['speech_recognition', 'pyaudio', 'keyboard', 'customtkinter', 'numpy']; [print(f'✅ {p}') if __import__(p) else print(f'❌ {p}') for p in packages]" 2>nul
if errorlevel 1 (
    echo.
    echo ⚠️  بعض المكتبات قد لا تكون مثبتة بشكل صحيح
    echo    جرب تشغيل السكريبت مرة أخرى كـ Administrator
    echo.
)

echo.
echo ================================================================
echo                    ✅ اكتمل التثبيت!
echo ================================================================
echo.
echo 🎉 البرنامج جاهز للاستخدام!
echo.
echo 💡 لتشغيل البرنامج:
echo    - انقر نقراً مزدوجاً على: START.bat
echo    أو
echo    - من CMD: python main_advanced.py
echo.
echo ================================================================
echo.

pause
