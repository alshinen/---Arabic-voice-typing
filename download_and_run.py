#!/usr/bin/env python3
"""
تحميل النموذج الكامل وتشغيل البرنامج
"""

import sys
import os

print("🔄 جاري تحميل نموذج Whisper...")
print("=" * 60)
print("⚠️ هذه العملية قد تستغرق بضع دقائق في المرة الأولى")
print("📦 سيتم تحميل نموذج 'base' (متوازن بين السرعة والدقة)")
print("=" * 60)

try:
    import whisper
    # التحقق من أن whisper هو openai-whisper وليس whisper.py القديم
    if not hasattr(whisper, 'load_model'):
        print("\n❌ whisper.py القديم مثبت (غير متوافق)")
        print("💡 الحل:")
        print("   1. pip uninstall whisper")
        print("   2. pip install openai-whisper")
        raise ImportError("whisper غير متوافق")
    
    print("\n✅ Whisper مثبت!")
    print("📥 جاري تحميل النموذج...")
    
    # تحميل النموذج - سيحمل تلقائياً عند أول استخدام
    model = whisper.load_model("base")
    
    print("✅ تم تحميل النموذج بنجاح!")
    try:
        # محاولة عرض موقع النموذج
        import torch.hub as hub
        cache_dir = hub.get_dir()
        print(f"📍 النماذج محفوظة في: {cache_dir}")
    except:
        pass
    
    print("\n" + "=" * 60)
    print("🚀 جاري تشغيل البرنامج...")
    print("=" * 60)
    
    # تشغيل البرنامج الرئيسي
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from main_advanced import VoiceTypingApp
    
    app = VoiceTypingApp()
    # التحقق من الواجهة فقط (recognizer و typer سيتم تحميلهما عند الحاجة)
    if app.gui:
        app.run()
    else:
        print("\n❌ فشل في تهيئة الواجهة")
        input("\nاضغط Enter للخروج...")
        
except KeyboardInterrupt:
    print("\n\n⏹️ تم إيقاف البرنامج")
except Exception as e:
    print(f"\n❌ خطأ: {e}")
    import traceback
    traceback.print_exc()
    input("\nاضغط Enter للخروج...")

