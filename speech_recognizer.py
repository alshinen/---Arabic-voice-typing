#!/usr/bin/env python3
"""
محرك التعرف على الصوت - يدعم Vosk و Whisper و Google Speech Recognition
"""

import wave
import tempfile
import os
import threading
import time
import numpy as np

try:
    # محاولة استيراد openai-whisper (الصحيح)
    try:
        import whisper
        # التحقق من أن whisper هو openai-whisper وليس whisper.py القديم
        if hasattr(whisper, 'load_model'):
            WHISPER_AVAILABLE = True
        else:
            # whisper.py القديم - ليس متوافقاً
            WHISPER_AVAILABLE = False
            whisper = None
    except (ImportError, TypeError, AttributeError):
        WHISPER_AVAILABLE = False
        whisper = None
except Exception:
    WHISPER_AVAILABLE = False
    whisper = None

try:
    from vosk import Model, KaldiRecognizer
    VOSK_AVAILABLE = True
except ImportError:
    VOSK_AVAILABLE = False

try:
    import speech_recognition as sr
    GOOGLE_SR_AVAILABLE = True
except ImportError:
    GOOGLE_SR_AVAILABLE = False

try:
    import pyaudio
    PYAUDIO_AVAILABLE = True
except ImportError:
    PYAUDIO_AVAILABLE = False

try:
    import sounddevice as sd
    SOUNDDEVICE_AVAILABLE = True
except ImportError:
    SOUNDDEVICE_AVAILABLE = False

import json


