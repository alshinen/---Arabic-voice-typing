#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
قائمة اللغات الموحدة لجميع أنظمة البرنامج
(التعرف على الصوت، الترجمة، النطق)
"""

# ============================================================
# قائمة اللغات الشاملة
# ============================================================
LANGUAGES = {
    # اللغة: (الاسم بالعربية، الاسم بالإنجليزية، رمز ISO)
    'ar': ('العربية', 'Arabic', 'ar'),
    'en': ('الإنجليزية', 'English', 'en'),
    'fr': ('الفرنسية', 'Français', 'fr'),
    'es': ('الإسبانية', 'Español', 'es'),
    'de': ('الألمانية', 'Deutsch', 'de'),
    'it': ('الإيطالية', 'Italiano', 'it'),
    'pt': ('البرتغالية', 'Português', 'pt'),
    'ru': ('الروسية', 'Русский', 'ru'),
    'zh': ('الصينية', '中文', 'zh-CN'),
    'ja': ('اليابانية', '日本語', 'ja'),
    'ko': ('الكورية', '한국어', 'ko'),
    'tr': ('التركية', 'Türkçe', 'tr'),
    'fa': ('الفارسية', 'فارسی', 'fa'),
    'hi': ('الهندية', 'हिन्दी', 'hi'),
    'tl': ('الفلبينية (تاغالوغ)', 'Filipino (Tagalog)', 'tl'),
    'ceb': ('السيبوانية', 'Cebuano (Visayan)', 'ceb'),
    'nl': ('الهولندية', 'Nederlands', 'nl'),
    'pl': ('البولندية', 'Polski', 'pl'),
    'vi': ('الفيتنامية', 'Tiếng Việt', 'vi'),
    'th': ('التايلاندية', 'ไทย', 'th'),
    'id': ('الإندونيسية', 'Bahasa Indonesia', 'id'),
    'ms': ('الماليزية', 'Bahasa Melayu', 'ms'),
    'uk': ('الأوكرانية', 'Українська', 'uk'),
    'sv': ('السويدية', 'Svenska', 'sv'),
    'da': ('الدانماركية', 'Dansk', 'da'),
    'no': ('النرويجية', 'Norsk', 'no'),
    'fi': ('الفنلندية', 'Suomi', 'fi'),
    'cs': ('التشيكية', 'Čeština', 'cs'),
    'sk': ('السلوفاكية', 'Slovenčina', 'sk'),
    'hu': ('الهنغارية', 'Magyar', 'hu'),
    'ro': ('الرومانية', 'Română', 'ro'),
    'el': ('اليونانية', 'Ελληνικά', 'el'),
    'he': ('العبرية', 'עברית', 'he'),
    'bn': ('البنغالية', 'বাংলা', 'bn'),
    'ta': ('التاميلية', 'தமிழ்', 'ta'),
    'te': ('التيلوغوية', 'తెలుగు', 'te'),
    'mr': ('الماراثية', 'मराठी', 'mr'),
    'ur': ('الأوردو', 'اردو', 'ur'),
    'sw': ('السواحلية', 'Kiswahili', 'sw'),
    'ca': ('الكتالانية', 'Català', 'ca'),
}

# ============================================================
# قواميس منسقة للاستخدام في الواجهة
# ============================================================

def get_display_names(use_native=True):
    """
    الحصول على أسماء اللغات للعرض
    
    Args:
        use_native: استخدام الأسماء الأصلية (True) أو العربية (False)
    
    Returns:
        قاموس {الاسم المعروض: الرمز}
    """
    if use_native:
        # استخدام الأسماء الأصلية (English, Français, إلخ)
        return {info[1]: code for code, info in LANGUAGES.items()}
    else:
        # استخدام الأسماء العربية
        return {info[0]: code for code, info in LANGUAGES.items()}

def get_code_by_name(name):
    """
    الحصول على رمز اللغة من اسمها
    
    Args:
        name: اسم اللغة (عربي أو أصلي)
    
    Returns:
        رمز اللغة أو None
    """
    for code, (ar_name, native_name, _) in LANGUAGES.items():
        if name == ar_name or name == native_name:
            return code
    return None

def get_gtts_code(code):
    """
    تحويل رمز اللغة لما يتوافق مع gtts
    
    Args:
        code: رمز اللغة (ar, en, إلخ)
    
    Returns:
        رمز gtts المناسب أو None إذا كانت غير مدعومة
    """
    # gtts يستخدم رموز معينة لبعض اللغات
    gtts_mapping = {
        'zh': 'zh-CN',  # الصينية المبسطة
        'he': 'iw',     # العبرية (gtts يستخدم iw بدلاً من he)
        'en': 'en',
        'ar': 'ar',
    }
    
    # إذا كانت اللغة غير مدعومة في gtts، إرجاع None
    final_code = gtts_mapping.get(code, code)
    if final_code not in GTTS_SUPPORTED and code not in GTTS_SUPPORTED:
        return None
    
    return final_code

def get_speech_recognition_code(code):
    """
    تحويل رمز اللغة لما يتوافق مع SpeechRecognition
    
    Args:
        code: رمز اللغة
    
    Returns:
        رمز مناسب لـ Google Speech Recognition
    """
    sr_mapping = {
        'ar': 'ar-SA',
        'en': 'en-US',
        'fr': 'fr-FR',
        'es': 'es-ES',
        'de': 'de-DE',
        'it': 'it-IT',
        'pt': 'pt-BR',
        'ru': 'ru-RU',
        'zh': 'zh-CN',
        'ja': 'ja-JP',
        'ko': 'ko-KR',
        'tr': 'tr-TR',
        'hi': 'hi-IN',
        'nl': 'nl-NL',
        'pl': 'pl-PL',
    }
    return sr_mapping.get(code, code)

# ============================================================
# قوائم مصنفة حسب النظام
# ============================================================

# اللغات المدعومة في Vosk (حسب النماذج المتوفرة)
VOSK_SUPPORTED = [
    'ar', 'en', 'fr', 'es', 'de', 'it', 'pt', 'ru', 'zh', 'ja', 
    'ko', 'tr', 'hi', 'nl', 'pl', 'vi', 'ca'
]

# اللغات المدعومة في Google TTS (gtts)
# ملاحظة: fa (الفارسية) غير مدعومة، he يستخدم رمز iw في gtts
GTTS_SUPPORTED = [
    'ar', 'en', 'fr', 'es', 'de', 'it', 'pt', 'ru', 'zh', 'ja', 
    'ko', 'tr', 'hi', 'tl', 'nl', 'pl', 'vi', 'th', 'id',
    'ms', 'uk', 'sv', 'da', 'no', 'fi', 'cs', 'sk', 'hu', 'ro',
    'el', 'he', 'bn', 'ta', 'te', 'ur', 'sw', 'ca'
]

# اللغات المدعومة في Google Translate
TRANSLATE_SUPPORTED = list(LANGUAGES.keys())  # جميع اللغات

# ============================================================
# دوال مساعدة
# ============================================================

def is_language_supported(code, system='translate'):
    """
    التحقق من دعم لغة في نظام معين
    
    Args:
        code: رمز اللغة
        system: 'vosk', 'gtts', 'translate', 'all'
    
    Returns:
        True إذا كانت مدعومة
    """
    if system == 'vosk':
        return code in VOSK_SUPPORTED
    elif system == 'gtts':
        return code in GTTS_SUPPORTED
    elif system == 'translate':
        return code in TRANSLATE_SUPPORTED
    elif system == 'all':
        return (code in VOSK_SUPPORTED and 
                code in GTTS_SUPPORTED and 
                code in TRANSLATE_SUPPORTED)
    return False

def get_supported_languages(system='translate'):
    """
    الحصول على قائمة اللغات المدعومة في نظام
    
    Args:
        system: 'vosk', 'gtts', 'translate', 'all'
    
    Returns:
        قائمة برموز اللغات المدعومة
    """
    if system == 'vosk':
        return VOSK_SUPPORTED
    elif system == 'gtts':
        return GTTS_SUPPORTED
    elif system == 'translate':
        return TRANSLATE_SUPPORTED
    elif system == 'all':
        return list(set(VOSK_SUPPORTED) & set(GTTS_SUPPORTED) & set(TRANSLATE_SUPPORTED))
    return []

def get_language_info(code):
    """
    الحصول على معلومات كاملة عن لغة
    
    Args:
        code: رمز اللغة
    
    Returns:
        قاموس بمعلومات اللغة أو None
    """
    if code in LANGUAGES:
        ar_name, native_name, iso_code = LANGUAGES[code]
        return {
            'code': code,
            'arabic_name': ar_name,
            'native_name': native_name,
            'iso_code': iso_code,
            'vosk_supported': code in VOSK_SUPPORTED,
            'gtts_supported': code in GTTS_SUPPORTED,
            'translate_supported': code in TRANSLATE_SUPPORTED,
        }
    return None

# ============================================================
# اختبار سريع
# ============================================================
if __name__ == "__main__":
    print("🌐 قائمة اللغات المدعومة:")
    print(f"   إجمالي: {len(LANGUAGES)} لغة")
    print(f"   Vosk: {len(VOSK_SUPPORTED)} لغة")
    print(f"   Google TTS: {len(GTTS_SUPPORTED)} لغة")
    print(f"   Google Translate: {len(TRANSLATE_SUPPORTED)} لغة")
    
    print("\n✅ مثال:")
    info = get_language_info('ar')
    if info:
        print(f"   اللغة: {info['native_name']}")
        print(f"   الاسم بالعربية: {info['arabic_name']}")
        print(f"   الرمز: {info['code']}")
        print(f"   Vosk: {'✅' if info['vosk_supported'] else '❌'}")
        print(f"   TTS: {'✅' if info['gtts_supported'] else '❌'}")
        print(f"   Translate: {'✅' if info['translate_supported'] else '❌'}")
