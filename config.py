#!/usr/bin/env python3
"""
ملف الإعدادات العامة للبرنامج
"""

import os

# إعدادات محرك التعرف على الصوت
RECOGNITION_ENGINE = "whisper"  # أو "vosk"
WHISPER_MODEL_SIZE = "base"     # tiny, base, small, medium, large (كلما كبر كلما زادت الدقة والبطء)
VOSK_MODEL_PATH = None          # سيبحث تلقائياً في مجلد models/

# إعدادات اللغة
LANGUAGE = "ar"                 # ar للعربية

# إعدادات التسجيل الصوتي
SAMPLE_RATE = 16000            # معدل العينات (Hz)
CHUNK_SIZE = 8000              # حجم القطعة
PHRASE_TIME_LIMIT = 10         # الحد الأقصى لطول الجملة (بالثواني)
PAUSE_THRESHOLD = 1.5          # وقت الانتظار عند الصمت (بالثواني)

# إعدادات الكتابة
TYPING_METHOD = "keyboard"     # keyboard أو pyautogui
TYPING_DELAY = 0.01            # التأخير بين الأحرف (بالثواني)
AUTO_SPACE = True              # إضافة مسافة تلقائية بعد كل كلمة

# إعدادات الواجهة
USE_CUSTOMTKINTER = True       # استخدام CustomTkinter إذا كان متاحاً
THEME = "dark"                 # dark, light, system
WINDOW_WIDTH = 600
WINDOW_HEIGHT = 700

# إعدادات الملفات
HISTORY_FILE = "voice_history.txt"  # ملف حفظ التاريخ
CONFIG_FILE = "config.json"          # ملف الإعدادات المحفوظة

# مسارات النماذج
MODELS_DIR = os.path.join(os.path.dirname(__file__), "models")
VOSK_MODELS = {
    "ar": os.path.join(MODELS_DIR, "vosk-model-ar-0.22"),
    "en": os.path.join(MODELS_DIR, "vosk-model-en-us-0.22"),
}

# إعدادات التصحيح التلقائي
AUTO_CORRECT_ENABLED = True
CORRECTIONS = {
    "انتهت الفترة التجريبية المجانية": "",
    "شو": "ما هو",
    "ليش": "لماذا",
    "وين": "أين",
}

# الأوامر الصوتية
VOICE_COMMANDS = {
    "سطر جديد": "\n",
    "نقطة": ".",
    "فاصلة": "،",
    "فاصلة منقوطة": "؛",
    "نقطتان": ":",
    "علامة استفهام": "؟",
    "علامة تعجب": "!",
    "قوس مفتوح": "(",
    "قوس مغلق": ")",
    "مسافة": " ",
}

