#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
نظام التصحيح الإملائي متعدد اللغات
يدعم عدة محركات: autocorrect (سريع)، language_tool_python (متقدم)، pyspellchecker
"""

import logging
from typing import Optional, List, Tuple

# محاولة استيراد autocorrect (الخيار الأساسي - سريع وبسيط)
try:
    from autocorrect import Speller
    AUTOCORRECT_AVAILABLE = True
except ImportError:
    AUTOCORRECT_AVAILABLE = False

# محاولة استيراد language_tool_python (خيار متقدم)
try:
    import language_tool_python
    LANGUAGE_TOOL_AVAILABLE = True
except ImportError:
    LANGUAGE_TOOL_AVAILABLE = False

# محاولة استيراد pyspellchecker (خيار احتياطي)
try:
    from spellchecker import SpellChecker as PySpellChecker
    PYSPELL_AVAILABLE = True
except ImportError:
    PYSPELL_AVAILABLE = False

# إذا لم تكن أي مكتبة متاحة
if not (AUTOCORRECT_AVAILABLE or LANGUAGE_TOOL_AVAILABLE or PYSPELL_AVAILABLE):
    logging.warning("⚠️ لا توجد مكتبة تصحيح إملائي مثبتة")

class SpellChecker:
    """
    مصحح إملائي متعدد اللغات يدعم 3 محركات:
    1. autocorrect (سريع، 12+ لغة)
    2. language_tool_python (متقدم، 30+ لغة)
    3. pyspellchecker (احتياطي)
    """
    
    # اللغات المدعومة في autocorrect (سريع وخفيف)
    AUTOCORRECT_LANGUAGES = {
        'en': 'en',    # English
        'es': 'es',    # Spanish
        'fr': 'fr',    # French
        'pt': 'pt',    # Portuguese
        'tr': 'tr',    # Turkish
        'cs': 'cs',    # Czech
        'pl': 'pl',    # Polish
        'ru': 'ru',    # Russian
        'uk': 'uk',    # Ukrainian
        'el': 'el',    # Greek
        'it': 'it',    # Italian
        'vi': 'vi',    # Vietnamese
    }
    
    # اللغات المدعومة في LanguageTool (متقدم)
    LANGUAGE_TOOL_LANGUAGES = {
        'ar': 'ar',           # العربية
        'en': 'en-US',        # الإنجليزية (أمريكية)
        'fr': 'fr',           # الفرنسية
        'es': 'es',           # الإسبانية
        'de': 'de-DE',        # الألمانية
        'it': 'it',           # الإيطالية
        'pt': 'pt-PT',        # البرتغالية
        'ru': 'ru-RU',        # الروسية
        'nl': 'nl',           # الهولندية
        'pl': 'pl-PL',        # البولندية
        'uk': 'uk-UA',        # الأوكرانية
        'ca': 'ca-ES',        # الكتالانية
        'el': 'el-GR',        # اليونانية
        'ro': 'ro-RO',        # الرومانية
        'tl': 'tl-PH',        # التاغالوغ (فلبيني)
    }
    
    # اللغات المدعومة في pyspellchecker
    PYSPELL_LANGUAGES = {
        'en': 'en',    # English
        'es': 'es',    # Spanish
        'fr': 'fr',    # French
        'pt': 'pt',    # Portuguese
        'de': 'de',    # German
        'ru': 'ru',    # Russian
        'ar': 'ar',    # Arabic
    }
    
    def __init__(self, language: str = 'ar', auto_correct: bool = True, engine: str = 'auto'):
        """
        تهيئة المصحح الإملائي
        
        Args:
            language: رمز اللغة (ar, en, fr, إلخ)
            auto_correct: إذا كان True، يصحح الأخطاء تلقائياً
            engine: المحرك المستخدم ('auto', 'autocorrect', 'languagetool', 'pyspell')
        """
        self.language = language
        self.auto_correct = auto_correct
        self.engine = engine
        self.tool = None
        self.enabled = False
        self.active_engine = None
        
        # اختيار المحرك المناسب
        if engine == 'auto':
            # اختيار تلقائي حسب توفر المكتبات واللغة
            if AUTOCORRECT_AVAILABLE and language in self.AUTOCORRECT_LANGUAGES:
                self._init_autocorrect(language)
            elif LANGUAGE_TOOL_AVAILABLE:
                self._init_languagetool(language)
            elif PYSPELL_AVAILABLE and language in self.PYSPELL_LANGUAGES:
                self._init_pyspell(language)
            else:
                logging.warning(f"⚠️ لا يوجد مصحح متاح للغة: {language}")
        elif engine == 'autocorrect' and AUTOCORRECT_AVAILABLE:
            self._init_autocorrect(language)
        elif engine == 'languagetool' and LANGUAGE_TOOL_AVAILABLE:
            self._init_languagetool(language)
        elif engine == 'pyspell' and PYSPELL_AVAILABLE:
            self._init_pyspell(language)
        else:
            logging.warning(f"⚠️ المحرك '{engine}' غير متاح")
    
    def _init_autocorrect(self, language: str):
        """تهيئة autocorrect"""
        try:
            lang_code = self.AUTOCORRECT_LANGUAGES.get(language, 'en')
            self.tool = Speller(lang=lang_code)
            self.enabled = True
            self.active_engine = 'autocorrect'
            logging.info(f"✅ تم تفعيل autocorrect للغة: {language}")
        except Exception as e:
            logging.error(f"❌ فشل تهيئة autocorrect: {e}")
            self.enabled = False
    
    def _init_languagetool(self, language: str):
        """تهيئة LanguageTool"""
        try:
            lang_code = self.LANGUAGE_TOOL_LANGUAGES.get(language, 'en-US')
            self.tool = language_tool_python.LanguageTool(lang_code)
            self.enabled = True
            self.active_engine = 'languagetool'
            logging.info(f"✅ تم تفعيل LanguageTool للغة: {language} ({lang_code})")
        except Exception as e:
            logging.error(f"❌ فشل تهيئة LanguageTool: {e}")
            self.enabled = False
    
    def _init_pyspell(self, language: str):
        """تهيئة pyspellchecker"""
        try:
            lang_code = self.PYSPELL_LANGUAGES.get(language, 'en')
            self.tool = PySpellChecker(language=lang_code)
            self.enabled = True
            self.active_engine = 'pyspell'
            logging.info(f"✅ تم تفعيل pyspellchecker للغة: {language}")
        except Exception as e:
            logging.error(f"❌ فشل تهيئة pyspellchecker: {e}")
            self.enabled = False
    
    def change_language(self, language: str) -> bool:
        """
        تغيير لغة المصحح
        
        Args:
            language: رمز اللغة الجديد
        
        Returns:
            True إذا نجح التغيير
        """
        if not LANGUAGE_TOOL_AVAILABLE:
            return False
        
        try:
            # إغلاق الأداة القديمة
            if self.tool:
                self.tool.close()
            
            # إنشاء أداة جديدة
            lang_code = self.SUPPORTED_LANGUAGES.get(language, 'en-US')
            self.tool = language_tool_python.LanguageTool(lang_code)
            self.language = language
            self.enabled = True
            
            logging.info(f"✅ تم تغيير لغة المصحح إلى: {language} ({lang_code})")
            return True
            
        except Exception as e:
            logging.error(f"❌ فشل تغيير لغة المصحح: {e}")
            self.enabled = False
            return False
    
    def check(self, text: str) -> Tuple[str, List[str]]:
        """
        فحص النص وإرجاع النص المصحح والأخطاء المكتشفة
        
        Args:
            text: النص المراد فحصه
        
        Returns:
            (النص المصحح, قائمة الأخطاء)
        """
        if not self.enabled or not text.strip():
            return text, []
        
        try:
            # فحص النص
            matches = self.tool.check(text)
            
            if not matches:
                # لا توجد أخطاء
                return text, []
            
            # جمع الأخطاء
            errors = []
            for match in matches:
                error_msg = f"'{match.context}': {match.message}"
                errors.append(error_msg)
            
            # تصحيح تلقائي إذا كان مفعلاً
            if self.auto_correct and matches:
                corrected_text = language_tool_python.utils.correct(text, matches)
                return corrected_text, errors
            else:
                return text, errors
                
        except Exception as e:
            logging.error(f"❌ خطأ في فحص النص: {e}")
            return text, []
    
    def check_and_correct(self, text: str, verbose: bool = False) -> str:
        """
        فحص وتصحيح النص
        
        Args:
            text: النص المراد تصحيحه
            verbose: إذا كان True، يطبع الأخطاء المكتشفة
        
        Returns:
            النص المصحح
        """
        if not self.enabled or not text.strip():
            return text
        
        try:
            # استخدام المحرك المناسب
            if self.active_engine == 'autocorrect':
                # autocorrect يصحح مباشرة
                corrected_text = self.tool(text)
                if verbose and corrected_text != text:
                    print(f"✅ تم التصحيح: {text} → {corrected_text}")
                elif verbose:
                    print("✅ لا توجد أخطاء")
                return corrected_text
                
            elif self.active_engine == 'languagetool':
                # LanguageTool يعطي تفاصيل أكثر
                corrected_text, errors = self.check(text)
                if verbose and errors:
                    print(f"📝 تم اكتشاف {len(errors)} خطأ:")
                    for i, error in enumerate(errors[:3], 1):  # أول 3 أخطاء
                        print(f"  {i}. {error}")
                    print(f"✅ النص المصحح: {corrected_text}")
                elif verbose:
                    print("✅ لا توجد أخطاء إملائية")
                return corrected_text
                
            elif self.active_engine == 'pyspell':
                # pyspellchecker يصحح كلمة بكلمة
                words = text.split()
                corrected_words = []
                for word in words:
                    if word in self.tool:
                        corrected_words.append(word)
                    else:
                        correction = self.tool.correction(word)
                        corrected_words.append(correction if correction else word)
                corrected_text = ' '.join(corrected_words)
                
                if verbose and corrected_text != text:
                    print(f"✅ تم التصحيح: {text} → {corrected_text}")
                elif verbose:
                    print("✅ لا توجد أخطاء")
                return corrected_text
            
            return text
            
        except Exception as e:
            logging.error(f"❌ خطأ في التصحيح: {e}")
            return text
    
    def get_suggestions(self, text: str) -> List[Tuple[str, List[str]]]:
        """
        الحصول على اقتراحات التصحيح لكل خطأ
        
        Args:
            text: النص المراد فحصه
        
        Returns:
            قائمة من (الكلمة الخاطئة, [اقتراحات التصحيح])
        """
        if not self.enabled or not text.strip():
            return []
        
        try:
            matches = self.tool.check(text)
            
            suggestions = []
            for match in matches:
                word = text[match.offset:match.offset + match.errorLength]
                replacements = match.replacements[:5]  # أول 5 اقتراحات
                suggestions.append((word, replacements))
            
            return suggestions
            
        except Exception as e:
            logging.error(f"❌ خطأ في الحصول على الاقتراحات: {e}")
            return []
    
    def is_language_supported(self, language: str) -> bool:
        """
        التحقق من دعم لغة معينة
        
        Args:
            language: رمز اللغة
        
        Returns:
            True إذا كانت مدعومة
        """
        return language in self.SUPPORTED_LANGUAGES
    
    def close(self):
        """إغلاق المصحح وتحرير الموارد"""
        if self.tool:
            try:
                self.tool.close()
                logging.info("✅ تم إغلاق المصحح الإملائي")
            except Exception as e:
                logging.error(f"❌ خطأ في إغلاق المصحح: {e}")
    
    def __del__(self):
        """تنظيف عند حذف الكائن"""
        self.close()


# دوال مساعدة سريعة
def quick_check(text: str, language: str = 'ar') -> str:
    """
    فحص وتصحيح سريع للنص
    
    Args:
        text: النص المراد تصحيحه
        language: اللغة
    
    Returns:
        النص المصحح
    """
    checker = SpellChecker(language=language, auto_correct=True)
    corrected = checker.check_and_correct(text)
    checker.close()
    return corrected


def is_spell_checker_available() -> bool:
    """
    التحقق من توفر المصحح الإملائي
    
    Returns:
        True إذا كانت أي مكتبة مثبتة
    """
    return AUTOCORRECT_AVAILABLE or LANGUAGE_TOOL_AVAILABLE or PYSPELL_AVAILABLE


def get_available_engines() -> List[str]:
    """
    الحصول على قائمة المحركات المتاحة
    
    Returns:
        قائمة بأسماء المحركات المتاحة
    """
    engines = []
    if AUTOCORRECT_AVAILABLE:
        engines.append('autocorrect')
    if LANGUAGE_TOOL_AVAILABLE:
        engines.append('languagetool')
    if PYSPELL_AVAILABLE:
        engines.append('pyspell')
    return engines


# اختبار
if __name__ == "__main__":
    print("=" * 60)
    print("🔍 اختبار المصحح الإملائي متعدد المحركات")
    print("=" * 60)
    
    # عرض المحركات المتاحة
    available = get_available_engines()
    print(f"\n💡 المحركات المتاحة: {', '.join(available) if available else 'لا شيء'}")
    
    if not available:
        print("\n❌ لا توجد مكتبات تصحيح مثبتة")
        print("\n📦 لتثبيت المكتبات:")
        print("  pip install autocorrect              # سريع وبسيط (12+ لغة)")
        print("  pip install language-tool-python     # متقدم (30+ لغة)")
        print("  pip install pyspellchecker           # احتياطي")
    else:
        # اختبار بالإنجليزية
        print("\n📝 اختبار بالإنجليزية:")
        checker_en = SpellChecker(language='en', auto_correct=True, engine='auto')
        print(f"   المحرك المستخدم: {checker_en.active_engine}")
        
        text_en = "I have an eror in this sentance and it is vary bad"
        corrected_en = checker_en.check_and_correct(text_en, verbose=True)
        print(f"   Original: {text_en}")
        print(f"   Corrected: {corrected_en}")
        
        # اختبار بالإسبانية إذا كان متاح
        if 'es' in SpellChecker.AUTOCORRECT_LANGUAGES and AUTOCORRECT_AVAILABLE:
            print("\n📝 اختبار بالإسبانية:")
            checker_es = SpellChecker(language='es', auto_correct=True)
            print(f"   المحرك المستخدم: {checker_es.active_engine}")
            
            text_es = "Hola mi nomre es Ahmed y tengo un eror"
            corrected_es = checker_es.check_and_correct(text_es, verbose=True)
            print(f"   Original: {text_es}")
            print(f"   Corrected: {corrected_es}")
        
        # اختبار بالعربية إذا كان LanguageTool متاح
        if LANGUAGE_TOOL_AVAILABLE:
            print("\n� اختبار بالعربية (LanguageTool):")
            checker_ar = SpellChecker(language='ar', auto_correct=True, engine='languagetool')
            print(f"   المحرك المستخدم: {checker_ar.active_engine}")
            
            text_ar = "مرحبا انا اسمى احمد"
            corrected_ar = checker_ar.check_and_correct(text_ar, verbose=True)
            print(f"   النص الأصلي: {text_ar}")
            print(f"   النص المصحح: {corrected_ar}")
            checker_ar.close()
        
        # تنظيف
        checker_en.close()
        
        print("\n✅ انتهى الاختبار")
