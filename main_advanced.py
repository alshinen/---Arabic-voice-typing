#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
البرنامج الرئيسي - تحويل الكلام إلى نص (نسخة متقدمة)
يعمل بدون إنترنت باستخدام Vosk أو Whisper
"""

import sys
import os

# إعداد الترميز لـ Windows
if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except:
        # إذا فشل، استخدم طريقة بديلة
        import io
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

# إضافة المسار الحالي للـ path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from speech_recognizer import SpeechRecognizer
from auto_typer import AutoTyper
from gui import VoiceTypingGUI
from model_manager import ModelManager


class VoiceTypingApp:
    """البرنامج الرئيسي المتكامل"""
    
    def __init__(self):
        """تهيئة البرنامج"""
        print("🚀 بدء تحميل برنامج الكتابة بالصوت...")
        print("=" * 60)
        
        self.recognizer = None
        self.typer = None
        self.gui = None
        self.model_manager = None
        
        # تهيئة المكونات
        self.init_components()
        
    def init_components(self):
        """تهيئة مكونات البرنامج"""
        
        print("\n📦 جاري تهيئة مدير النماذج...")
        try:
            self.model_manager = ModelManager()
            print(f"✅ مجلد النماذج: {self.model_manager.models_dir}")
            
            available = self.model_manager.get_available_languages()
            if available:
                print(f"✅ النماذج المتاحة: {', '.join(available)}")
            else:
                print("⚠️ لا توجد نماذج محملة. استخدم زر 'تحميل' في الواجهة لتحميل النماذج")
        except Exception as e:
            print(f"⚠️ خطأ في تهيئة مدير النماذج: {e}")
            self.model_manager = None
        
        # 1. تهيئة محرك التعرف على الصوت (سيتم تحميله في الخلفية)
        print("\n📡 جاري تحضير محرك التعرف على الصوت...")
        
        # لا نحمل النموذج الآن - سيتم تحميله عند الضغط على زر "ابدأ التسجيل"
        # هذا يسرع فتح الواجهة بشكل كبير
        self.recognizer = None
        
        # فقط نتحقق من وجود النموذج
        model_path = None
        if self.model_manager:
            model_path = self.model_manager.get_model_path('ar')
        
        if model_path and os.path.exists(model_path):
            print(f"✅ تم العثور على نموذج Vosk في: {model_path}")
            print("💡 سيتم تحميل النموذج عند بدء التسجيل")
        else:
            print("⚠️ نموذج Vosk العربي غير محمل")
            print("💡 يمكنك استخدام Google Speech Recognition (يحتاج إنترنت)")
            print("💡 أو تحميل نموذج Vosk من زر 'تحميل' في الواجهة")
        
        # 2. تهيئة نظام الكتابة (محسّن للسرعة)
        print("\n⌨️ جاري تهيئة نظام الكتابة...")
        try:
            self.typer = AutoTyper(method='keyboard', delay=0.003)  # محسّن ولكن آمن - 0.003 أفضل من 0.001
            print("✅ تم تهيئة نظام الكتابة بنجاح! (محسّن للسرعة)")
        except Exception as e:
            print(f"⚠️ خطأ في تهيئة نظام الكتابة: {e}")
            print("🔄 محاولة استخدام pyautogui...")
            try:
                self.typer = AutoTyper(method='pyautogui', delay=0.003)  # محسّن ولكن آمن
                print("✅ تم استخدام pyautogui! (محسّن للسرعة)")
            except Exception as e2:
                print(f"⚠️ خطأ في تهيئة نظام الكتابة: {e2}")
                print("\n💡 تأكد من تثبيت: pip install keyboard أو pyautogui")
                # لا نوقف البرنامج - يمكن أن يعمل بدون typer
                self.typer = None
        
        # 3. تهيئة الواجهة الرسومية
        print("\n🎨 جاري تحميل الواجهة الرسومية...")
        try:
            self.gui = VoiceTypingGUI(self.recognizer, self.typer, self.model_manager)
            print("✅ تم تحميل الواجهة بنجاح!")
            # التأكد من أن النافذة جاهزة
            if hasattr(self.gui, 'root'):
                self.gui.root.update_idletasks()
        except Exception as e:
            print(f"❌ خطأ في تحميل الواجهة: {e}")
            import traceback
            traceback.print_exc()
            # محاولة إنشاء واجهة بسيطة بدون مكونات
            try:
                print("🔄 محاولة إنشاء واجهة بسيطة...")
                self.gui = VoiceTypingGUI(None, None, None)
                print("✅ تم إنشاء واجهة بسيطة")
            except Exception as e2:
                print(f"❌ فشل إنشاء الواجهة: {e2}")
                return False
        
        print("\n" + "=" * 60)
        print("🎉 تم تحميل البرنامج بنجاح!")
        print("=" * 60)
        return True
    
    def run(self):
        """تشغيل البرنامج"""
        if not self.gui:
            print("❌ فشل في تهيئة البرنامج")
            return
        
        try:
            print("\n📱 جاري فتح الواجهة...")
            self.gui.run()
        except KeyboardInterrupt:
            print("\n\n⏹️ تم إيقاف البرنامج بواسطة المستخدم")
        except Exception as e:
            print(f"\n❌ خطأ في تشغيل البرنامج: {e}")
            import traceback
            traceback.print_exc()
        finally:
            self.cleanup()
    
    def cleanup(self):
        """تنظيف الموارد"""
        print("\n🧹 جاري تنظيف الموارد...")
        
        if self.recognizer:
            try:
                self.recognizer.stop_recording()
            except:
                pass
        
        print("✅ تم تنظيف الموارد")


def main():
    """الدالة الرئيسية"""
    try:
        print("\n" + "=" * 60)
        print("🎤 برنامج تحويل الكلام إلى نص")
        print("=" * 60)
        print()
        
        app = VoiceTypingApp()
        
        # السماح بتشغيل البرنامج حتى لو لم يكن كل شيء جاهزاً
        if app.gui:
            print("\n✅ جاري فتح الواجهة...")
            try:
                app.run()
            except Exception as e:
                print(f"\n❌ خطأ في تشغيل الواجهة: {e}")
                import traceback
                traceback.print_exc()
                # محاولة فتح الواجهة بدون مكونات
                try:
                    print("\n🔄 محاولة فتح الواجهة بدون مكونات...")
                    from gui import VoiceTypingGUI
                    simple_gui = VoiceTypingGUI()
                    simple_gui.run()
                except Exception as e2:
                    print(f"\n❌ فشل فتح الواجهة: {e2}")
                    input("\nاضغط Enter للخروج...")
        else:
            print("\n❌ فشل في تهيئة الواجهة")
            print("\n💡 تأكد من:")
            print("   1. تثبيت جميع المكتبات: pip install customtkinter tkinter")
            print("   2. تثبيت المكتبات المطلوبة: pip install SpeechRecognition PyAudio keyboard")
            input("\nاضغط Enter للخروج...")
    except KeyboardInterrupt:
        print("\n\n⏹️ تم إيقاف البرنامج بواسطة المستخدم")
    except Exception as e:
        print(f"\n❌ خطأ عام: {e}")
        import traceback
        traceback.print_exc()
        print("\n💡 حاول تشغيل: pip install -r requirements_advanced.txt")
        input("\nاضغط Enter للخروج...")


if __name__ == "__main__":
    main()
