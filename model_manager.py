#!/usr/bin/env python3
"""
مدير النماذج اللغوية - تحميل وإدارة نماذج Vosk لعدة لغات
"""

import os
import urllib.request
import zipfile
import json
import hashlib
from pathlib import Path
from typing import Optional, Dict, Callable


class ModelManager:
    """مدير تحميل وإدارة النماذج اللغوية"""
    
    MODELS = {
        'ar': {
            'name': 'vosk-model-ar-0.22-linto-1.1.0',
            'url': 'https://alphacephei.com/vosk/models/vosk-model-ar-0.22-linto-1.1.0.zip',
            'size': '320 MB',
            'description': 'نموذج اللغة العربية'
        },
        'en': {
            'name': 'vosk-model-small-en-us-0.15',
            'url': 'https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip',
            'size': '40 MB',
            'description': 'نموذج اللغة الإنجليزية (صغير)'
        },
        'fr': {
            'name': 'vosk-model-small-fr-0.22',
            'url': 'https://alphacephei.com/vosk/models/vosk-model-small-fr-0.22.zip',
            'size': '44 MB',
            'description': 'نموذج اللغة الفرنسية'
        },
        'de': {
            'name': 'vosk-model-small-de-0.22',
            'url': 'https://alphacephei.com/vosk/models/vosk-model-small-de-0.22.zip',
            'size': '44 MB',
            'description': 'نموذج اللغة الألمانية'
        },
        'es': {
            'name': 'vosk-model-small-es-0.22',
            'url': 'https://alphacephei.com/vosk/models/vosk-model-small-es-0.22.zip',
            'size': '42 MB',
            'description': 'نموذج اللغة الإسبانية'
        },
        'it': {
            'name': 'vosk-model-small-it-0.22',
            'url': 'https://alphacephei.com/vosk/models/vosk-model-small-it-0.22.zip',
            'size': '44 MB',
            'description': 'نموذج اللغة الإيطالية'
        },
        'pt': {
            'name': 'vosk-model-small-pt-0.22',
            'url': 'https://alphacephei.com/vosk/models/vosk-model-small-pt-0.22.zip',
            'size': '44 MB',
            'description': 'نموذج اللغة البرتغالية'
        },
        'zh': {
            'name': 'vosk-model-small-cn-0.22',
            'url': 'https://alphacephei.com/vosk/models/vosk-model-small-cn-0.22.zip',
            'size': '45 MB',
            'description': 'نموذج اللغة الصينية'
        },
        'ja': {
            'name': 'vosk-model-small-ja-0.22',
            'url': 'https://alphacephei.com/vosk/models/vosk-model-small-ja-0.22.zip',
            'size': '45 MB',
            'description': 'نموذج اللغة اليابانية'
        },
        'ko': {
            'name': 'vosk-model-small-ko-0.22',
            'url': 'https://alphacephei.com/vosk/models/vosk-model-small-ko-0.22.zip',
            'size': '42 MB',
            'description': 'نموذج اللغة الكورية'
        },
        'ru': {
            'name': 'vosk-model-small-ru-0.22',
            'url': 'https://alphacephei.com/vosk/models/vosk-model-small-ru-0.22.zip',
            'size': '45 MB',
            'description': 'نموذج اللغة الروسية'
        },
        'tr': {
            'name': 'vosk-model-small-tr-0.3',
            'url': 'https://alphacephei.com/vosk/models/vosk-model-small-tr-0.3.zip',
            'size': '35 MB',
            'description': 'نموذج اللغة التركية'
        },
        'fa': {
            'name': 'vosk-model-small-fa-0.22',
            'url': 'https://alphacephei.com/vosk/models/vosk-model-small-fa-0.22.zip',
            'size': '44 MB',
            'description': 'نموذج اللغة الفارسية'
        },
        'hi': {
            'name': 'vosk-model-small-hi-0.22',
            'url': 'https://alphacephei.com/vosk/models/vosk-model-small-hi-0.22.zip',
            'size': '44 MB',
            'description': 'نموذج اللغة الهندية'
        },
        'nl': {
            'name': 'vosk-model-small-nl-0.22',
            'url': 'https://alphacephei.com/vosk/models/vosk-model-small-nl-0.22.zip',
            'size': '44 MB',
            'description': 'نموذج اللغة الهولندية'
        },
        'pl': {
            'name': 'vosk-model-small-pl-0.22',
            'url': 'https://alphacephei.com/vosk/models/vosk-model-small-pl-0.22.zip',
            'size': '44 MB',
            'description': 'نموذج اللغة البولندية'
        },
        'uk': {
            'name': 'vosk-model-small-uk-v2-nst-0.6',
            'url': 'https://alphacephei.com/vosk/models/vosk-model-small-uk-v2-nst-0.6.zip',
            'size': '43 MB',
            'description': 'نموذج اللغة الأوكرانية'
        },
        'vi': {
            'name': 'vosk-model-small-vn-0.4',
            'url': 'https://alphacephei.com/vosk/models/vosk-model-small-vn-0.4.zip',
            'size': '44 MB',
            'description': 'نموذج اللغة الفيتنامية'
        },
        'ca': {
            'name': 'vosk-model-small-ca-0.4',
            'url': 'https://alphacephei.com/vosk/models/vosk-model-small-ca-0.4.zip',
            'size': '44 MB',
            'description': 'نموذج اللغة الكاتالانية'
        },
        'cs': {
            'name': 'vosk-model-small-cs-0.4',
            'url': 'https://alphacephei.com/vosk/models/vosk-model-small-cs-0.4.zip',
            'size': '44 MB',
            'description': 'نموذج اللغة التشيكية'
        },
        'el': {
            'name': 'vosk-model-small-el-0.22',
            'url': 'https://alphacephei.com/vosk/models/vosk-model-small-el-0.22.zip',
            'size': '44 MB',
            'description': 'نموذج اللغة اليونانية'
        }
    }
    
    LANGUAGE_NAMES = {
        'ar': 'العربية',
        'en': 'English',
        'fr': 'Français',
        'de': 'Deutsch',
        'es': 'Español',
        'it': 'Italiano',
        'pt': 'Português',
        'zh': '中文',
        'ja': '日本語',
        'ko': '한국어',
        'ru': 'Русский',
        'tr': 'Türkçe',
        'fa': 'فارسی',
        'hi': 'हिन्दी',
        'nl': 'Nederlands',
        'pl': 'Polski',
        'uk': 'Українська',
        'vi': 'Tiếng Việt',
        'ca': 'Català',
        'cs': 'Čeština',
        'el': 'Ελληνικά'
    }
    
    def __init__(self, models_dir: Optional[str] = None):
        """
        تهيئة مدير النماذج
        
        Args:
            models_dir: مسار مجلد النماذج (افتراضي: ~/.voice_to_text/models)
        """
        if models_dir is None:
            home = Path.home()
            models_dir = home / '.voice_to_text' / 'models'
        
        self.models_dir = Path(models_dir)
        self.models_dir.mkdir(parents=True, exist_ok=True)
        
        self.loaded_models: Dict[str, any] = {}
        self.max_cache_size = 2  # الحد الأقصى للنماذج المحملة في الذاكرة
        
        # طباعة معلومات مفيدة للتشخيص
        print(f"📁 مجلد النماذج: {self.models_dir}")
        
    def get_model_path(self, language: str) -> Optional[Path]:
        """
        الحصول على مسار النموذج للغة معينة
        يبحث في أماكن متعددة
        
        Args:
            language: رمز اللغة (ar, en, ko, ru, tr)
            
        Returns:
            مسار النموذج أو None إذا لم يكن موجوداً
        """
        if language not in self.MODELS:
            return None
        
        model_name = self.MODELS[language]['name']
        
        # قائمة الأماكن المحتملة للبحث
        search_paths = [
            # المكان الافتراضي
            self.models_dir / model_name,
            # في مجلد models المحلي
            Path(__file__).parent / 'models' / model_name,
            # في مجلد المشروع
            Path(__file__).parent.parent / 'models' / model_name,
            # في مجلد المستخدم
            Path.home() / 'models' / 'vosk' / model_name,
        ]
        
        # البحث في كل مكان
        for model_path in search_paths:
            if model_path.exists() and model_path.is_dir():
                # التحقق من وجود ملفات مهمة في النموذج
                am_file = model_path / 'am' / 'final.mdl'
                graph_file = model_path / 'graph' / 'HCLG.fst'
                # إذا وجد ملف واحد على الأقل، النموذج صحيح
                if am_file.exists() or graph_file.exists() or (model_path / 'conf' / 'mfcc.conf').exists():
                    return model_path
        
        # إذا لم يُعثر عليه، ربما الاسم مختلف قليلاً - البحث عن أي مجلد يحتوي على اسم مشابه
        for parent_dir in [self.models_dir, Path(__file__).parent / 'models']:
            if parent_dir.exists():
                for item in parent_dir.iterdir():
                    if item.is_dir() and (
                        model_name.lower() in item.name.lower() or 
                        item.name.lower().startswith(f'vosk-model-{language}')
                    ):
                        # التحقق من أن هذا مجلد نموذج صحيح
                        if (item / 'conf').exists() or (item / 'am').exists():
                            return item
        
        return None
    
    def is_model_downloaded(self, language: str) -> bool:
        """
        التحقق من تحميل النموذج
        
        Args:
            language: رمز اللغة
            
        Returns:
            True إذا كان النموذج محملاً
        """
        return self.get_model_path(language) is not None
    
    def download_model(
        self, 
        language: str, 
        progress_callback: Optional[Callable[[int, int], None]] = None
    ) -> bool:
        """
        تحميل نموذج لغة
        
        Args:
            language: رمز اللغة
            progress_callback: دالة callback للتقدم (downloaded, total)
            
        Returns:
            True إذا نجح التحميل
        """
        if language not in self.MODELS:
            print(f"❌ اللغة '{language}' غير مدعومة")
            return False
        
        if self.is_model_downloaded(language):
            print(f"✅ النموذج '{language}' محمل مسبقاً")
            return True
        
        model_info = self.MODELS[language]
        model_name = model_info['name']
        model_url = model_info['url']
        
        print(f"🔄 جاري تحميل نموذج {self.LANGUAGE_NAMES[language]}...")
        print(f"   الحجم: {model_info['size']}")
        print(f"   من: {model_url}")
        
        try:
            zip_path = self.models_dir / f"{model_name}.zip"
            
            def report_progress(block_num, block_size, total_size):
                """تقرير التقدم"""
                downloaded = block_num * block_size
                if total_size > 0:
                    percent = min(100, (downloaded * 100) // total_size)
                    downloaded_mb = downloaded / (1024 * 1024)
                    total_mb = total_size / (1024 * 1024)
                    print(f"\r   التقدم: {percent}% ({downloaded_mb:.1f}/{total_mb:.1f} MB)", end='')
                    
                    if progress_callback:
                        progress_callback(downloaded, total_size)
            
            urllib.request.urlretrieve(model_url, zip_path, reporthook=report_progress)
            print()  # سطر جديد بعد التقدم
            
            print(f"📦 جاري فك ضغط النموذج...")
            with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                zip_ref.extractall(self.models_dir)
            
            zip_path.unlink()
            
            print(f"✅ تم تحميل نموذج {self.LANGUAGE_NAMES[language]} بنجاح!")
            return True
            
        except Exception as e:
            print(f"❌ خطأ في تحميل النموذج: {e}")
            if zip_path.exists():
                zip_path.unlink()
            return False
    
    def download_all_models(
        self, 
        progress_callback: Optional[Callable[[str, int, int], None]] = None
    ) -> Dict[str, bool]:
        """
        تحميل جميع النماذج المدعومة
        
        Args:
            progress_callback: دالة callback للتقدم (language, downloaded, total)
            
        Returns:
            قاموس بنتائج التحميل لكل لغة
        """
        results = {}
        
        for language in self.MODELS.keys():
            print(f"\n{'='*60}")
            
            def lang_progress(downloaded, total):
                if progress_callback:
                    progress_callback(language, downloaded, total)
            
            results[language] = self.download_model(language, lang_progress)
        
        print(f"\n{'='*60}")
        print("📊 ملخص التحميل:")
        for lang, success in results.items():
            status = "✅" if success else "❌"
            print(f"   {status} {self.LANGUAGE_NAMES[lang]}")
        
        return results
    
    def get_available_languages(self) -> list:
        """
        الحصول على قائمة اللغات المتاحة (المحملة)
        
        Returns:
            قائمة برموز اللغات المتاحة
        """
        available = []
        for language in self.MODELS.keys():
            if self.is_model_downloaded(language):
                available.append(language)
        return available
    
    def get_all_languages(self) -> list:
        """
        الحصول على قائمة جميع اللغات المدعومة
        
        Returns:
            قائمة برموز جميع اللغات
        """
        return list(self.MODELS.keys())
    
    def get_language_name(self, language: str) -> str:
        """
        الحصول على اسم اللغة
        
        Args:
            language: رمز اللغة
            
        Returns:
            اسم اللغة
        """
        return self.LANGUAGE_NAMES.get(language, language)
    
    def get_model_info(self, language: str) -> Optional[Dict]:
        """
        الحصول على معلومات النموذج
        
        Args:
            language: رمز اللغة
            
        Returns:
            معلومات النموذج أو None
        """
        if language not in self.MODELS:
            return None
        
        info = self.MODELS[language].copy()
        info['downloaded'] = self.is_model_downloaded(language)
        info['path'] = str(self.get_model_path(language)) if info['downloaded'] else None
        
        return info
    
    def delete_model(self, language: str) -> bool:
        """
        حذف نموذج لغة
        
        Args:
            language: رمز اللغة
            
        Returns:
            True إذا نجح الحذف
        """
        model_path = self.get_model_path(language)
        if not model_path:
            return False
        
        try:
            import shutil
            shutil.rmtree(model_path)
            print(f"✅ تم حذف نموذج {self.LANGUAGE_NAMES[language]}")
            
            if language in self.loaded_models:
                del self.loaded_models[language]
            
            return True
        except Exception as e:
            print(f"❌ خطأ في حذف النموذج: {e}")
            return False
    
    def get_cache_info(self) -> Dict:
        """
        الحصول على معلومات الذاكرة المؤقتة
        
        Returns:
            معلومات الذاكرة المؤقتة
        """
        return {
            'loaded_models': list(self.loaded_models.keys()),
            'cache_size': len(self.loaded_models),
            'max_cache_size': self.max_cache_size
        }


def test_model_manager():
    """اختبار مدير النماذج"""
    print("🧪 اختبار مدير النماذج")
    print("=" * 60)
    
    manager = ModelManager()
    
    print(f"\n📁 مجلد النماذج: {manager.models_dir}")
    
    print("\n📋 اللغات المدعومة:")
    for lang in manager.get_all_languages():
        info = manager.get_model_info(lang)
        status = "✅ محمل" if info['downloaded'] else "❌ غير محمل"
        print(f"   {lang}: {info['description']} - {status}")
    
    print("\n✅ اللغات المتاحة:")
    available = manager.get_available_languages()
    if available:
        for lang in available:
            print(f"   - {manager.get_language_name(lang)} ({lang})")
    else:
        print("   لا توجد نماذج محملة")
    
    return manager


if __name__ == "__main__":
    test_model_manager()
