#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
نظام التصحيح الإملائي متعدد اللغات
يستخدم language_tool_python للتحقق من الأخطاء الإملائية والنحوية
"""

import logging
from typing import Optional, List, Tuple

# محاولة استيراد language_tool_python
try:
    import language_tool_python
    LANGUAGE_TOOL_AVAILABLE = True
except ImportError:
    LANGUAGE_TOOL_AVAILABLE = False
    logging.warning("⚠️ مكتبة language_tool_python غير مثبتة - المصحح الإملائي معطل")

class SpellChecker:
    """
    مصحح إملائي متعدد اللغات
    يدعم أكثر من 30 لغة
    """
    
    # اللغات المدعومة في LanguageTool
    SUPPORTED_LANGUAGES = {
        'ar': 'ar',           # العربية
        'en': 'en-US',        # الإنجليزية (أمريكية)
        'en-GB': 'en-GB',     # الإنجليزية (بريطانية)
        'fr': 'fr',           # الفرنسية
        'es': 'es',           # الإسبانية
        'de': 'de-DE',        # الألمانية
        'it': 'it',           # الإيطالية
        'pt': 'pt-PT',        # البرتغالية (البرتغال)
        'pt-BR': 'pt-BR',     # البرتغالية (البرازيل)
        'ru': 'ru-RU',        # الروسية
        'zh': 'zh-CN',        # الصينية
        'ja': 'ja-JP',        # اليابانية
        'nl': 'nl',           # الهولندية
        'pl': 'pl-PL',        # البولندية
        'uk': 'uk-UA',        # الأوكرانية
        'ca': 'ca-ES',        # الكتالانية
        'el': 'el-GR',        # اليونانية
        'ro': 'ro-RO',        # الرومانية
        'sk': 'sk-SK',        # السلوفاكية
        'sl': 'sl-SI',        # السلوفينية
        'sv': 'sv',           # السويدية
        'ta': 'ta-IN',        # التاميلية
        'tl': 'tl-PH',        # التاغالوغ (فلبيني)
    }
    
    def __init__(self, language: str = 'ar', auto_correct: bool = True):
        """
        تهيئة المصحح الإملائي
        
        Args:
            language: رمز اللغة (ar, en, fr, إلخ)
            auto_correct: إذا كان True، يصحح الأخطاء تلقائياً
        """
        self.language = language
        self.auto_correct = auto_correct
        self.tool = None
        self.enabled = False
        
        if not LANGUAGE_TOOL_AVAILABLE:
            logging.warning("المصحح الإملائي معطل - المكتبة غير مثبتة")
            return
        
        # تهيئة LanguageTool
        try:
            lang_code = self.SUPPORTED_LANGUAGES.get(language, 'en-US')
            self.tool = language_tool_python.LanguageTool(lang_code)
            self.enabled = True
            logging.info(f"✅ تم تفعيل المصحح الإملائي للغة: {language} ({lang_code})")
        except Exception as e:
            logging.error(f"❌ فشل تهيئة المصحح الإملائي: {e}")
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
        
        corrected_text, errors = self.check(text)
        
        if verbose and errors:
            print(f"📝 تم اكتشاف {len(errors)} خطأ:")
            for i, error in enumerate(errors, 1):
                print(f"  {i}. {error}")
            print(f"✅ النص المصحح: {corrected_text}")
        elif verbose:
            print("✅ لا توجد أخطاء إملائية")
        
        return corrected_text
    
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
        True إذا كانت المكتبة مثبتة
    """
    return LANGUAGE_TOOL_AVAILABLE


# اختبار
if __name__ == "__main__":
    print("=" * 60)
    print("🔍 اختبار المصحح الإملائي")
    print("=" * 60)
    
    if not LANGUAGE_TOOL_AVAILABLE:
        print("❌ المصحح الإملائي غير متاح")
        print("لتثبيته: pip install language-tool-python")
    else:
        # اختبار بالعربية
        print("\n📝 اختبار بالعربية:")
        checker_ar = SpellChecker(language='ar', auto_correct=True)
        
        text_ar = "مرحبا انا اسمى احمد وانا من مصر"
        corrected_ar = checker_ar.check_and_correct(text_ar, verbose=True)
        print(f"النص الأصلي: {text_ar}")
        print(f"النص المصحح: {corrected_ar}")
        
        # اختبار بالإنجليزية
        print("\n📝 اختبار بالإنجليزية:")
        checker_en = SpellChecker(language='en', auto_correct=True)
        
        text_en = "I have an eror in this sentance"
        corrected_en = checker_en.check_and_correct(text_en, verbose=True)
        print(f"Original: {text_en}")
        print(f"Corrected: {corrected_en}")
        
        # اختبار الاقتراحات
        print("\n💡 اختبار الاقتراحات:")
        suggestions = checker_en.get_suggestions(text_en)
        for word, replacements in suggestions:
            print(f"  '{word}' → {replacements}")
        
        # تنظيف
        checker_ar.close()
        checker_en.close()
        
        print("\n✅ انتهى الاختبار")
