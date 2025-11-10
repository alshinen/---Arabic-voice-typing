#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
سكريبت اختبار شامل لجميع محركات التصحيح الإملائي
يختبر كل محرك ويقارن الأداء والدقة
"""

import sys
import time
from spell_checker import SpellChecker, get_available_engines

# نصوص اختبار بلغات مختلفة
TEST_TEXTS = {
    'en': {
        'text': 'I have an eror in this sentance and it is verry bad',
        'expected': 'I have an error in this sentence and it is very bad',
        'name': 'الإنجليزية'
    },
    'ar': {
        'text': 'مرحبا انا اسمى احمد وانا من مصر',
        'expected': 'مرحباً أنا اسمي أحمد وأنا من مصر',
        'name': 'العربية'
    },
    'es': {
        'text': 'Hola mi nomre es Ahmed y tengo un eror',
        'expected': 'Hola mi nombre es Ahmed y tengo un error',
        'name': 'الإسبانية'
    },
    'fr': {
        'text': 'Je vais au magasin aujourdhui',
        'expected': "Je vais au magasin aujourd'hui",
        'name': 'الفرنسية'
    }
}

def test_engine(engine_name: str, language: str, text: str, expected: str):
    """اختبار محرك واحد"""
    try:
        # قياس الوقت
        start_time = time.time()
        
        # إنشاء المصحح
        checker = SpellChecker(language=language, auto_correct=True, engine=engine_name)
        
        if not checker.enabled:
            return None
        
        # التصحيح
        corrected = checker.check_and_correct(text, verbose=False)
        
        # حساب الوقت
        elapsed = (time.time() - start_time) * 1000  # ميلي ثانية
        
        # حساب الدقة
        accuracy = calculate_accuracy(corrected, expected)
        
        # تنظيف
        checker.close()
        
        return {
            'engine': engine_name,
            'corrected': corrected,
            'time_ms': round(elapsed, 2),
            'accuracy': accuracy,
            'success': True
        }
    
    except Exception as e:
        return {
            'engine': engine_name,
            'error': str(e),
            'success': False
        }

def calculate_accuracy(result: str, expected: str) -> float:
    """حساب دقة التصحيح"""
    if result == expected:
        return 100.0
    
    # حساب بسيط بناءً على عدد الكلمات الصحيحة
    result_words = result.lower().split()
    expected_words = expected.lower().split()
    
    correct = sum(1 for r, e in zip(result_words, expected_words) if r == e)
    total = max(len(result_words), len(expected_words))
    
    return round((correct / total) * 100, 1) if total > 0 else 0.0

def print_header():
    """طباعة رأس التقرير"""
    print("\n" + "=" * 80)
    print("🔍 اختبار شامل لجميع محركات التصحيح الإملائي")
    print("=" * 80)

def print_results(language: str, lang_name: str, results: list):
    """طباعة نتائج الاختبار"""
    print(f"\n📝 اللغة: {lang_name} ({language})")
    print("─" * 80)
    
    if not results:
        print("   ❌ لا توجد محركات متاحة لهذه اللغة")
        return
    
    # ترتيب حسب الدقة
    results.sort(key=lambda x: (x.get('accuracy', 0), -x.get('time_ms', 999999)), reverse=True)
    
    print(f"\n   {'المحرك':<20} │ {'الدقة':<8} │ {'الوقت':<12} │ الحالة")
    print(f"   {'─' * 20}┼{'─' * 10}┼{'─' * 14}┼{'─' * 20}")
    
    for r in results:
        if r['success']:
            status = "✅ نجح"
            accuracy = f"{r['accuracy']}%"
            time_str = f"{r['time_ms']} ms"
        else:
            status = "❌ فشل"
            accuracy = "N/A"
            time_str = "N/A"
        
        print(f"   {r['engine']:<20} │ {accuracy:<8} │ {time_str:<12} │ {status}")
    
    # عرض أفضل نتيجة
    if results and results[0]['success']:
        best = results[0]
        print(f"\n   🏆 الأفضل: {best['engine']} (دقة: {best['accuracy']}%، وقت: {best['time_ms']} ms)")

def print_summary(all_results: dict):
    """طباعة ملخص شامل"""
    print("\n" + "=" * 80)
    print("📊 الملخص الشامل")
    print("=" * 80)
    
    # حساب متوسط الدقة والوقت لكل محرك
    engine_stats = {}
    
    for lang, results in all_results.items():
        for r in results:
            if r['success']:
                engine = r['engine']
                if engine not in engine_stats:
                    engine_stats[engine] = {'accuracy': [], 'time': []}
                
                engine_stats[engine]['accuracy'].append(r['accuracy'])
                engine_stats[engine]['time'].append(r['time_ms'])
    
    if engine_stats:
        print(f"\n{'المحرك':<20} │ {'متوسط الدقة':<15} │ {'متوسط الوقت':<15} │ التقييم")
        print(f"{'─' * 20}┼{'─' * 17}┼{'─' * 17}┼{'─' * 20}")
        
        # ترتيب حسب الدقة
        sorted_engines = sorted(
            engine_stats.items(),
            key=lambda x: sum(x[1]['accuracy']) / len(x[1]['accuracy']),
            reverse=True
        )
        
        for engine, stats in sorted_engines:
            avg_acc = sum(stats['accuracy']) / len(stats['accuracy'])
            avg_time = sum(stats['time']) / len(stats['time'])
            
            # تقييم
            if avg_acc >= 95:
                rating = "⭐⭐⭐⭐⭐ ممتاز"
            elif avg_acc >= 85:
                rating = "⭐⭐⭐⭐ جيد جداً"
            elif avg_acc >= 75:
                rating = "⭐⭐⭐ جيد"
            else:
                rating = "⭐⭐ مقبول"
            
            print(f"{engine:<20} │ {avg_acc:>6.1f}%        │ {avg_time:>7.2f} ms      │ {rating}")
    
    print("\n" + "=" * 80)

def main():
    """الدالة الرئيسية"""
    print_header()
    
    # عرض المحركات المتاحة
    available = get_available_engines()
    print(f"\n💡 المحركات المتاحة: {', '.join(available) if available else 'لا شيء'}")
    
    if not available:
        print("\n❌ لا توجد محركات مثبتة!")
        print("\n💡 لتثبيت المحركات:")
        print("   python INSTALL_ALL_SPELLCHECKERS.bat")
        return
    
    print(f"\n📊 سيتم اختبار {len(TEST_TEXTS)} لغات × {len(available)} محركات\n")
    
    all_results = {}
    
    # اختبار كل لغة مع كل محرك
    for lang, data in TEST_TEXTS.items():
        text = data['text']
        expected = data['expected']
        lang_name = data['name']
        
        results = []
        
        for engine in available:
            result = test_engine(engine, lang, text, expected)
            if result:
                results.append(result)
        
        all_results[lang] = results
        print_results(lang, lang_name, results)
        
        # طباعة النص الأصلي والمتوقع
        print(f"\n   📌 النص الأصلي:   {text}")
        print(f"   ✅ النص المتوقع:   {expected}")
        
        if results and results[0]['success']:
            print(f"   🔧 النص المصحح:  {results[0]['corrected']}")
    
    # طباعة الملخص
    print_summary(all_results)
    
    print("\n✅ انتهى الاختبار!")
    print("\n💡 التوصية النهائية:")
    print("   - للدقة القصوى: استخدم LanguageTool")
    print("   - للسرعة القصوى: استخدم Jamspell أو Symspellpy")
    print("   - للتوازن: استخدم LanguageTool + Jamspell معاً")

if __name__ == "__main__":
    main()
