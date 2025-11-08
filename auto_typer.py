#!/usr/bin/env python3
"""
نظام الكتابة التلقائية مع دعم كامل للعربية
"""

import time
import threading
import platform

try:
    import keyboard
    KEYBOARD_AVAILABLE = True
except ImportError:
    KEYBOARD_AVAILABLE = False

try:
    import pyautogui
    PYAUTOGUI_AVAILABLE = True
except ImportError:
    PYAUTOGUI_AVAILABLE = False


class AutoTyper:
    """نظام الكتابة التلقائية في أي تطبيق"""
    
    def __init__(self, method='keyboard', delay=0.001):
        """
        تهيئة نظام الكتابة
        
        Args:
            method: طريقة الكتابة ('keyboard' أو 'pyautogui')
            delay: التأخير بين الأحرف (بالثواني) - محسّن للسرعة (افتراضي: 0.003)
        """
        self.method = method.lower()
        self.delay = delay
        self.is_enabled = True
        
        # اختيار الطريقة المتاحة
        if self.method == 'keyboard' and not KEYBOARD_AVAILABLE:
            if PYAUTOGUI_AVAILABLE:
                print("⚠️ keyboard غير متاح، استخدام pyautogui")
                self.method = 'pyautogui'
            else:
                raise ImportError("يجب تثبيت keyboard أو pyautogui")
        elif self.method == 'pyautogui' and not PYAUTOGUI_AVAILABLE:
            if KEYBOARD_AVAILABLE:
                print("⚠️ pyautogui غير متاح، استخدام keyboard")
                self.method = 'keyboard'
            else:
                raise ImportError("يجب تثبيت keyboard أو pyautogui")
        
        # إعداد Failsafe للـ pyautogui
        if self.method == 'pyautogui':
            pyautogui.FAILSAFE = True
    
    def type_text(self, text):
        """
        كتابة النص في التطبيق النشط
        
        Args:
            text: النص المراد كتابته
        """
        if not self.is_enabled:
            return
        
        if not text or not text.strip():
            return
        
        # إزالة التأخير تماماً لأقصى سرعة
        # time.sleep(0.005)  # تأخير أدنى إن لزم فقط
        
        try:
            if self.method == 'keyboard':
                self._type_with_keyboard(text)
            elif self.method == 'pyautogui':
                self._type_with_pyautogui(text)
        except Exception as e:
            print(f"❌ خطأ في الكتابة: {e}")
    
    def _type_with_keyboard(self, text):
        """الكتابة باستخدام مكتبة keyboard"""
        # keyboard.write يدعم Unicode والعربية بشكل جيد
        keyboard.write(text, delay=self.delay)
    
    def _type_with_pyautogui(self, text):
        """الكتابة باستخدام pyautogui"""
        # pyautogui.write قد لا يدعم العربية بشكل كامل
        # لذا نستخدم طريقة بديلة
        for char in text:
            if char == ' ':
                pyautogui.press('space')
            elif char == '\n':
                pyautogui.press('enter')
            else:
                # محاولة كتابة الحرف مباشرة
                try:
                    pyautogui.write(char, interval=self.delay)
                except:
                    # إذا فشلت، استخدم clipboard
                    self._type_with_clipboard(char)
            # تم تقليل التأخير - pyautogui.write يتعامل مع التأخير تلقائياً
    
    def _type_with_clipboard(self, text):
        """الكتابة باستخدام الحافظة (للأحرف العربية)"""
        try:
            import pyperclip
            original = pyperclip.paste()
            pyperclip.copy(text)
            
            if platform.system() == 'Darwin':
                pyautogui.hotkey('command', 'v')
            else:
                pyautogui.hotkey('ctrl', 'v')
            
            time.sleep(0.02)  # محسّن للسرعة
            pyperclip.copy(original)
        except ImportError:
            print("⚠️ يرجى تثبيت pyperclip لدعم أفضل للعربية")
        except Exception as e:
            print(f"❌ خطأ في استخدام الحافظة: {e}")
    
    def type_with_commands(self, text):
        """كتابة النص مع معالجة الأوامر الصوتية"""
        # قاموس الأوامر الصوتية
        commands = {
            "سطر جديد": "\n",
            "نقطة": ".",
            "فاصلة": "،",
            "فاصلة منقوطة": "؛",
            "نقطتان": ":",
            "علامة استفهام": "؟",
            "علامة تعجب": "!",
            "قوس مفتوح": "(",
            "قوس مغلق": ")",
            "مسافة": " ",
            "تاب": "\t",
        }
        
        # استبدال الأوامر
        for command, replacement in commands.items():
            if command in text:
                text = text.replace(command, replacement)
        
        self.type_text(text)
    
    def press_key(self, key):
        """الضغط على مفتاح معين"""
        try:
            if self.method == 'keyboard':
                keyboard.press_and_release(key)
            elif self.method == 'pyautogui':
                pyautogui.press(key)
        except Exception as e:
            print(f"❌ خطأ في الضغط على المفتاح: {e}")
    
    def press_hotkey(self, *keys):
        """الضغط على مجموعة مفاتيح"""
        try:
            if self.method == 'keyboard':
                keyboard.press_and_release('+'.join(keys))
            elif self.method == 'pyautogui':
                pyautogui.hotkey(*keys)
        except Exception as e:
            print(f"❌ خطأ في الضغط على المفاتيح: {e}")
    
    def enable(self):
        """تفعيل الكتابة"""
        self.is_enabled = True
    
    def disable(self):
        """تعطيل الكتابة"""
        self.is_enabled = False


class TextCorrector:
    """مصحح النص التلقائي للعربية"""
    
    def __init__(self):
        # قاموس التصحيحات الشائعة
        self.corrections = {
            # أخطاء شائعة في التعرف على الصوت
            "انتهت الفترة التجريبية المجانية": "",
            "شو": "ما هو",
            "ليش": "لماذا",
            "وين": "أين",
            "اش": "شيء",
            # إضافة المزيد حسب الحاجة
        }
        
        # قواعد التصحيح
        self.rules = []
    
    def correct(self, text):
        """تصحيح النص"""
        corrected = text
        
        # تطبيق التصحيحات من القاموس
        for wrong, correct in self.corrections.items():
            if wrong in corrected:
                if correct == "":
                    corrected = corrected.replace(wrong, "")
                else:
                    corrected = corrected.replace(wrong, correct)
        
        # تطبيق قواعد التصحيح
        for rule in self.rules:
            corrected = rule(corrected)
        
        return corrected.strip()
    
    def add_correction(self, wrong, correct):
        """إضافة تصحيح جديد"""
        self.corrections[wrong] = correct
    
    def add_rule(self, rule_func):
        """إضافة قاعدة تصحيح جديدة"""
        self.rules.append(rule_func)


def test_typer():
    """اختبار نظام الكتابة"""
    print("🧪 اختبار نظام الكتابة التلقائية")
    print("=" * 50)
    
    try:
        typer = AutoTyper(method='keyboard')
        print("✅ تم تهيئة نظام الكتابة بنجاح!")
        
        print("\n💡 سيتم كتابة نص تجريبي خلال 3 ثوان...")
        time.sleep(3)
        
        test_text = "مرحباً، هذا اختبار لنظام الكتابة التلقائية باللغة العربية! 🎉"
        typer.type_text(test_text)
        
        print("✅ تم كتابة النص بنجاح!")
        return typer
        
    except Exception as e:
        print(f"❌ خطأ في اختبار نظام الكتابة: {e}")
        return None


if __name__ == "__main__":
    typer = test_typer()

