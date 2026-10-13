# ابدأ هنا — برنامج الكتابة بالصوت

راجع [README.md](README.md) للتثبيت والاستخدام، و[README_VENV.md](README_VENV.md) لإنشاء بيئة Python خاصة بالمشروع.

## البدء على Windows

افتح CMD داخل مجلد المشروع، ثم نفّذ:

```bat
python -m venv venv
call venv\Scripts\activate.bat
python -m pip install -r requirements_advanced.txt
START_VENV.bat
```

للعمل بمحرك Vosk دون إنترنت، حمّل نموذج اللغة أولاً من زر **تحميل النماذج** في الواجهة. يحتاج التحميل إلى اتصال بالإنترنت.

## ملفات التشغيل

| الملف | الاستخدام |
| --- | --- |
| `main_advanced.py` | نقطة التشغيل الرئيسية |
| `START_VENV.bat` | تشغيل Python الموجود في مجلد `venv/` |
| `START.bat` | تشغيل البرنامج باستخدام أمر `python` المتاح؛ فعّل البيئة أولاً |
| `run_simple.py` | فحص توفر المكتبات ثم محاولة فتح الواجهة |
| `download_and_run.py` | تحميل نموذج Whisper ثم تشغيل البرنامج؛ يتطلب تثبيت `openai-whisper` |

## المساعدة

- [README_ADVANCED.md](README_ADVANCED.md): الاستخدام والإعدادات.
- `fix_all.py` و`FIX_ALL.bat`: أدوات إصلاح وتثبيت المكتبات.
- `FIX_WHISPER.bat`: إصلاح تثبيت Whisper.
- `INSTALL_PYAUDIO.bat`: تثبيت مكتبة التسجيل.
- `INSTALL_TRANSLATION.bat` و`INSTALL_TTS.bat`: تثبيت الترجمة والنطق.
- `INSTALL_SPELL_CHECKER.bat` و`INSTALL_ALL_SPELLCHECKERS.bat`: تثبيت محركات التصحيح.

توجد سجلات الأخطاء في `logs/`. عند الإبلاغ عن مشكلة، أرفق رسالة الخطأ وإصدار Python في [صفحة المشكلات](https://github.com/alshinen/---Arabic-voice-typing/issues).

للمساهمة في الكود، راجع [CONTRIBUTING.md](CONTRIBUTING.md).
