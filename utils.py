#!/usr/bin/env python3
"""
وظائف مساعدة للبرنامج
"""

import os
import json
import sqlite3
from datetime import datetime
from typing import List, Dict, Optional


class HistoryManager:
    """مدير سجل النصوص المحولة"""
    
    def __init__(self, db_path="voice_history.db"):
        """تهيئة مدير السجل"""
        self.db_path = db_path
        self.init_database()
    
    def init_database(self):
        """تهيئة قاعدة البيانات"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                text TEXT NOT NULL,
                timestamp DATETIME NOT NULL,
                length INTEGER
            )
        """)
        conn.commit()
        conn.close()
    
    def save_text(self, text: str):
        """حفظ نص في السجل"""
        if not text or not text.strip():
            return
        
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO history (text, timestamp, length) VALUES (?, ?, ?)",
            (text.strip(), datetime.now().isoformat(), len(text))
        )
        conn.commit()
        conn.close()
    
    def get_history(self, limit: int = 50) -> List[Dict]:
        """الحصول على السجل"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute(
            "SELECT * FROM history ORDER BY timestamp DESC LIMIT ?",
            (limit,)
        )
        rows = cursor.fetchall()
        conn.close()
        
        return [
            {
                "id": row[0],
                "text": row[1],
                "timestamp": row[2],
                "length": row[3]
            }
            for row in rows
        ]
    
    def clear_history(self):
        """مسح السجل"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute("DELETE FROM history")
        conn.commit()
        conn.close()


class ConfigManager:
    """مدير الإعدادات"""
    
    def __init__(self, config_file="config.json"):
        """تهيئة مدير الإعدادات"""
        self.config_file = config_file
        self.config = self.load_config()
    
    def load_config(self) -> dict:
        """تحميل الإعدادات"""
        if os.path.exists(self.config_file):
            try:
                with open(self.config_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except:
                return {}
        return {}
    
    def save_config(self, config: dict):
        """حفظ الإعدادات"""
        try:
            with open(self.config_file, 'w', encoding='utf-8') as f:
                json.dump(config, f, indent=4, ensure_ascii=False)
            return True
        except Exception as e:
            print(f"❌ خطأ في حفظ الإعدادات: {e}")
            return False
    
    def get(self, key: str, default=None):
        """الحصول على قيمة إعداد"""
        return self.config.get(key, default)
    
    def set(self, key: str, value):
        """تعيين قيمة إعداد"""
        self.config[key] = value
        self.save_config(self.config)


def find_vosk_model(model_name: str = "vosk-model-ar") -> Optional[str]:
    """البحث عن نموذج Vosk"""
    possible_paths = [
        os.path.join("models", model_name),
        os.path.join("..", "models", model_name),
        os.path.join(os.path.dirname(__file__), "models", model_name),
        model_name,
    ]
    
    for path in possible_paths:
        if os.path.exists(path) and os.path.isdir(path):
            return os.path.abspath(path)
    
    return None


def download_vosk_model_info():
    """معلومات تحميل نموذج Vosk"""
    print("\n📥 معلومات تحميل نموذج Vosk:")
    print("=" * 60)
    print("1. اذهب إلى: https://alphacephei.com/vosk/models")
    print("2. حمّل النموذج العربي: vosk-model-ar-0.22")
    print("3. ضع الملف المضغوط في مجلد 'models'")
    print("4. فك الضغط عن الملف")
    print("5. يجب أن يكون المجلد كالتالي: models/vosk-model-ar-0.22/")
    print("=" * 60)


def check_dependencies() -> dict:
    """التحقق من المكتبات المثبتة"""
    dependencies = {
        "whisper": False,
        "vosk": False,
        "keyboard": False,
        "pyautogui": False,
        "customtkinter": False,
        "pyaudio": False,
    }
    
    # التحقق من Whisper
    try:
        import whisper
        # التحقق من أن whisper هو openai-whisper وليس whisper.py القديم
        if hasattr(whisper, 'load_model'):
            dependencies["whisper"] = True
        else:
            dependencies["whisper"] = False
    except (ImportError, TypeError, AttributeError):
        dependencies["whisper"] = False
    
    # التحقق من Vosk
    try:
        from vosk import Model
        dependencies["vosk"] = True
    except ImportError:
        pass
    
    # التحقق من keyboard
    try:
        import keyboard
        dependencies["keyboard"] = True
    except ImportError:
        pass
    
    # التحقق من pyautogui
    try:
        import pyautogui
        dependencies["pyautogui"] = True
    except ImportError:
        pass
    
    # التحقق من customtkinter
    try:
        import customtkinter
        dependencies["customtkinter"] = True
    except ImportError:
        pass
    
    # التحقق من pyaudio
    try:
        import pyaudio
        dependencies["pyaudio"] = True
    except ImportError:
        pass
    
    return dependencies


def print_dependency_status():
    """طباعة حالة المكتبات"""
    deps = check_dependencies()
    
    print("\n📦 حالة المكتبات:")
    print("=" * 60)
    
    # محركات التعرف على الصوت
    print("\n🎤 محركات التعرف على الصوت:")
    if deps["whisper"]:
        print("  ✅ Whisper - متاح")
    else:
        print("  ❌ Whisper - غير متاح (pip install openai-whisper)")
    
    if deps["vosk"]:
        print("  ✅ Vosk - متاح")
    else:
        print("  ❌ Vosk - غير متاح (pip install vosk)")
    
    # أنظمة الكتابة
    print("\n⌨️ أنظمة الكتابة:")
    if deps["keyboard"]:
        print("  ✅ keyboard - متاح")
    else:
        print("  ❌ keyboard - غير متاح (pip install keyboard)")
    
    if deps["pyautogui"]:
        print("  ✅ pyautogui - متاح")
    else:
        print("  ❌ pyautogui - غير متاح (pip install pyautogui)")
    
    # الواجهة
    print("\n🎨 الواجهة:")
    if deps["customtkinter"]:
        print("  ✅ customtkinter - متاح")
    else:
        print("  ⚠️ customtkinter - غير متاح (سيستخدم tkinter العادي)")
    
    # الصوت
    print("\n🎙️ الصوت:")
    if deps["pyaudio"]:
        print("  ✅ PyAudio - متاح")
    else:
        print("  ❌ PyAudio - غير متاح (pip install PyAudio)")
    
    print("=" * 60)
    
    # توصيات
    if not deps["whisper"] and not deps["vosk"]:
        print("\n⚠️ تحذير: لا يوجد محرك تعرف على الصوت!")
        print("   يجب تثبيت Whisper أو Vosk على الأقل")
    
    if not deps["keyboard"] and not deps["pyautogui"]:
        print("\n⚠️ تحذير: لا يوجد نظام كتابة!")
        print("   يجب تثبيت keyboard أو pyautogui على الأقل")


if __name__ == "__main__":
    # اختبار الوظائف
    print("🧪 اختبار وظائف مساعدة")
    print("=" * 60)
    
    print_dependency_status()
    
    print("\n" + "=" * 60)
    print("📝 اختبار مدير السجل:")
    manager = HistoryManager("test_history.db")
    manager.save_text("هذا نص تجريبي")
    history = manager.get_history(5)
    print(f"✅ تم حفظ {len(history)} سجل")
    
    # تنظيف
    os.remove("test_history.db")

