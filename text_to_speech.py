#!/usr/bin/env python3
"""
نظام تحويل النص إلى كلام (Text-to-Speech)
يدعم gtts (Google) و pyttsx3 (محلي)
"""

import os
import tempfile
import threading
from pathlib import Path

# محاولة استيراد المكتبات
try:
    from gtts import gTTS
    GTTS_AVAILABLE = True
except ImportError:
    GTTS_AVAILABLE = False
    print("⚠️ gtts غير متاح. للتثبيت: pip install gtts")

try:
    import pyttsx3
    PYTTSX3_AVAILABLE = True
except ImportError:
    PYTTSX3_AVAILABLE = False
    print("⚠️ pyttsx3 غير متاح. للتثبيت: pip install pyttsx3")

try:
    import pygame
    PYGAME_AVAILABLE = True
except ImportError:
    PYGAME_AVAILABLE = False
    print("⚠️ pygame غير متاح. للتثبيت: pip install pygame")


class TextToSpeech:
    """نظام تحويل النص إلى كلام"""
    
    def __init__(self, engine='gtts', lang='ar'):
        """
        تهيئة نظام TTS
        
        Args:
            engine: المحرك ('gtts' أو 'pyttsx3')
            lang: اللغة الافتراضية
        """
        self.engine = engine
        self.lang = lang
        self.is_speaking = False
        self.pyttsx3_engine = None
        
        # قاموس أكواد اللغات
        self.lang_codes = {
            'عربي': 'ar',
            'إنجليزي': 'en',
            'فرنسي': 'fr',
            'إسباني': 'es',
            'ألماني': 'de',
            'إيطالي': 'it',
            'برتغالي': 'pt',
            'صيني': 'zh',
            'ياباني': 'ja',
            'كوري': 'ko',
            'روسي': 'ru',
            'تركي': 'tr',
            'فارسي': 'fa',
            'هندي': 'hi',
            'فلبيني': 'tl'
        }
        
        # تهيئة محرك pyttsx3 إذا كان متاحاً
        if engine == 'pyttsx3' and PYTTSX3_AVAILABLE:
            try:
                self.pyttsx3_engine = pyttsx3.init()
                # إعدادات الصوت
                self.pyttsx3_engine.setProperty('rate', 150)  # سرعة الكلام
                self.pyttsx3_engine.setProperty('volume', 0.9)  # مستوى الصوت
            except Exception as e:
                print(f"❌ فشل تهيئة pyttsx3: {e}")
                self.pyttsx3_engine = None
        
        # تهيئة pygame للصوت
        if PYGAME_AVAILABLE:
            try:
                pygame.mixer.init()
            except Exception as e:
                print(f"⚠️ فشل تهيئة pygame: {e}")
    
    def speak(self, text, lang=None, blocking=False):
        """
        نطق النص
        
        Args:
            text: النص المراد نطقه
            lang: اللغة (اختياري - يستخدم اللغة الافتراضية إذا لم يُحدد)
            blocking: إذا كان True، ينتظر حتى ينتهي النطق
        """
        if not text or not text.strip():
            return False
        
        # استخدام اللغة المحددة أو الافتراضية
        target_lang = lang or self.lang
        
        # تحويل اسم اللغة إلى كود إذا لزم
        if target_lang in self.lang_codes:
            target_lang = self.lang_codes[target_lang]
        
        # اختيار المحرك المناسب
        if self.engine == 'gtts' and GTTS_AVAILABLE:
            return self._speak_with_gtts(text, target_lang, blocking)
        elif self.engine == 'pyttsx3' and PYTTSX3_AVAILABLE and self.pyttsx3_engine:
            return self._speak_with_pyttsx3(text, target_lang, blocking)
        else:
            print("❌ لا يوجد محرك TTS متاح!")
            return False
    
    def _speak_with_gtts(self, text, lang, blocking):
        """نطق باستخدام Google TTS"""
        try:
            # إنشاء ملف صوت مؤقت
            with tempfile.NamedTemporaryFile(delete=False, suffix='.mp3') as fp:
                temp_file = fp.name
            
            # توليد الصوت
            tts = gTTS(text=text, lang=lang, slow=False)
            tts.save(temp_file)
            
            # تشغيل الصوت
            if blocking:
                self._play_audio_file(temp_file, wait=True)
            else:
                # تشغيل في خيط منفصل
                thread = threading.Thread(
                    target=self._play_audio_file,
                    args=(temp_file, True),
                    daemon=True
                )
                thread.start()
            
            return True
            
        except Exception as e:
            print(f"❌ خطأ في gtts: {e}")
            return False
    
    def _speak_with_pyttsx3(self, text, lang, blocking):
        """نطق باستخدام pyttsx3 (محلي)"""
        try:
            if not self.pyttsx3_engine:
                return False
            
            # تعيين اللغة (pyttsx3 يستخدم أصوات النظام)
            # العربية قد لا تكون متاحة في جميع الأنظمة
            voices = self.pyttsx3_engine.getProperty('voices')
            
            # محاولة اختيار صوت مناسب للغة
            for voice in voices:
                if lang in voice.languages or lang in voice.id.lower():
                    self.pyttsx3_engine.setProperty('voice', voice.id)
                    break
            
            if blocking:
                self.pyttsx3_engine.say(text)
                self.pyttsx3_engine.runAndWait()
            else:
                # تشغيل في خيط منفصل
                thread = threading.Thread(
                    target=self._pyttsx3_speak_thread,
                    args=(text,),
                    daemon=True
                )
                thread.start()
            
            return True
            
        except Exception as e:
            print(f"❌ خطأ في pyttsx3: {e}")
            return False
    
    def _pyttsx3_speak_thread(self, text):
        """خيط منفصل لنطق pyttsx3"""
        try:
            self.pyttsx3_engine.say(text)
            self.pyttsx3_engine.runAndWait()
        except Exception as e:
            print(f"❌ خطأ في خيط pyttsx3: {e}")
    
    def _play_audio_file(self, file_path, wait=False):
        """تشغيل ملف صوتي"""
        try:
            if PYGAME_AVAILABLE:
                pygame.mixer.music.load(file_path)
                pygame.mixer.music.play()
                
                if wait:
                    while pygame.mixer.music.get_busy():
                        pygame.time.Clock().tick(10)
                
                # حذف الملف المؤقت بعد التشغيل
                if wait:
                    try:
                        os.remove(file_path)
                    except:
                        pass
            else:
                # استخدام os للتشغيل كحل بديل
                if os.name == 'nt':  # Windows
                    os.system(f'start /min "" "{file_path}"')
                elif os.name == 'posix':  # Linux/Mac
                    os.system(f'mpg123 "{file_path}" &')
        
        except Exception as e:
            print(f"❌ خطأ في تشغيل الصوت: {e}")
    
    def stop(self):
        """إيقاف النطق"""
        try:
            if PYGAME_AVAILABLE:
                pygame.mixer.music.stop()
            
            if self.pyttsx3_engine:
                self.pyttsx3_engine.stop()
        except Exception as e:
            print(f"⚠️ خطأ في إيقاف النطق: {e}")
    
    def set_language(self, lang):
        """تعيين اللغة الافتراضية"""
        if lang in self.lang_codes:
            self.lang = self.lang_codes[lang]
        else:
            self.lang = lang
    
    def set_engine(self, engine):
        """تغيير المحرك"""
        if engine in ['gtts', 'pyttsx3']:
            self.engine = engine
            
            # إعادة تهيئة pyttsx3 إذا لزم
            if engine == 'pyttsx3' and not self.pyttsx3_engine and PYTTSX3_AVAILABLE:
                try:
                    self.pyttsx3_engine = pyttsx3.init()
                    self.pyttsx3_engine.setProperty('rate', 150)
                    self.pyttsx3_engine.setProperty('volume', 0.9)
                except Exception as e:
                    print(f"❌ فشل تهيئة pyttsx3: {e}")
    
    def get_available_engines(self):
        """الحصول على المحركات المتاحة"""
        engines = []
        if GTTS_AVAILABLE:
            engines.append('gtts')
        if PYTTSX3_AVAILABLE:
            engines.append('pyttsx3')
        return engines
    
    def is_available(self):
        """التحقق من توفر أي محرك"""
        return GTTS_AVAILABLE or PYTTSX3_AVAILABLE


def test_tts():
    """اختبار نظام TTS"""
    print("🧪 اختبار نظام Text-to-Speech")
    print("=" * 50)
    
    tts = TextToSpeech(engine='gtts', lang='ar')
    
    if not tts.is_available():
        print("❌ لا يوجد محرك TTS متاح!")
        print("\n💡 للتثبيت:")
        print("   pip install gtts pygame")
        print("   pip install pyttsx3")
        return
    
    print(f"✅ المحركات المتاحة: {tts.get_available_engines()}")
    
    # اختبار النطق بالعربية
    print("\n🔊 اختبار النطق بالعربية...")
    tts.speak("مرحباً، هذا اختبار لنظام تحويل النص إلى كلام", blocking=True)
    
    # اختبار النطق بالإنجليزية
    print("🔊 اختبار النطق بالإنجليزية...")
    tts.speak("Hello, this is a test of the text to speech system", lang='en', blocking=True)
    
    print("\n✅ انتهى الاختبار!")


if __name__ == "__main__":
    test_tts()
