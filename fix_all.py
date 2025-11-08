#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
سكريبت إصلاح تلقائي لبرنامج Voice Typing Advanced
يقوم بفحص وتثبيت المكتبات المفقودة تلقائياً
"""

import subprocess
import sys
import os

def print_header(text):
    """طباعة رأس مميز"""
    print("\n" + "=" * 60)
    print(f"  {text}")
    print("=" * 60 + "\n")

def check_package(package_name, import_name=None):
    """
    فحص إذا كانت المكتبة مثبتة
    
    Args:
        package_name: اسم المكتبة في pip
        import_name: اسم المكتبة عند الاستيراد (إذا كان مختلفاً)
    """
    if import_name is None:
        import_name = package_name.replace('-', '_')
    
    try:
        __import__(import_name)
        return True
    except ImportError:
        return False

def install_package(package_name):
    """تثبيت مكتبة باستخدام pip"""
    try:
        print(f"📦 جاري تثبيت {package_name}...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", package_name, "--break-system-packages"])
        print(f"✅ تم تثبيت {package_name} بنجاح!")
        return True
    except subprocess.CalledProcessError:
        # محاولة بدون --break-system-packages
        try:
            subprocess.check_call([sys.executable, "-m", "pip", "install", package_name])
            print(f"✅ تم تثبيت {package_name} بنجاح!")
            return True
        except subprocess.CalledProcessError:
            print(f"❌ فشل في تثبيت {package_name}")
            return False

def main():
    """الدالة الرئيسية"""
    print_header("🔧 سكريبت الإصلاح التلقائي - Voice Typing Advanced")
    
    print(f"📍 إصدار Python: {sys.version}")
    print(f"📍 مسار Python: {sys.executable}")
    
    # قائمة المكتبات المطلوبة
    packages = [
        ("numpy", "numpy", True),  # (pip_name, import_name, critical)
        ("Pillow", "PIL", False),
        ("SpeechRecognition", "speech_recognition", True),
        ("PyAudio", "pyaudio", True),
        ("keyboard", "keyboard", True),
        ("pyautogui", "pyautogui", False),
        ("pyperclip", "pyperclip", False),
        ("customtkinter", "customtkinter", False),
        ("vosk", "vosk", False),
    ]
    
    print_header("📋 فحص المكتبات المثبتة")
    
    missing_packages = []
    installed_packages = []
    
    for pip_name, import_name, critical in packages:
        status = "🔴 حرجة" if critical else "🟡 اختيارية"
        if check_package(pip_name, import_name):
            print(f"✅ {pip_name:20s} - مثبتة")
            installed_packages.append(pip_name)
        else:
            print(f"❌ {pip_name:20s} - غير مثبتة [{status}]")
            missing_packages.append((pip_name, critical))
    
    if not missing_packages:
        print_header("🎉 جميع المكتبات مثبتة!")
        print("✅ البرنامج جاهز للاستخدام")
        return True
    
    print_header("📦 المكتبات المفقودة")
    print(f"وجدنا {len(missing_packages)} مكتبة غير مثبتة\n")
    
    # فصل المكتبات الحرجة والاختيارية
    critical_missing = [p for p, c in missing_packages if c]
    optional_missing = [p for p, c in missing_packages if not c]
    
    if critical_missing:
        print("🔴 مكتبات حرجة (يجب تثبيتها):")
        for pkg in critical_missing:
            print(f"   - {pkg}")
    
    if optional_missing:
        print("\n🟡 مكتبات اختيارية (موصى بها):")
        for pkg in optional_missing:
            print(f"   - {pkg}")
    
    print("\n" + "=" * 60)
    response = input("هل تريد تثبيت المكتبات المفقودة؟ (y/n): ").lower()
    
    if response not in ['y', 'yes', 'نعم', 'ن']:
        print("❌ تم إلغاء التثبيت")
        return False
    
    print_header("🚀 بدء التثبيت")
    
    # تحديث pip أولاً
    print("📦 تحديث pip...")
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "--upgrade", "pip"])
        print("✅ تم تحديث pip بنجاح\n")
    except:
        print("⚠️ فشل في تحديث pip، المتابعة...\n")
    
    # تثبيت المكتبات
    installed_count = 0
    failed_count = 0
    
    for package, critical in missing_packages:
        if install_package(package):
            installed_count += 1
        else:
            failed_count += 1
            if critical:
                print(f"⚠️ تحذير: {package} مكتبة حرجة وفشل تثبيتها!")
    
    print_header("📊 نتيجة التثبيت")
    print(f"✅ تم تثبيت: {installed_count} مكتبة")
    print(f"❌ فشل التثبيت: {failed_count} مكتبة")
    
    # فحص نهائي
    print_header("🔍 الفحص النهائي")
    
    all_good = True
    for pip_name, import_name, critical in packages:
        if check_package(pip_name, import_name):
            print(f"✅ {pip_name}")
        else:
            print(f"❌ {pip_name}")
            if critical:
                all_good = False
    
    print_header("🎯 النتيجة النهائية")
    
    if all_good:
        print("✅ جميع المكتبات الحرجة مثبتة بنجاح!")
        print("🎉 البرنامج جاهز للاستخدام")
        print("\n💡 لتشغيل البرنامج:")
        print("   python main_advanced.py")
        return True
    else:
        print("⚠️ بعض المكتبات الحرجة ما زالت مفقودة")
        print("\n💡 حلول مقترحة:")
        print("1. حاول تشغيل السكريبت كـ Administrator/sudo")
        print("2. ثبّت المكتبات يدوياً:")
        for pip_name, import_name, critical in packages:
            if critical and not check_package(pip_name, import_name):
                print(f"   pip install {pip_name}")
        print("3. استخدم virtual environment:")
        print("   python -m venv venv")
        print("   source venv/bin/activate  # Linux/Mac")
        print("   venv\\Scripts\\activate    # Windows")
        print("   pip install -r requirements_advanced.txt")
        return False

def check_pyaudio_special():
    """فحص خاص لـ PyAudio - تعليمات حسب نظام التشغيل"""
    if not check_package("pyaudio"):
        print_header("⚠️ تنبيه خاص: PyAudio")
        print("PyAudio يحتاج إلى خطوات إضافية حسب نظام التشغيل:\n")
        
        import platform
        system = platform.system()
        
        if system == "Windows":
            print("📌 Windows:")
            print("   pip install pipwin")
            print("   pipwin install pyaudio")
        elif system == "Linux":
            print("📌 Linux:")
            print("   sudo apt-get install portaudio19-dev python3-pyaudio")
            print("   pip install PyAudio")
        elif system == "Darwin":
            print("📌 macOS:")
            print("   brew install portaudio")
            print("   pip install PyAudio")
        
        print("\nأو جرب:")
        print("   pip install PyAudio")

def check_vosk_model():
    """فحص وجود نماذج Vosk"""
    print_header("🔍 فحص نماذج Vosk")
    
    models_dir = os.path.join(os.path.dirname(__file__), "models")
    
    if not os.path.exists(models_dir):
        print("⚠️ مجلد models غير موجود")
        print("💡 أنشئ المجلد: mkdir models")
        return False
    
    # البحث عن نماذج
    found_models = []
    for item in os.listdir(models_dir):
        if item.startswith("vosk-model"):
            found_models.append(item)
    
    if found_models:
        print(f"✅ وجدنا {len(found_models)} نموذج:")
        for model in found_models:
            print(f"   - {model}")
        return True
    else:
        print("⚠️ لم نجد أي نماذج Vosk")
        print("\n💡 لتحميل النموذج العربي:")
        print("1. اذهب إلى: https://alphacephei.com/vosk/models")
        print("2. حمّل: vosk-model-ar-0.22-linto-1.1.0.zip")
        print("3. فك الضغط في مجلد models/")
        return False

if __name__ == "__main__":
    try:
        success = main()
        
        # فحوصات إضافية
        print("\n")
        check_pyaudio_special()
        
        if check_package("vosk"):
            print("\n")
            check_vosk_model()
        
        print("\n" + "=" * 60)
        if success:
            print("✅ الإصلاح مكتمل!")
        else:
            print("⚠️ الإصلاح مكتمل جزئياً - راجع الملاحظات أعلاه")
        print("=" * 60)
        
        input("\nاضغط Enter للخروج...")
        
    except KeyboardInterrupt:
        print("\n\n❌ تم إلغاء السكريبت")
    except Exception as e:
        print(f"\n\n❌ خطأ غير متوقع: {e}")
        import traceback
        traceback.print_exc()
        input("\nاضغط Enter للخروج...")
