#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
البرنامج الرئيسي المحسّن - تحويل الكلام إلى نص
النسخة المحسنة مع Logging + Type Hints + Better Error Handling
"""

import sys
import os
import logging
from datetime import datetime
from typing import Optional, List
import traceback as tb

# ============================================================
# 1. التحقق من الملفات المطلوبة أولاً (قبل أي شيء)
# ============================================================
REQUIRED_FILES = [
    'speech_recognizer.py',
    'auto_typer.py',
    'gui.py',
    'model_manager.py'
]

for file in REQUIRED_FILES:
    if not os.path.exists(file):
        print(f"❌ خطأ حرج: ملف '{file}' غير موجود!")
        print("💡 تأكد من أن جميع ملفات البرنامج في نفس المجلد")
        input("\nاضغط Enter للخروج...")
        sys.exit(1)

# ============================================================
# 2. إعداد الترميز لـ Windows
# ============================================================
if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except:
        import io
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

# ============================================================
# 3. إضافة المسار الحالي للـ path
# ============================================================
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# ============================================================
# 4. استيراد المكونات (بعد التأكد من وجود الملفات)
# ============================================================
from speech_recognizer import SpeechRecognizer
from auto_typer import AutoTyper
from gui import VoiceTypingGUI
from model_manager import ModelManager

# استيراد الإعدادات
try:
    import config
    CONFIG_AVAILABLE = True
except ImportError:
    CONFIG_AVAILABLE = False
    config = None

# استيراد المصحح الإملائي
try:
    from spell_checker import SpellChecker, is_spell_checker_available
    SPELL_CHECKER_AVAILABLE = is_spell_checker_available()
except ImportError:
    SPELL_CHECKER_AVAILABLE = False
    SpellChecker = None
    logging.warning("⚠️ مكتبة المصحح الإملائي غير مثبتة")


# ============================================================
# 5. البرنامج الرئيسي المحسّن
# ============================================================
class VoiceTypingApp:
    """البرنامج الرئيسي المتكامل لتحويل الكلام إلى نص"""
    
    # ثوابت البرنامج (من config.py إن وُجد)
    TYPING_DELAY = config.TYPING_DELAY if CONFIG_AVAILABLE else 0.01
    VERSION = "2.0.1"
    DEFAULT_LANGUAGE = config.LANGUAGE if CONFIG_AVAILABLE else 'ar'
    DEFAULT_ENGINE = config.RECOGNITION_ENGINE if CONFIG_AVAILABLE else 'vosk'
    
    def __init__(self, debug: bool = False):
        """تهيئة البرنامج
        
        Args:
            debug: تفعيل وضع التصحيح (مزيد من التفاصيل)
        """
        self.debug = debug
        self._setup_logging()
        
        # المكونات الرئيسية
        self.recognizer: Optional[SpeechRecognizer] = None
        self.typer: Optional[AutoTyper] = None
        self.gui: Optional[VoiceTypingGUI] = None
        self.model_manager: Optional[ModelManager] = None
        self.spell_checker: Optional[SpellChecker] = None
        
        logging.info(f"🚀 بدء تحميل برنامج الكتابة بالصوت v{self.VERSION}")
        logging.info("=" * 60)
        
        # تهيئة المكونات
        self.init_components()
    
    def _setup_logging(self):
        """إعداد نظام تسجيل الأحداث"""
        # إنشاء مجلد logs
        os.makedirs('logs', exist_ok=True)
        
        # اسم ملف السجل
        log_filename = f'logs/voice_typing_{datetime.now().strftime("%Y%m%d")}.log'
        
        # المستوى المناسب
        level = logging.DEBUG if self.debug else logging.INFO
        
        # تكوين النظام
        logging.basicConfig(
            level=level,
            format='%(asctime)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler(log_filename, encoding='utf-8'),
                logging.StreamHandler(sys.stdout)
            ]
        )
        
        if self.debug:
            logging.debug("🐛 وضع التصحيح مفعّل")
            logging.debug(f"Python: {sys.version}")
            logging.debug(f"Platform: {sys.platform}")
    
    def init_components(self) -> bool:
        """تهيئة مكونات البرنامج
        
        Returns:
            True إذا نجحت التهيئة، False otherwise
        """
        try:
            # 1. تهيئة مدير النماذج
            logging.info("📦 جاري تهيئة مدير النماذج...")
            try:
                self.model_manager = ModelManager()
                logging.info(f"✅ مجلد النماذج: {self.model_manager.models_dir}")
                
                available = self.model_manager.get_available_languages()
                if available:
                    logging.info(f"✅ النماذج المتاحة: {', '.join(available)}")
                else:
                    logging.warning("⚠️ لا توجد نماذج محملة")
            except Exception as e:
                logging.error(f"خطأ في تهيئة مدير النماذج: {e}", exc_info=self.debug)
                self._save_error_details(e, "ModelManager Initialization")
                self.model_manager = None
            
            # 2. تحضير محرك التعرف (Lazy Loading)
            logging.info("📡 جاري تحضير محرك التعرف على الصوت...")
            
            # لا نحمّل النموذج الآن - سيتم تحميله عند الحاجة
            model_path = None
            if self.model_manager:
                model_path = self.model_manager.get_model_path('ar')
            
            if model_path and os.path.exists(model_path):
                logging.info(f"✅ تم العثور على نموذج Vosk في: {model_path}")
                logging.info("💡 سيتم تحميل النموذج عند بدء التسجيل")
            else:
                logging.warning("⚠️ نموذج Vosk العربي غير محمل")
            
            # 3. تهيئة المصحح الإملائي
            logging.info("📝 جاري تهيئة المصحح الإملائي...")
            if SPELL_CHECKER_AVAILABLE and SpellChecker:
                try:
                    self.spell_checker = SpellChecker(language=self.DEFAULT_LANGUAGE, auto_correct=True)
                    logging.info(f"✅ تم تهيئة المصحح الإملائي للغة: {self.DEFAULT_LANGUAGE}")
                except Exception as e:
                    logging.warning(f"⚠️ فشل تهيئة المصحح الإملائي: {e}")
                    self.spell_checker = None
            else:
                logging.info("⚠️ المصحح الإملائي غير متاح")
                self.spell_checker = None
            
            # 4. تهيئة نظام الكتابة
            logging.info("⌨️ جاري تهيئة نظام الكتابة...")
            try:
                self.typer = AutoTyper(method='keyboard', delay=self.TYPING_DELAY)
                logging.info(f"✅ تم تهيئة نظام الكتابة (delay={self.TYPING_DELAY}s)")
            except Exception as e:
                logging.warning(f"⚠️ فشل keyboard، محاولة pyautogui...")
                try:
                    self.typer = AutoTyper(method='pyautogui', delay=self.TYPING_DELAY)
                    logging.info("✅ تم استخدام pyautogui")
                except Exception as e2:
                    logging.error(f"❌ فشل تهيئة نظام الكتابة: {e2}", exc_info=self.debug)
                    self._save_error_details(e2, "AutoTyper Initialization")
                    self.typer = None
            
            # 5. تهيئة الواجهة الرسومية
            logging.info("🎨 جاري تحميل الواجهة الرسومية...")
            try:
                self.gui = VoiceTypingGUI(
                    self.recognizer,
                    self.typer,
                    self.model_manager,
                    self.spell_checker
                )
                logging.info("✅ تم تحميل الواجهة بنجاح!")
                
                if hasattr(self.gui, 'root'):
                    self.gui.root.update_idletasks()
                    
            except Exception as e:
                logging.error(f"❌ خطأ في تحميل الواجهة: {e}", exc_info=True)
                self._save_error_details(e, "GUI Initialization")
                
                # محاولة واجهة بسيطة
                logging.info("🔄 محاولة إنشاء واجهة بسيطة...")
                try:
                    self.gui = VoiceTypingGUI(None, None, None)
                    logging.info("✅ تم إنشاء واجهة بسيطة")
                except Exception as e2:
                    logging.error(f"❌ فشل إنشاء الواجهة: {e2}", exc_info=True)
                    self.gui = None
                    return False
            
            logging.info("=" * 60)
            logging.info("🎉 تم تحميل البرنامج بنجاح!")
            logging.info("=" * 60)
            return True
            
        except Exception as e:
            logging.critical(f"خطأ حرج في التهيئة: {e}", exc_info=True)
            self._save_error_details(e, "Critical Initialization Error")
            return False
    
    def load_recognizer(self, model_type: str = 'vosk', language: str = 'ar') -> bool:
        """تحميل محرك التعرف عند الحاجة (Lazy Loading)
        
        Args:
            model_type: نوع المحرك ('vosk', 'whisper', 'google')
            language: رمز اللغة ('ar', 'en', إلخ)
            
        Returns:
            True إذا نجح التحميل
        """
        try:
            logging.info(f"🔄 جاري تحميل محرك {model_type} للغة {language}...")
            
            model_path = None
            if self.model_manager:
                model_path = self.model_manager.get_model_path(language)
            
            if not model_path and model_type == 'vosk':
                logging.error(f"❌ نموذج {language} غير موجود")
                return False
            
            self.recognizer = SpeechRecognizer(
                engine=model_type,
                model_path=model_path,
                language=language
            )
            
            logging.info(f"✅ تم تحميل محرك {model_type}")
            return True
            
        except Exception as e:
            logging.error(f"❌ خطأ في تحميل المحرك: {e}", exc_info=True)
            self._save_error_details(e, f"Load Recognizer ({model_type})")
            return False
    
    def _save_error_details(self, error: Exception, context: str):
        """حفظ تفاصيل الخطأ في ملف منفصل
        
        Args:
            error: الخطأ المُلتقط
            context: سياق الخطأ (أين حدث)
        """
        try:
            os.makedirs('logs', exist_ok=True)
            error_file = 'logs/error_details.log'
            
            with open(error_file, 'a', encoding='utf-8') as f:
                f.write(f"\n{'=' * 60}\n")
                f.write(f"⏰ التوقيت: {datetime.now()}\n")
                f.write(f"📍 السياق: {context}\n")
                f.write(f"❌ الخطأ: {str(error)}\n")
                f.write(f"📋 التفاصيل:\n")
                f.write(tb.format_exc())
                f.write(f"\n{'=' * 60}\n")
            
            logging.info(f"📄 تفاصيل الخطأ محفوظة في {error_file}")
            
        except Exception as save_error:
            logging.error(f"فشل حفظ تفاصيل الخطأ: {save_error}")
    
    def run(self):
        """تشغيل البرنامج"""
        if not self.gui:
            logging.error("❌ فشل في تهيئة الواجهة")
            return
        
        try:
            logging.info("📱 جاري فتح الواجهة...")
            self.gui.run()
            
        except KeyboardInterrupt:
            logging.info("⏹️ تم إيقاف البرنامج بواسطة المستخدم")
            
        except Exception as e:
            logging.error(f"خطأ في التشغيل: {e}", exc_info=True)
            self._save_error_details(e, "Runtime Error")
            
        finally:
            self.cleanup()
    
    def emergency_exit(self, reason: str = "خطأ حرج"):
        """إغلاق فوري في حال خطأ حرج
        
        Args:
            reason: سبب الإغلاق الطارئ
        """
        logging.critical(f"⚠️ إغلاق طارئ: {reason}")
        print(f"\n❌ إغلاق طارئ: {reason}")
        self.cleanup()
        sys.exit(1)
    
    def cleanup(self):
        """تنظيف الموارد بأمان"""
        logging.info("🧹 جاري تنظيف الموارد...")
        
        # إيقاف التسجيل
        if self.recognizer:
            try:
                self.recognizer.stop_recording()
                logging.debug("✅ تم إيقاف التسجيل")
            except Exception as e:
                logging.warning(f"خطأ في إيقاف التسجيل: {e}")
        
        # إغلاق الواجهة
        if self.gui and hasattr(self.gui, 'root'):
            try:
                self.gui.root.quit()
                logging.debug("✅ تم إغلاق الواجهة")
            except Exception as e:
                logging.warning(f"خطأ في إغلاق الواجهة: {e}")
        
        logging.info("✅ تم تنظيف الموارد")


# ============================================================
# 6. التحقق من التبعيات
# ============================================================
def check_dependencies() -> bool:
    """التحقق من تثبيت المكتبات الأساسية
    
    Returns:
        True إذا كانت جميع المكتبات مثبتة
    """
    deps = {
        'SpeechRecognition': 'speech_recognition',
        'PyAudio/sounddevice': None,  # سيتم فحصها بشكل خاص
        'customtkinter': 'customtkinter',
        'keyboard': 'keyboard',
        'vosk': 'vosk',
        'numpy': 'numpy',
        'googletrans': 'googletrans',  # للترجمة
        'gtts': 'gtts',  # للنطق
        'pyttsx3': 'pyttsx3',  # للنطق المحلي
        'language-tool-python': 'language_tool_python',  # المصحح الإملائي
    }
    
    missing = []
    optional_missing = []
    
    for pip_name, module_name in deps.items():
        # فحص خاص لـ PyAudio/sounddevice
        if module_name is None:
            try:
                __import__('pyaudio')
            except ImportError:
                try:
                    __import__('sounddevice')
                except ImportError:
                    missing.append(pip_name)
            continue
        
        # فحص المكتبات الأخرى
        try:
            __import__(module_name)
        except ImportError:
            # المكتبات الاختيارية (للترجمة والنطق والتصحيح)
            if pip_name in ['googletrans', 'gtts', 'pyttsx3', 'language-tool-python']:
                optional_missing.append(pip_name)
            else:
                missing.append(pip_name)
    
    # عرض المكتبات المفقودة الأساسية
    if missing:
        print("❌ المكتبات الأساسية المفقودة:")
        for lib in missing:
            print(f"   - {lib}")
        print(f"\n💡 نصّبها باستخدام:")
        print(f"   pip install {' '.join(missing)}")
        print("\nأو:")
        print("   pip install -r requirements_advanced.txt")
        return False
    
    # عرض المكتبات الاختيارية المفقودة (تحذير فقط)
    if optional_missing:
        print("⚠️ المكتبات الاختيارية المفقودة (للترجمة، النطق، والتصحيح):")
        for lib in optional_missing:
            print(f"   - {lib}")
        print("💡 يمكنك تثبيتها لاحقاً لتفعيل ميزات إضافية")
        print(f"   pip install {' '.join(optional_missing)}\n")
    
    return True


# ============================================================
# 7. الدالة الرئيسية
# ============================================================
def main():
    """الدالة الرئيسية"""
    print("\n" + "=" * 60)
    print("🎤 برنامج تحويل الكلام إلى نص (النسخة المحسّنة)")
    print("=" * 60)
    print()
    
    # التحقق من التبعيات
    if not check_dependencies():
        input("\nاضغط Enter للخروج...")
        sys.exit(1)
    
    # فحص معامل --debug
    debug_mode = len(sys.argv) > 1 and sys.argv[1] == '--debug'
    
    if debug_mode:
        print("🐛 وضع التصحيح مفعّل (--debug)")
    
    try:
        app = VoiceTypingApp(debug=debug_mode)
        
        if app.gui:
            app.run()
            sys.exit(0)  # إغلاق نظيف
        else:
            print("❌ فشل تهيئة البرنامج. تحقق من ملفات السجل (logs/)")
            input("\nاضغط Enter للخروج...")
            sys.exit(1)
            
    except KeyboardInterrupt:
        print("\n⏹️ تم إيقاف البرنامج")
        sys.exit(0)  # إغلاق نظيف
        
    except Exception as e:
        print(f"❌ خطأ عام: {e}")
        logging.error("خطأ غير متوقع", exc_info=True)
        
        # حفظ تفاصيل الخطأ
        try:
            with open('logs/critical_error.log', 'a', encoding='utf-8') as f:
                f.write(f"\n{'=' * 60}\n")
                f.write(f"{datetime.now()}\n")
                f.write(tb.format_exc())
        except:
            pass
        
        input("\nاضغط Enter للخروج...")
        sys.exit(1)


if __name__ == "__main__":
    main()