class SpeechRecognizer:
    """محرك التعرف على الصوت مع دعم عدة محركات"""
    
    def __init__(self, engine='vosk', model_path=None, language='ar', 
                 use_google_fallback=False, offline_only=False):
        """
        تهيئة محرك التعرف
        
        Args:
            engine: 'whisper' أو 'vosk' أو 'google'
            model_path: مسار النموذج (للـ Vosk)
            language: اللغة ('ar' للعربية)
            use_google_fallback: استخدام Google كاحتياطي عند الفشل
            offline_only: العمل بدون إنترنت فقط (تعطيل Google)
        """
        self.engine = engine.lower()
        self.language = language
        self.is_listening = False
        self.audio_stream = None
        self.pyaudio_instance = None
        self.use_sounddevice = False  # علامة لاستخدام sounddevice
        self.audio_queue = []  # قائمة إطارات sounddevice
        self.callback = None
        self.use_google_fallback = use_google_fallback and not offline_only
        self.offline_only = offline_only
        
        self.vosk_models = {}
        self.current_vosk_model = None
        self.vosk_recognizer = None
        self.processing = False  # حالة المعالجة للتعرف غير المتزامن
        
        # تهيئة المحرك المختار
        if self.engine == 'whisper':
            self._init_whisper()
        elif self.engine == 'vosk':
            self._init_vosk(model_path)
        elif self.engine == 'google':
            if not GOOGLE_SR_AVAILABLE:
                raise ImportError("Google Speech Recognition غير مثبت. قم بتثبيته: pip install SpeechRecognition")
            if offline_only:
                raise ValueError("لا يمكن استخدام Google في وضع offline_only")
        else:
            raise ValueError(f"محرك غير مدعوم: {engine}")
    
    def _init_whisper(self):
        """تهيئة Whisper"""
        if not WHISPER_AVAILABLE or whisper is None:
            raise ImportError(
                "Whisper غير مثبت أو غير متوافق.\n"
                "الحل:\n"
                "1. قم بإلغاء تثبيت whisper الخاطئ: pip uninstall whisper\n"
                "2. ثم قم بتثبيت openai-whisper: pip install openai-whisper\n"
                "أو استخدم Vosk بدلاً من ذلك"
            )
        
        try:
            print("🔄 جاري تحميل نموذج Whisper...")
            # استخدام base كنموذج افتراضي (يمكن تغييره إلى medium أو large للدقة الأفضل)
            self.whisper_model = whisper.load_model("base")
            print("✅ تم تحميل نموذج Whisper بنجاح!")
        except Exception as e:
            raise ImportError(
                f"فشل في تحميل نموذج Whisper: {e}\n"
                "تأكد من تثبيت openai-whisper الصحيح: pip install openai-whisper"
            )
    
    def _init_vosk(self, model_path):
        """تهيئة Vosk"""
        if not VOSK_AVAILABLE:
            raise ImportError("Vosk غير مثبت. قم بتثبيت: pip install vosk")
        
        if not model_path:
            # البحث عن النموذج في مجلد models
            possible_paths = [
                "models/vosk-model-ar",
                "../models/vosk-model-ar",
                "vosk-model-ar-0.22",
                "models/vosk-model-ar-0.22-linto-1.1.0",
                "../models/vosk-model-ar-0.22-linto-1.1.0"
            ]
            
            # محاولة استخدام ModelManager للعثور على النموذج
            try:
                from model_manager import ModelManager
                manager = ModelManager()
                found_path = manager.get_model_path(self.language)
                if found_path:
                    model_path = str(found_path)
            except:
                pass
            
            if not model_path:
                for path in possible_paths:
                    if os.path.exists(path):
                        model_path = path
                        break
            
            if not model_path:
                raise FileNotFoundError(
                    "لم يتم العثور على نموذج Vosk العربي. "
                    "قم بتحميله من: https://alphacephei.com/vosk/models"
                )
        
        print(f"🔄 جاري تحميل نموذج Vosk من: {model_path}...")
        self.vosk_model = Model(model_path)
        self.vosk_recognizer = KaldiRecognizer(self.vosk_model, 16000)
        self.vosk_recognizer.SetWords(True)
        print("✅ تم تحميل نموذج Vosk بنجاح!")
    
    def switch_language(self, language: str, model_path=None):
        """
        تبديل اللغة أثناء التشغيل
        
        Args:
            language: رمز اللغة الجديد
            model_path: مسار النموذج (للـ Vosk)
        """
        if self.is_listening:
            print("⚠️ لا يمكن تبديل اللغة أثناء التسجيل")
            return False
        
        self.language = language
        
        if self.engine == 'vosk':
            try:
                self._init_vosk(model_path)
                print(f"✅ تم التبديل إلى اللغة: {language}")
                return True
            except Exception as e:
                print(f"❌ خطأ في تبديل اللغة: {e}")
                return False
        elif self.engine == 'whisper':
            print(f"✅ تم التبديل إلى اللغة: {language}")
            return True
        
        return True
    
    def start_recording(self):
        """بدء التسجيل"""
        if self.is_listening:
            return
        
        self.is_listening = True
        
        # التحقق من توفر مكتبات الصوت
        if not PYAUDIO_AVAILABLE and not SOUNDDEVICE_AVAILABLE:
            raise ImportError(
                "لا يوجد مكتبة صوت متاحة!\n"
                "الرجاء تثبيت إحدى المكتبات التالية:\n"
                "  pip install sounddevice  (مستحسن)\n"
                "  pip install PyAudio"
            )
        
        # اختيار المكتبة المناسبة
        use_sounddevice = SOUNDDEVICE_AVAILABLE and not PYAUDIO_AVAILABLE
        
        try:
            # إعداد الميكروفون
            print(f"🎤 جاري فتح الميكروفون... (استخدام {'sounddevice' if use_sounddevice else 'PyAudio'})")
            
            if use_sounddevice:
                # استخدام sounddevice
                print(f"📊 أجهزة الصوت المتاحة:")
                devices = sd.query_devices()
                default_input = sd.query_devices(kind='input')
                print(f"�️ الميكروفون الافتراضي: {default_input['name']}")
                
                self.use_sounddevice = True
                self.audio_queue = []
            else:
                # استخدام PyAudio
                self.pyaudio_instance = pyaudio.PyAudio()
                
                # طباعة معلومات الأجهزة المتاحة
                print(f"📊 عدد أجهزة الصوت: {self.pyaudio_instance.get_device_count()}")
                default_input = self.pyaudio_instance.get_default_input_device_info()
                print(f"🎙️ الميكروفون الافتراضي: {default_input['name']}")
                
                self.audio_stream = self.pyaudio_instance.open(
                    format=pyaudio.paInt16,
                    channels=1,
                    rate=16000,
                    input=True,
                    frames_per_buffer=2000,
                    input_device_index=None
                )
                
                self.audio_stream.start_stream()
                self.use_sounddevice = False
            
            print("✅ تم فتح الميكروفون بنجاح!")
            
        except Exception as e:
            print(f"❌ خطأ في فتح الميكروفون: {e}")
            self.is_listening = False
            if self.pyaudio_instance:
                try:
                    self.pyaudio_instance.terminate()
                except:
                    pass
                self.pyaudio_instance = None
            raise Exception(
                f"فشل في فتح الميكروفون!\n\n"
                f"الخطأ: {e}\n\n"
                f"الحلول:\n"
                f"1. تأكد من توصيل الميكروفون\n"
                f"2. تحقق من إعدادات الصوت في Windows\n"
                f"3. أعط البرنامج صلاحية الوصول للميكروفون\n"
                f"4. أعد تشغيل البرنامج بصلاحيات المسؤول\n"
                f"5. جرب ميكروفون آخر إذا كان متاحاً"
            )
    
    def stop_recording(self):
        """إيقاف التسجيل بأمان"""
        print("⏹️ جاري إيقاف التسجيل...")
        self.is_listening = False
        
        # انتظار قليلاً لإنهاء المعالجة الحالية
        import time
        time.sleep(0.1)
        
        # إيقاف حسب المكتبة المستخدمة
        if hasattr(self, 'use_sounddevice') and self.use_sounddevice:
            # sounddevice لا تحتاج لإغلاق stream
            print("✅ تم إيقاف sounddevice")
        else:
            # إيقاف وإغلاق PyAudio stream
            if self.audio_stream:
                try:
                    if self.audio_stream.is_active():
                        self.audio_stream.stop_stream()
                    self.audio_stream.close()
                except Exception as e:
                    print(f"⚠️ خطأ في إيقاف audio_stream: {e}")
                finally:
                    self.audio_stream = None
            
            # إنهاء PyAudio
            if self.pyaudio_instance:
                try:
                    self.pyaudio_instance.terminate()
                except Exception as e:
                    print(f"⚠️ خطأ في إنهاء PyAudio: {e}")
                finally:
                    self.pyaudio_instance = None
        
        print("✅ تم إيقاف التسجيل بنجاح")
    
    def recognize_audio_file(self, audio_file_path):
        """التعرف على ملف صوتي"""
        text = ""
        
        if self.engine == 'whisper':
            text = self._recognize_with_whisper_file(audio_file_path)
        elif self.engine == 'vosk':
            text = self._recognize_with_vosk_file(audio_file_path)
        elif self.engine == 'google':
            text = self._recognize_with_google_file(audio_file_path)
        
        # استخدام Google كاحتياطي إذا فشل التعرف الأساسي
        if not text and self.use_google_fallback and GOOGLE_SR_AVAILABLE:
            print("🔄 محاولة استخدام Google Speech Recognition كاحتياطي...")
            text = self._recognize_with_google_file(audio_file_path)
        
        return text
    
    def _recognize_with_whisper_file(self, audio_file_path):
        """التعرف باستخدام Whisper من ملف"""
        try:
            result = self.whisper_model.transcribe(
                audio_file_path,
                language=self.language,
                task='transcribe'
            )
            return result['text'].strip()
        except Exception as e:
            print(f"❌ خطأ في Whisper: {e}")
            return ""
    
    def _recognize_with_vosk_file(self, audio_file_path):
        """التعرف باستخدام Vosk من ملف"""
        try:
            wf = wave.open(audio_file_path, "rb")
            
            # التحقق من صيغة الملف
            if wf.getnchannels() != 1 or wf.getcomptype() != "NONE":
                print("❌ يجب أن يكون الملف بصيغة mono PCM")
                return ""
            
            recognizer = KaldiRecognizer(self.vosk_model, wf.getframerate())
            recognizer.SetWords(True)
            
            text_parts = []
            
            while True:
                data = wf.readframes(4000)
                if len(data) == 0:
                    break
                
                if recognizer.AcceptWaveform(data):
                    result = json.loads(recognizer.Result())
                    if result.get('text'):
                        text_parts.append(result['text'])
            
            # الحصول على النتيجة النهائية
            final_result = json.loads(recognizer.FinalResult())
            if final_result.get('text'):
                text_parts.append(final_result['text'])
            
            wf.close()
            return " ".join(text_parts).strip()
            
        except Exception as e:
            print(f"❌ خطأ في Vosk: {e}")
            return ""
    
    def _recognize_with_google_file(self, audio_file_path):
        """التعرف باستخدام Google Speech Recognition من ملف"""
        if not GOOGLE_SR_AVAILABLE:
            return ""
        
        try:
            recognizer = sr.Recognizer()
            
            with sr.AudioFile(audio_file_path) as source:
                audio = recognizer.record(source)
            
            google_lang_map = {
                'ar': 'ar-SA',
                'en': 'en-US',
                'ko': 'ko-KR',
                'ru': 'ru-RU',
                'tr': 'tr-TR'
            }
            
            google_lang = google_lang_map.get(self.language, self.language)
            
            text = recognizer.recognize_google(audio, language=google_lang)
            return text.strip()
            
        except sr.UnknownValueError:
            print("❌ Google لم يتمكن من فهم الصوت")
            return ""
        except sr.RequestError as e:
            print(f"❌ خطأ في خدمة Google: {e}")
            return ""
        except Exception as e:
            print(f"❌ خطأ في Google Speech Recognition: {e}")
            return ""
    
    def record_and_recognize(self, duration=5):
        """تسجيل صوتي لفترة محددة والتعرف عليه"""
        if not self.is_listening:
            self.start_recording()
        
        frames = []
        
        for _ in range(0, int(16000 / 8000 * duration)):
            if hasattr(self, 'use_sounddevice') and self.use_sounddevice:
                data = sd.rec(8000, samplerate=16000, channels=1, dtype='int16', blocking=True)
                data = data.tobytes()
            else:
                data = self.audio_stream.read(8000, exception_on_overflow=False)
            frames.append(data)
        
        # حفظ في ملف مؤقت
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.wav')
        temp_file.close()
        
        with wave.open(temp_file.name, 'wb') as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)  # 16-bit = 2 bytes
            wf.setframerate(16000)
            wf.writeframes(b''.join(frames))
        
        # التعرف على الصوت
        text = self.recognize_audio_file(temp_file.name)
        
        # حذف الملف المؤقت
        os.unlink(temp_file.name)
        
        return text
    
    def listen_continuous(self, callback, phrase_time_limit=8, pause_threshold=0.8):
        """
        الاستماع المستمر للصوت (محسّن بشكل كبير للسرعة)
        
        Args:
            callback: دالة يتم استدعاؤها عند التعرف على نص
            phrase_time_limit: الحد الأقصى لطول الجملة (بالثواني) - افتراضي 8 ثوان
            pause_threshold: وقت الانتظار عند الصمت (بالثواني) - افتراضي 0.8 ثانية
        """
        self.callback = callback
        
        if not self.is_listening:
            self.start_recording()
        
        frames = []
        silence_start = None
        self.processing = False  # منع المعالجة المتعددة المتزامنة
        
        try:
            while self.is_listening:
                # قراءة الصوت حسب المكتبة المستخدمة
                if hasattr(self, 'use_sounddevice') and self.use_sounddevice:
                    # استخدام sounddevice
                    data = sd.rec(2000, samplerate=16000, channels=1, dtype='int16', blocking=True)
                    data = data.tobytes()
                else:
                    # استخدام PyAudio
                    data = self.audio_stream.read(2000, exception_on_overflow=False)
                
                frames.append(data)
                
                # التحقق من الصمت - محسّن لأقصى سرعة ممكنة
                if len(frames) >= 2:  # فحص فوري - آخر إطارين فقط
                    audio_data = b''.join(frames[-2:])  # آخر إطارين فقط (أسرع ممكن)
                    samples = np.frombuffer(audio_data, dtype=np.int16)
                    max_amplitude = np.max(np.abs(samples))
                else:
                    max_amplitude = 1000  # افتراض وجود صوت
                
                if max_amplitude < 500:  # عتبة الصمت محسّنة - 500 أفضل من 250
                    if silence_start is None:
                        silence_start = time.time()
                    elif time.time() - silence_start > pause_threshold and not self.processing:
                        # تم اكتشاف صمت - معالجة فورية
                        if len(frames) > 2:  # على الأقل 0.1 ثانية من الصوت
                            self.processing = True
                            # استخدام threading للتعرف غير المتزامن
                            recognition_thread = threading.Thread(
                                target=self._process_recorded_audio_async,
                                args=(frames.copy(),)
                            )
                            recognition_thread.daemon = True
                            recognition_thread.start()
                        frames = []
                        silence_start = None
                else:
                    silence_start = None
                
                # التحقق من الحد الأقصى للجملة (معالجة فورية)
                if len(frames) > int(16000 / 4000 * phrase_time_limit) and not self.processing:
                    self.processing = True
                    recognition_thread = threading.Thread(
                        target=self._process_recorded_audio_async,
                        args=(frames.copy(),)
                    )
                    recognition_thread.daemon = True
                    recognition_thread.start()
                    frames = []
                    silence_start = None
                
                # إزالة التأخير تماماً - أقصى سرعة ممكنة
                # time.sleep(0.005)  # تأخير أدنى إن لزم
                
        except Exception as e:
            print(f"❌ خطأ في الاستماع: {e}")
        finally:
            self.stop_recording()
    
    def _process_recorded_audio(self, frames):
        """معالجة الصوت المسجل (النسخة المتزامنة)"""
        try:
            # حفظ في ملف مؤقت
            temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.wav')
            temp_file.close()
            
            with wave.open(temp_file.name, 'wb') as wf:
                wf.setnchannels(1)
                wf.setsampwidth(2)  # 16-bit = 2 bytes
                wf.setframerate(16000)
                wf.writeframes(b''.join(frames))
            
            # التعرف على الصوت
            text = self.recognize_audio_file(temp_file.name)
            
            # حذف الملف المؤقت
            os.unlink(temp_file.name)
            
            # استدعاء الدالة callback
            if text and self.callback:
                # تصفية النصوص القصيرة جداً أو المشوشة
                text = text.strip()
                # تجاهل النصوص القصيرة جداً (أقل من 2 أحرف)
                if len(text) >= 2 and not self._is_noise(text):
                    self.callback(text)
                else:
                    print(f"⚠️ تم تجاهل نص مشوش: '{text}'")
                
        except Exception as e:
            print(f"❌ خطأ في معالجة الصوت: {e}")
    
    def _process_recorded_audio_async(self, frames):
        """معالجة الصوت المسجل بشكل غير متزامن (أسرع)"""
        try:
            # استخدام Vosk مباشرة من الذاكرة إذا كان متاحاً (أسرع بكثير)
            if self.engine == 'vosk' and self.vosk_recognizer:
                text = self._recognize_with_vosk_memory(frames)
                if text and self.callback:
                    self.callback(text)
                return
            
            # للأنظمة الأخرى، استخدام الملف المؤقت
            temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.wav')
            temp_file.close()
            
            with wave.open(temp_file.name, 'wb') as wf:
                wf.setnchannels(1)
                wf.setsampwidth(2)
                wf.setframerate(16000)
                wf.writeframes(b''.join(frames))
            
            # التعرف على الصوت
            text = self.recognize_audio_file(temp_file.name)
            
            # حذف الملف المؤقت
            try:
                os.unlink(temp_file.name)
            except:
                pass
            
            # استدعاء الدالة callback
            if text and self.callback:
                self.callback(text)
                
        except Exception as e:
            print(f"❌ خطأ في معالجة الصوت: {e}")
        finally:
            # إعادة تعيين حالة المعالجة بعد انتهاء Thread
            self.processing = False
    
    def _recognize_with_vosk_memory(self, frames):
        """التعرف على الصوت مباشرة من الذاكرة باستخدام Vosk (أسرع بكثير)"""
        try:
            audio_data = b''.join(frames)
            text_parts = []
            
            # معالجة مباشرة لأقصى سرعة ممكنة
            # معالجة مباشرة بدون تقسيم إذا كانت البيانات صغيرة
            if len(audio_data) <= 16000:  # أقل من ثانية واحدة
                # معالجة مباشرة - أسرع طريقة
                if self.vosk_recognizer.AcceptWaveform(audio_data):
                    result = json.loads(self.vosk_recognizer.Result())
                    if result.get('text'):
                        text_parts.append(result['text'])
            else:
                # للملفات الأكبر، استخدم chunks صغيرة جداً
                chunk_size = 1000  # حجم أصغر ممكن للمعالجة الأسرع
                for i in range(0, len(audio_data), chunk_size):
                    chunk = audio_data[i:i + chunk_size]
                    
                    if self.vosk_recognizer.AcceptWaveform(chunk):
                        result = json.loads(self.vosk_recognizer.Result())
                        if result.get('text'):
                            text_parts.append(result['text'])
            
            # الحصول على النتيجة النهائية فوراً
            final_result = json.loads(self.vosk_recognizer.FinalResult())
            if final_result.get('text'):
                text_parts.append(final_result['text'])
            
            return " ".join(text_parts).strip()
            
        except Exception as e:
            print(f"❌ خطأ في Vosk Memory: {e}")
            return ""
    
    def _is_noise(self, text):
        """فحص إذا كان النص ضوضاء أو كلام غير مفهوم"""
        text = text.strip().lower()
        
        # قائمة الكلمات المشوشة الشائعة التي يجب تجاهلها
        noise_patterns = [
            'uh', 'um', 'ah', 'eh', 'mm', 'hmm',
            'اه', 'ام', 'ممم', 'هممم', 'ااا', 'ييي',
            '[noise]', '[silence]', '[music]',
        ]
        
        # فحص إذا كان النص يحتوي فقط على أحرف متكررة
        if len(set(text)) <= 2 and len(text) > 3:
            return True  # مثل "ااااا" أو "يييي"
        
        # فحص الكلمات المشوشة
        for pattern in noise_patterns:
            if pattern in text:
                return True
        
        return False


def test_recognizer():
    """اختبار محرك التعرف"""
    print("🧪 اختبار محرك التعرف على الصوت")
    print("=" * 50)
    
    # محاولة استخدام Whisper أولاً
    try:
        recognizer = SpeechRecognizer(engine='whisper', language='ar')
        print("✅ تم تهيئة Whisper بنجاح!")
        return recognizer
    except Exception as e:
        print(f"⚠️ Whisper غير متاح: {e}")
    
    # محاولة استخدام Vosk
    try:
        recognizer = SpeechRecognizer(engine='vosk', language='ar')
        print("✅ تم تهيئة Vosk بنجاح!")
        return recognizer
    except Exception as e:
        print(f"❌ Vosk غير متاح: {e}")
        return None


if __name__ == "__main__":
    recognizer = test_recognizer()
    if recognizer:
        print("\n🎤 ابدأ بالتحدث...")
        recognizer.start_recording()
        text = recognizer.record_and_recognize(duration=5)
        recognizer.stop_recording()
        print(f"✅ النص المحول: {text}")

