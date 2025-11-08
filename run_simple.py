#!/usr/bin/env python3
"""
تشغيل بسيط للبرنامج مع عرض الأخطاء
"""

import sys
import os
import traceback

# إضافة المسار الحالي
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

print("🚀 بدء تشغيل برنامج الكتابة بالصوت...")
print("=" * 60)

try:
    print("\n📦 التحقق من المكتبات...")
    
    # التحقق من المكتبات الأساسية
    try:
        import pyaudio
        print("✅ PyAudio - متاح")
    except ImportError:
        print("❌ PyAudio - غير متاح (pip install PyAudio)")
        print("   أو على Windows: pip install pipwin && pipwin install pyaudio")
    
    try:
        import keyboard
        print("✅ keyboard - متاح")
    except ImportError:
        print("⚠️ keyboard - غير متاح")
        try:
            import pyautogui
            print("✅ pyautogui - متاح (سيستخدم كبديل)")
        except ImportError:
            print("❌ pyautogui - غير متاح أيضاً!")
    
    try:
        import customtkinter
        print("✅ customtkinter - متاح")
    except ImportError:
        print("⚠️ customtkinter - غير متاح (سيستخدم tkinter العادي)")
    
    print("\n🎤 التحقق من محركات التعرف...")
    
    whisper_ok = False
    vosk_ok = False
    
    try:
        # محاولة استيراد openai-whisper (الصحيح)
        try:
            import whisper
            # التحقق من أن whisper يعمل بالفعل
            if hasattr(whisper, 'load_model'):
                print("✅ Whisper - متاح")
                whisper_ok = True
            else:
                raise ImportError("Whisper غير متوافق")
        except (ImportError, TypeError, AttributeError) as e:
            # إذا فشل، جرب openai-whisper
            try:
                import whisper as whisper_module
                print("✅ Whisper - متاح (openai-whisper)")
                whisper_ok = True
            except:
                raise ImportError("Whisper غير متاح")
    except (ImportError, TypeError, AttributeError) as e:
        print(f"⚠️ Whisper - غير متاح أو غير متوافق: {type(e).__name__}")
        print("   الحل: pip install openai-whisper")
        print("   أو استخدم Vosk بدلاً من ذلك")
    
    try:
        from vosk import Model
        print("✅ Vosk - متاح")
        vosk_ok = True
    except ImportError:
        print("⚠️ Vosk - غير متاح (pip install vosk)")
    
    if not whisper_ok and not vosk_ok:
        print("\n❌ لا يوجد محرك تعرف على الصوت متاح!")
        print("   يجب تثبيت Whisper أو Vosk على الأقل")
        input("\nاضغط Enter للخروج...")
        sys.exit(1)
    
    print("\n✅ المكتبات الأساسية جاهزة!")
    print("\n🔄 جاري تحميل البرنامج...")
    print("=" * 60)
    
    # تحميل البرنامج
    from main_advanced import VoiceTypingApp
    
    app = VoiceTypingApp()
    
    # التحقق من الواجهة فقط (recognizer و typer سيتم تحميلهما عند الحاجة)
    if app.gui:
        print("\n✅ تم تحميل البرنامج بنجاح!")
        print("📱 جاري فتح الواجهة...")
        print("=" * 60)
        app.run()
    else:
        print("\n❌ فشل في تهيئة الواجهة")
        input("\nاضغط Enter للخروج...")
        
except KeyboardInterrupt:
    print("\n\n⏹️ تم إيقاف البرنامج بواسطة المستخدم")
except Exception as e:
    print(f"\n❌ خطأ في تشغيل البرنامج: {e}")
    print("\n📋 تفاصيل الخطأ:")
    traceback.print_exc()
    input("\nاضغط Enter للخروج...")

