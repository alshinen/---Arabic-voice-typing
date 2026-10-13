# البيئة الافتراضية

البيئة الافتراضية تعزل مكتبات المشروع عن مكتبات Python العامة. مجلد `venv/` محلي ولا يأتي مع المستودع؛ أنشئه على كل جهاز تستخدمه.

## الإعداد على Windows

افتح CMD داخل مجلد المشروع:

```bat
python -m venv venv
call venv\Scripts\activate.bat
python -m pip install --upgrade pip
python -m pip install -r requirements_advanced.txt
```

بعد اكتمال التثبيت، شغّل:

```bat
START_VENV.bat
```

يستخدم هذا الملف `venv\Scripts\python.exe` مباشرة، وينتقل إلى مجلد المشروع قبل التشغيل. إذا لم تكن البيئة موجودة، يعرض رسالة تشرح المطلوب.

إذا كنت تستخدم PowerShell، يمكنك التثبيت والتشغيل دون تفعيل البيئة:

```powershell
python -m venv venv
.\venv\Scripts\python.exe -m pip install -r requirements_advanced.txt
.\START_VENV.bat
```

## الإعداد على Linux/macOS

```bash
python3 -m venv venv
source venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements_advanced.txt
python main_advanced.py
```

قد يحتاج PyAudio إلى مكتبة PortAudio الخاصة بنظام التشغيل، كما تحتاج الواجهة إلى Tkinter. راجع قسم حل المشاكل في [README.md](README.md).

## ملاحظات

- يعتمد إصدار Python في البيئة على المفسّر المستخدم عند إنشائها؛ لا يحدد المستودع إصداراً مثبتاً على جهازك.
- لا تنقل مجلد `venv/` بين الأجهزة. أنشئ البيئة وثبّت المتطلبات من جديد على الجهاز الآخر.
- يتضمن ملف المتطلبات Vosk، بينما تثبيت `openai-whisper` اختياري.
- نماذج الصوت تُحمّل منفصلة، وتوجد افتراضياً في `~/.voice_to_text/models/`.
- أسماء البيئات `venv/` و`.venv/` مستبعدة من Git، لكن `START_VENV.bat` يتوقع الاسم `venv/` تحديداً.
- للخروج من بيئة مفعّلة، نفّذ `deactivate`.
