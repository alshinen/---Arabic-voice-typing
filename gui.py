#!/usr/bin/env python3
"""
واجهة المستخدم الرسومية للبرنامج
باستخدام CustomTkinter لمظهر عصري
"""

import tkinter as tk
from tkinter import messagebox, filedialog
import threading
import os
import sys

try:
    import customtkinter as ctk
    CUSTOMTK_AVAILABLE = True
except ImportError:
    CUSTOMTK_AVAILABLE = False
    # استخدام tkinter العادي كبديل
    import tkinter as ctk

try:
    from PIL import Image, ImageTk
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False


class VoiceTypingGUI:
    """واجهة المستخدم الرئيسية"""
    
    def __init__(self, recognizer=None, typer=None, model_manager=None):
        """
        تهيئة الواجهة
        
        Args:
            recognizer: كائن SpeechRecognizer
            typer: كائن AutoTyper
            model_manager: كائن ModelManager
        """
        self.recognizer = recognizer
        self.typer = typer
        self.model_manager = model_manager
        self.is_listening = False
        self.listening_thread = None
        self.current_text = ""
        self.current_language = 'ar'
        self.offline_mode = 'offline_first'
        self.auto_type_enabled = tk.BooleanVar(value=True)  # الكتابة التلقائية مفعلة افتراضياً
        
        # إنشاء النافذة الرئيسية
        if CUSTOMTK_AVAILABLE:
            self.root = ctk.CTk()
            self._use_customtkinter()
        else:
            self.root = tk.Tk()
            self._use_tkinter()
        
        self.root.title("🎤 برنامج الكتابة بالصوت - Voice Typing")
        self.root.geometry("600x700")
        self.root.minsize(500, 600)  # حد أدنى للحجم لضمان ظهور جيد
        self.root.resizable(True, True)
        
        # إعداد الواجهة
        self.setup_ui()
        
        # إعداد الأحداث
        self.root.protocol("WM_DELETE_WINDOW", self.on_closing)
        
        # تحديث الواجهة للتأكد من ظهورها بشكل صحيح
        self.root.update_idletasks()
        self.root.update()
        
    def _use_customtkinter(self):
        """إعداد CustomTkinter"""
        ctk.set_appearance_mode("dark")  # أو "light" أو "system"
        ctk.set_default_color_theme("blue")
        
    def _use_tkinter(self):
        """إعداد Tkinter العادي"""
        self.root.configure(bg="#2b2b2b")
        
    def setup_ui(self):
        """إعداد واجهة المستخدم"""
        
        # العنوان الرئيسي
        if CUSTOMTK_AVAILABLE:
            title = ctk.CTkLabel(
                self.root,
                text="🎤 برنامج الكتابة بالصوت",
                font=("Arial", 24, "bold"),
                text_color="#4a9eff"
            )
        else:
            title = tk.Label(
                self.root,
                text="🎤 برنامج الكتابة بالصوت",
                font=("Arial", 24, "bold"),
                bg="#2b2b2b",
                fg="#4a9eff"
            )
        title.pack(pady=20)
        
        settings_frame = self._create_frame()
        settings_frame.pack(pady=10, padx=20, fill="x")
        
        if CUSTOMTK_AVAILABLE:
            lang_label = ctk.CTkLabel(
                settings_frame,
                text="🌍 اللغة:",
                font=("Arial", 12)
            )
        else:
            lang_label = tk.Label(
                settings_frame,
                text="🌍 اللغة:",
                font=("Arial", 12),
                bg="#2b2b2b",
                fg="white"
            )
        lang_label.pack(side="left", padx=5)
        
        # استخدام قائمة اللغات من model_manager أو قائمة افتراضية
        if self.model_manager:
            try:
                languages = {code: self.model_manager.get_language_name(code) 
                            for code in self.model_manager.get_all_languages()}
            except:
                languages = self._get_default_languages()
        else:
            languages = self._get_default_languages()
        
        self.language_map = {v: k for k, v in languages.items()}
        self.language_names = languages
        
        default_lang_name = languages.get('ar', 'العربية')
        
        if CUSTOMTK_AVAILABLE:
            self.language_var = tk.StringVar(value=default_lang_name)
            self.language_combo = ctk.CTkOptionMenu(
                settings_frame,
                values=list(languages.values()),
                command=self.on_language_change,
                variable=self.language_var,
                width=150
            )
        else:
            self.language_var = tk.StringVar(value=default_lang_name)
            self.language_combo = tk.OptionMenu(
                settings_frame,
                self.language_var,
                *languages.values(),
                command=self.on_language_change
            )
            self.language_combo.config(bg="#3b3b3b", fg="white", width=15)
        self.language_combo.pack(side="left", padx=5)
        
        if CUSTOMTK_AVAILABLE:
            mode_label = ctk.CTkLabel(
                settings_frame,
                text="📡 الوضع:",
                font=("Arial", 12)
            )
        else:
            mode_label = tk.Label(
                settings_frame,
                text="📡 الوضع:",
                font=("Arial", 12),
                bg="#2b2b2b",
                fg="white"
            )
        mode_label.pack(side="left", padx=5)
        
        modes = ['بدون إنترنت فقط', 'بدون إنترنت أولاً', 'مع إنترنت']
        if CUSTOMTK_AVAILABLE:
            self.mode_var = tk.StringVar(value='بدون إنترنت أولاً')
            self.mode_combo = ctk.CTkOptionMenu(
                settings_frame,
                values=modes,
                command=self.on_mode_change,
                variable=self.mode_var,
                width=150
            )
        else:
            self.mode_var = tk.StringVar(value='بدون إنترنت أولاً')
            self.mode_combo = tk.OptionMenu(
                settings_frame,
                self.mode_var,
                *modes,
                command=self.on_mode_change
            )
            self.mode_combo.config(bg="#3b3b3b", fg="white", width=15)
        self.mode_combo.pack(side="left", padx=5)
        
        if CUSTOMTK_AVAILABLE:
            download_btn = ctk.CTkButton(
                settings_frame,
                text="⬇️ تحميل",
                command=self.download_models,
                width=100,
                height=30,
                fg_color="#17a2b8",
                hover_color="#138496"
            )
        else:
            download_btn = tk.Button(
                settings_frame,
                text="⬇️ تحميل",
                command=self.download_models,
                width=10,
                bg="#17a2b8",
                fg="white",
                activebackground="#138496",
                cursor="hand2"
            )
        download_btn.pack(side="left", padx=5)
        
        # خيار تفعيل/تعطيل الكتابة التلقائية
        auto_type_frame = self._create_frame()
        auto_type_frame.pack(pady=5, padx=20, fill="x")
        
        if CUSTOMTK_AVAILABLE:
            self.auto_type_checkbox = ctk.CTkCheckBox(
                auto_type_frame,
                text="⌨️ كتابة تلقائية في التطبيق النشط",
                variable=self.auto_type_enabled,
                font=("Arial", 12),
                onvalue=True,
                offvalue=False
            )
        else:
            self.auto_type_checkbox = tk.Checkbutton(
                auto_type_frame,
                text="⌨️ كتابة تلقائية في التطبيق النشط",
                variable=self.auto_type_enabled,
                font=("Arial", 12),
                bg="#2b2b2b",
                fg="white",
                selectcolor="#2b2b2b",
                activebackground="#2b2b2b",
                activeforeground="white"
            )
        self.auto_type_checkbox.pack(anchor="w", padx=10)
        
        # إطار الحالة
        self.status_frame = self._create_frame()
        self.status_frame.pack(pady=10, padx=20, fill="x")
        
        # ملصق الحالة
        if CUSTOMTK_AVAILABLE:
            self.status_label = ctk.CTkLabel(
                self.status_frame,
                text="📡 الحالة: جاهز",
                font=("Arial", 12),
                text_color="#00ff00"
            )
        else:
            self.status_label = tk.Label(
                self.status_frame,
                text="📡 الحالة: جاهز",
                font=("Arial", 12),
                bg="#2b2b2b",
                fg="#00ff00"
            )
        self.status_label.pack()
        
        # زر التحكم الرئيسي
        self.control_frame = self._create_frame()
        self.control_frame.pack(pady=20, padx=20, fill="x")
        
        if CUSTOMTK_AVAILABLE:
            self.record_button = ctk.CTkButton(
                self.control_frame,
                text="🎙️ ابدأ التسجيل",
                command=self.toggle_recording,
                font=("Arial", 18, "bold"),
                width=300,
                height=60,
                corner_radius=10,
                fg_color="#4a9eff",
                hover_color="#357abd"
            )
        else:
            self.record_button = tk.Button(
                self.control_frame,
                text="🎙️ ابدأ التسجيل",
                command=self.toggle_recording,
                font=("Arial", 18, "bold"),
                width=30,
                height=3,
                bg="#4a9eff",
                fg="white",
                activebackground="#357abd",
                cursor="hand2"
            )
        self.record_button.pack(pady=10)
        
        # إطار عرض النص
        text_frame = self._create_frame()
        text_frame.pack(pady=10, padx=20, fill="both", expand=True)
        
        # عنوان منطقة النص
        if CUSTOMTK_AVAILABLE:
            text_title = ctk.CTkLabel(
                text_frame,
                text="📝 النص المحول:",
                font=("Arial", 14, "bold")
            )
            text_title.pack(anchor="w", pady=(0, 5))
        else:
            text_title = tk.Label(
                text_frame,
                text="📝 النص المحول:",
                font=("Arial", 14, "bold"),
                bg="#2b2b2b",
                fg="white",
                anchor="w"
            )
            text_title.pack(anchor="w", pady=(0, 5))
        
        # منطقة عرض النص
        if CUSTOMTK_AVAILABLE:
            self.text_display = ctk.CTkTextbox(
                text_frame,
                width=550,
                height=200,
                font=("Arial", 14),
                wrap="word"
            )
        else:
            # إنشاء Text widget مع scrollbar
            text_container = tk.Frame(text_frame, bg="#2b2b2b")
            text_container.pack(fill="both", expand=True)
            
            scrollbar = tk.Scrollbar(text_container)
            scrollbar.pack(side="right", fill="y")
            
            self.text_display = tk.Text(
                text_container,
                width=60,
                height=12,
                font=("Arial", 14),
                wrap="word",
                bg="#1e1e1e",
                fg="white",
                insertbackground="white",
                yscrollcommand=scrollbar.set,
                padx=10,
                pady=10
            )
            scrollbar.config(command=self.text_display.yview)
            self.text_display.pack(side="left", fill="both", expand=True)
        
        self.text_display.pack(fill="both", expand=True, pady=(0, 10))
        
        # ═══════════════════════════════════════════════════════════
        # قسم الترجمة الجديد
        # ═══════════════════════════════════════════════════════════
        translation_frame = self._create_frame()
        translation_frame.pack(pady=10, padx=20, fill="x")
        
        # عنوان قسم الترجمة
        if CUSTOMTK_AVAILABLE:
            trans_title = ctk.CTkLabel(
                translation_frame,
                text="🌍 الترجمة:",
                font=("Arial", 14, "bold"),
                text_color="#4a9eff"
            )
        else:
            trans_title = tk.Label(
                translation_frame,
                text="🌍 الترجمة:",
                font=("Arial", 14, "bold"),
                bg="#2b2b2b",
                fg="#4a9eff"
            )
        trans_title.pack(anchor="w", pady=(0, 10))
        
        # إطار اختيار اللغات
        lang_select_frame = self._create_frame()
        lang_select_frame.pack(fill="x", pady=5)
        
        # قائمة اللغات المتاحة للترجمة
        self.translation_languages = {
            'العربية': 'ar',
            'English': 'en',
            'Français': 'fr',
            'Español': 'es',
            'Deutsch': 'de',
            'Italiano': 'it',
            'Português': 'pt',
            '中文': 'zh',
            '日本語': 'ja',
            '한국어': 'ko',
            'Русский': 'ru',
            'Türkçe': 'tr',
            'فارسی': 'fa',
            'हिन्दी': 'hi',
            'Filipino': 'tl'
        }
        
        # من لغة
        if CUSTOMTK_AVAILABLE:
            from_label = ctk.CTkLabel(
                lang_select_frame,
                text="من:",
                font=("Arial", 12)
            )
        else:
            from_label = tk.Label(
                lang_select_frame,
                text="من:",
                font=("Arial", 12),
                bg="#2b2b2b",
                fg="white"
            )
        from_label.pack(side="left", padx=5)
        
        self.from_lang_var = tk.StringVar(value='العربية')
        if CUSTOMTK_AVAILABLE:
            self.from_lang_combo = ctk.CTkOptionMenu(
                lang_select_frame,
                values=list(self.translation_languages.keys()),
                variable=self.from_lang_var,
                width=150
            )
        else:
            self.from_lang_combo = tk.OptionMenu(
                lang_select_frame,
                self.from_lang_var,
                *self.translation_languages.keys()
            )
            self.from_lang_combo.config(bg="#3b3b3b", fg="white", width=12)
        self.from_lang_combo.pack(side="left", padx=5)
        
        # سهم
        if CUSTOMTK_AVAILABLE:
            arrow_label = ctk.CTkLabel(
                lang_select_frame,
                text="→",
                font=("Arial", 16, "bold")
            )
        else:
            arrow_label = tk.Label(
                lang_select_frame,
                text="→",
                font=("Arial", 16, "bold"),
                bg="#2b2b2b",
                fg="white"
            )
        arrow_label.pack(side="left", padx=5)
        
        # إلى لغة
        if CUSTOMTK_AVAILABLE:
            to_label = ctk.CTkLabel(
                lang_select_frame,
                text="إلى:",
                font=("Arial", 12)
            )
        else:
            to_label = tk.Label(
                lang_select_frame,
                text="إلى:",
                font=("Arial", 12),
                bg="#2b2b2b",
                fg="white"
            )
        to_label.pack(side="left", padx=5)
        
        self.to_lang_var = tk.StringVar(value='English')
        if CUSTOMTK_AVAILABLE:
            self.to_lang_combo = ctk.CTkOptionMenu(
                lang_select_frame,
                values=list(self.translation_languages.keys()),
                variable=self.to_lang_var,
                width=150
            )
        else:
            self.to_lang_combo = tk.OptionMenu(
                lang_select_frame,
                self.to_lang_var,
                *self.translation_languages.keys()
            )
            self.to_lang_combo.config(bg="#3b3b3b", fg="white", width=12)
        self.to_lang_combo.pack(side="left", padx=5)
        
        # زر الترجمة
        if CUSTOMTK_AVAILABLE:
            self.translate_btn = ctk.CTkButton(
                lang_select_frame,
                text="🔄 ترجم",
                command=self.translate_text,
                width=120,
                height=35,
                fg_color="#17a2b8",
                hover_color="#138496"
            )
        else:
            self.translate_btn = tk.Button(
                lang_select_frame,
                text="🔄 ترجم",
                command=self.translate_text,
                width=12,
                bg="#17a2b8",
                fg="white",
                activebackground="#138496",
                cursor="hand2"
            )
        self.translate_btn.pack(side="left", padx=10)
        
        # منطقة عرض الترجمة
        trans_display_frame = self._create_frame()
        trans_display_frame.pack(fill="x", pady=5)
        
        if CUSTOMTK_AVAILABLE:
            self.translation_display = ctk.CTkTextbox(
                trans_display_frame,
                width=550,
                height=100,
                font=("Arial", 13),
                wrap="word"
            )
        else:
            trans_container = tk.Frame(trans_display_frame, bg="#2b2b2b")
            trans_container.pack(fill="both", expand=True)
            
            trans_scrollbar = tk.Scrollbar(trans_container)
            trans_scrollbar.pack(side="right", fill="y")
            
            self.translation_display = tk.Text(
                trans_container,
                width=60,
                height=5,
                font=("Arial", 13),
                wrap="word",
                bg="#1e1e1e",
                fg="#00ff00",
                insertbackground="white",
                yscrollcommand=trans_scrollbar.set,
                padx=10,
                pady=10
            )
            trans_scrollbar.config(command=self.translation_display.yview)
            self.translation_display.pack(side="left", fill="both", expand=True)
        
        self.translation_display.pack(fill="x", pady=5)
        self.translation_display.insert("1.0", "الترجمة ستظهر هنا...")
        
        # ═══════════════════════════════════════════════════════════
        
        # إطار الأزرار الإضافية
        buttons_frame = self._create_frame()
        buttons_frame.pack(pady=10, padx=20, fill="x")
        
        # زر النسخ
        if CUSTOMTK_AVAILABLE:
            copy_btn = ctk.CTkButton(
                buttons_frame,
                text="📋 نسخ",
                command=self.copy_text,
                width=120,
                height=40,
                fg_color="#28a745",
                hover_color="#218838"
            )
        else:
            copy_btn = tk.Button(
                buttons_frame,
                text="📋 نسخ",
                command=self.copy_text,
                width=15,
                height=2,
                bg="#28a745",
                fg="white",
                activebackground="#218838",
                cursor="hand2"
            )
        copy_btn.pack(side="left", padx=5)
        
        # زر المسح
        if CUSTOMTK_AVAILABLE:
            clear_btn = ctk.CTkButton(
                buttons_frame,
                text="🗑️ مسح",
                command=self.clear_text,
                width=120,
                height=40,
                fg_color="#dc3545",
                hover_color="#c82333"
            )
        else:
            clear_btn = tk.Button(
                buttons_frame,
                text="🗑️ مسح",
                command=self.clear_text,
                width=15,
                height=2,
                bg="#dc3545",
                fg="white",
                activebackground="#c82333",
                cursor="hand2"
            )
        clear_btn.pack(side="left", padx=5)
        
        # زر الإعدادات
        if CUSTOMTK_AVAILABLE:
            settings_btn = ctk.CTkButton(
                buttons_frame,
                text="⚙️ إعدادات",
                command=self.show_settings,
                width=120,
                height=40,
                fg_color="#6c757d",
                hover_color="#5a6268"
            )
        else:
            settings_btn = tk.Button(
                buttons_frame,
                text="⚙️ إعدادات",
                command=self.show_settings,
                width=15,
                height=2,
                bg="#6c757d",
                fg="white",
                activebackground="#5a6268",
                cursor="hand2"
            )
        settings_btn.pack(side="left", padx=5)
        
        # معلومات إضافية
        if CUSTOMTK_AVAILABLE:
            info_label = ctk.CTkLabel(
                self.root,
                text="💡 اضغط 'ابدأ التسجيل' وتحدث في الميكروفون",
                font=("Arial", 10),
                text_color="#888888"
            )
        else:
            info_label = tk.Label(
                self.root,
                text="💡 اضغط 'ابدأ التسجيل' وتحدث في الميكروفون",
                font=("Arial", 10),
                bg="#2b2b2b",
                fg="#888888"
            )
        info_label.pack(pady=5)
        
    def _get_default_languages(self):
        """الحصول على قائمة اللغات الافتراضية"""
        return {
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
            
    def _create_frame(self):
        """إنشاء إطار جديد"""
        if CUSTOMTK_AVAILABLE:
            return ctk.CTkFrame(self.root)
        else:
            frame = tk.Frame(self.root, bg="#2b2b2b")
            return frame
            
    def toggle_recording(self):
        """تبديل حالة التسجيل"""
        if not self.is_listening:
            self.start_listening()
        else:
            self.stop_listening()
            
    def start_listening(self):
        """بدء الاستماع"""
        # محاولة إنشاء recognizer إذا لم يكن موجوداً
        if not self.recognizer:
            print("\n🔄 جاري تحميل محرك التعرف على الصوت...")
            
            # محاولة استخدام Vosk أولاً
            try:
                from speech_recognizer import SpeechRecognizer
                
                # محاولة Vosk إذا كان النموذج موجوداً
                if self.model_manager:
                    model_path = self.model_manager.get_model_path(self.current_language)
                    if model_path:
                        try:
                            self.update_status("🔄 جاري تحميل نموذج Vosk...", "#ffaa00")
                            self.recognizer = SpeechRecognizer(
                                engine='vosk',
                                language=self.current_language,
                                model_path=str(model_path),
                                use_google_fallback=True,
                                offline_only=False
                            )
                            print("✅ تم تحميل محرك Vosk بنجاح")
                            self.update_status("✅ تم تحميل Vosk", "#00ff00")
                        except Exception as e:
                            print(f"⚠️ فشل في تحميل Vosk: {e}")
                            self.recognizer = None
                
                # إذا فشل Vosk، حاول Google
                if not self.recognizer:
                    try:
                        self.update_status("🔄 جاري استخدام Google...", "#ffaa00")
                        self.recognizer = SpeechRecognizer(
                            engine='google',
                            language=self.current_language,
                            use_google_fallback=False,
                            offline_only=False
                        )
                        print("✅ تم استخدام Google Speech Recognition")
                        self.update_status("✅ جاهز مع Google", "#00ff00")
                    except Exception as e2:
                        print(f"⚠️ فشل في استخدام Google: {e2}")
                        self.recognizer = None
                        
            except ImportError as e:
                error_msg = (
                    "محرك التعرف على الصوت غير متاح!\n\n"
                    "الحلول:\n"
                    "1. للعمل بدون إنترنت:\n"
                    "   - قم بتثبيت Vosk: pip install vosk\n"
                    "   - استخدم زر 'تحميل' لتحميل النموذج العربي\n\n"
                    "2. للعمل مع إنترنت:\n"
                    "   - قم بتثبيت SpeechRecognition: pip install SpeechRecognition\n"
                    "   - تأكد من اتصال الإنترنت"
                )
                messagebox.showerror("خطأ", error_msg)
                self.update_status("❌ فشل التحميل", "#ff0000")
                return
        
        # إذا لم يتمكن من إنشاء recognizer
        if not self.recognizer:
            error_msg = (
                "محرك التعرف على الصوت غير متاح!\n\n"
                "الحلول:\n"
                "1. للعمل بدون إنترنت:\n"
                "   - قم بتثبيت Vosk: pip install vosk\n"
                "   - استخدم زر 'تحميل' لتحميل النموذج العربي\n\n"
                "2. للعمل مع إنترنت:\n"
                "   - قم بتثبيت SpeechRecognition: pip install SpeechRecognition\n"
                "   - تأكد من اتصال الإنترنت"
            )
            messagebox.showerror("خطأ", error_msg)
            self.update_status("❌ المحرك غير متاح", "#ff0000")
            return
        
        # إنشاء typer إذا لم يكن موجوداً
        if not self.typer:
            print("\n⌨️ جاري تهيئة نظام الكتابة...")
            try:
                from auto_typer import AutoTyper
                self.typer = AutoTyper(method='keyboard', delay=0.001)
                print("✅ تم تهيئة نظام الكتابة (keyboard)")
            except Exception as e:
                print(f"⚠️ فشل keyboard: {e}")
                try:
                    from auto_typer import AutoTyper
                    self.typer = AutoTyper(method='pyautogui', delay=0.001)
                    print("✅ تم تهيئة نظام الكتابة (pyautogui)")
                except Exception as e2:
                    print(f"❌ فشل نظام الكتابة: {e2}")
                    error_msg = (
                        "نظام الكتابة غير متاح!\n\n"
                        "الحل:\n"
                        "قم بتثبيت إحدى المكتبات التالية:\n"
                        "  - pip install keyboard (موصى به)\n"
                        "  - pip install pyautogui (بديل)\n\n"
                        "ثم أعد تشغيل البرنامج."
                    )
                    messagebox.showerror("خطأ", error_msg)
                    self.update_status("❌ الكتابة غير متاحة", "#ff0000")
                    return
            
        self.is_listening = True
        
        # تحديث الواجهة
        if CUSTOMTK_AVAILABLE:
            self.record_button.configure(
                text="⏹️ أوقف التسجيل",
                fg_color="#dc3545",
                hover_color="#c82333"
            )
        else:
            self.record_button.configure(
                text="⏹️ أوقف التسجيل",
                bg="#dc3545",
                activebackground="#c82333"
            )
        
        self.update_status("🎙️ جاري الاستماع...", "#ffff00")
        
        # طباعة معلومات للتشخيص
        print("\n" + "="*50)
        print("🎬 بدء التسجيل:")
        print(f"   ✅ Recognizer: {self.recognizer is not None}")
        print(f"   ✅ Typer: {self.typer is not None}")
        print(f"   ✅ اللغة: {self.current_language}")
        print(f"   ✅ المحرك: {self.recognizer.engine if self.recognizer else 'غير معروف'}")
        print("="*50)
        
        # بدء الاستماع في خيط منفصل
        self.listening_thread = threading.Thread(
            target=self._listen_continuous,
            daemon=True
        )
        self.listening_thread.start()
        
    def stop_listening(self):
        """إيقاف الاستماع بشكل آمن"""
        print("\n⏹️ طلب إيقاف التسجيل...")
        self.is_listening = False
        
        # إيقاف التسجيل في thread منفصل لمنع التجميد
        def stop_in_background():
            if self.recognizer:
                try:
                    self.recognizer.stop_recording()
                except Exception as e:
                    print(f"⚠️ خطأ في إيقاف التسجيل: {e}")
            
            # الانتظار لإيقاف الـ thread
            if self.listening_thread and self.listening_thread.is_alive():
                try:
                    self.listening_thread.join(timeout=1.0)  # تقليل الوقت من 2 إلى 1 ثانية
                except:
                    pass
            
            # تحديث الواجهة في الخيط الرئيسي
            self.root.after(0, self._update_ui_after_stop)
        
        # بدء الإيقاف في خيط منفصل
        stop_thread = threading.Thread(target=stop_in_background, daemon=True)
        stop_thread.start()
    
    def _update_ui_after_stop(self):
        """تحديث الواجهة بعد الإيقاف"""
        try:
            if CUSTOMTK_AVAILABLE:
                self.record_button.configure(
                    text="🎙️ ابدأ التسجيل",
                    fg_color="#4a9eff",
                    hover_color="#357abd"
                )
            else:
                self.record_button.configure(
                    text="🎙️ ابدأ التسجيل",
                    bg="#4a9eff",
                    activebackground="#357abd"
                )
            
            self.update_status("⏸️ متوقف", "#00ff00")
            print("✅ تم إيقاف التسجيل بنجاح")
        except Exception as e:
            print(f"⚠️ خطأ في تحديث الواجهة: {e}")
        
    def _listen_continuous(self):
        """حلقة الاستماع المستمر"""
        try:
            print("\n🎤 بدء الاستماع المستمر...")
            print(f"   المحرك: {self.recognizer.engine if self.recognizer else 'غير موجود'}")
            
            def on_text_recognized(text):
                """استدعاء عند التعرف على نص"""
                print(f"🔊 تم التعرف على نص: '{text}'")
                if text and text.strip():
                    self.current_text = text
                    # إضافة النص للواجهة
                    self.root.after(0, self._add_text_to_display, text)
                    # كتابة النص في التطبيق النشط (فقط إذا كان مفعّلاً)
                    if self.auto_type_enabled.get() and self.typer:
                        print(f"⌨️ جاري الكتابة: '{text}'")
                        try:
                            # إزالة المسافة الزائدة - النص فقط
                            self.typer.type_text(text)
                            print("✅ تم الكتابة بنجاح")
                        except Exception as e:
                            print(f"❌ خطأ في الكتابة: {e}")
                    elif not self.auto_type_enabled.get():
                        print("ℹ️ الكتابة التلقائية معطلة")
                    else:
                        print("⚠️ typer غير متاح")
            
            # بدء الاستماع المستمر (محسّن للسرعة)
            print("🎧 جاري الاستماع... تكلم الآن!")
            self.recognizer.listen_continuous(
                callback=on_text_recognized,
                phrase_time_limit=8,  # 8 ثوان - جمل أطول
                pause_threshold=0.8   # 0.8 ثانية - توقيت أفضل
            )
            
        except Exception as e:
            print(f"❌ خطأ في الاستماع: {e}")
            import traceback
            traceback.print_exc()
            self.root.after(0, lambda: self.update_status(
                f"❌ خطأ: {str(e)}", "#ff0000"
            ))
            
    def _add_text_to_display(self, text):
        """إضافة نص إلى منطقة العرض"""
        self.text_display.insert("end", text + "\n")
        self.text_display.see("end")
        
    def update_status(self, message, color="#00ff00"):
        """تحديث حالة النظام"""
        status_text = f"📡 الحالة: {message}"
        if CUSTOMTK_AVAILABLE:
            self.status_label.configure(text=status_text, text_color=color)
        else:
            self.status_label.configure(text=status_text, fg=color)
        self.root.update_idletasks()
        
    def copy_text(self):
        """نسخ النص إلى الحافظة"""
        try:
            text = self.text_display.get("1.0", "end-1c")
            if text.strip():
                self.root.clipboard_clear()
                self.root.clipboard_append(text)
                messagebox.showinfo("نجح", "تم نسخ النص إلى الحافظة!")
            else:
                messagebox.showwarning("تحذير", "لا يوجد نص للنسخ")
        except Exception as e:
            messagebox.showerror("خطأ", f"فشل في نسخ النص: {e}")
            
    def clear_text(self):
        """مسح النص"""
        self.text_display.delete("1.0", "end")
        self.current_text = ""
    
    def translate_text(self):
        """ترجمة النص من لغة إلى أخرى"""
        try:
            # الحصول على النص الأصلي
            if CUSTOMTK_AVAILABLE:
                source_text = self.text_display.get("1.0", "end-1c").strip()
            else:
                source_text = self.text_display.get("1.0", "end-1c").strip()
            
            if not source_text:
                self.translation_display.delete("1.0", "end")
                self.translation_display.insert("1.0", "⚠️ لا يوجد نص للترجمة!")
                return
            
            # الحصول على اللغات المحددة
            from_lang_name = self.from_lang_var.get()
            to_lang_name = self.to_lang_var.get()
            
            from_lang_code = self.translation_languages.get(from_lang_name, 'ar')
            to_lang_code = self.translation_languages.get(to_lang_name, 'en')
            
            # التحقق من عدم ترجمة نفس اللغة
            if from_lang_code == to_lang_code:
                self.translation_display.delete("1.0", "end")
                self.translation_display.insert("1.0", "⚠️ اختر لغتين مختلفتين!")
                return
            
            # عرض حالة الترجمة
            self.translation_display.delete("1.0", "end")
            self.translation_display.insert("1.0", "🔄 جاري الترجمة...")
            self.root.update()
            
            # محاولة الترجمة باستخدام googletrans
            try:
                from googletrans import Translator
                translator = Translator()
                
                # تنفيذ الترجمة
                translation = translator.translate(
                    source_text,
                    src=from_lang_code,
                    dest=to_lang_code
                )
                
                translated_text = translation.text
                
                # عرض الترجمة
                self.translation_display.delete("1.0", "end")
                self.translation_display.insert("1.0", translated_text)
                
                print(f"✅ تمت الترجمة: {from_lang_name} → {to_lang_name}")
                
            except ImportError:
                # إذا لم تكن مكتبة googletrans مثبتة
                self.translation_display.delete("1.0", "end")
                error_msg = (
                    "❌ مكتبة الترجمة غير مثبتة!\n\n"
                    "لتثبيتها، شغّل:\n"
                    "pip install googletrans==4.0.0rc1\n\n"
                    "أو استخدم:\n"
                    "pip install deep-translator"
                )
                self.translation_display.insert("1.0", error_msg)
                
                messagebox.showwarning(
                    "تنبيه",
                    "مكتبة الترجمة غير مثبتة!\n\n"
                    "قم بتشغيل:\n"
                    "pip install googletrans==4.0.0rc1"
                )
                
            except Exception as e:
                # خطأ في الترجمة
                self.translation_display.delete("1.0", "end")
                self.translation_display.insert(
                    "1.0",
                    f"❌ خطأ في الترجمة:\n{str(e)}\n\n"
                    "💡 تأكد من:\n"
                    "1. اتصال الإنترنت\n"
                    "2. تثبيت المكتبة الصحيحة"
                )
                print(f"❌ خطأ في الترجمة: {e}")
                
        except Exception as e:
            print(f"❌ خطأ عام في الترجمة: {e}")
            self.translation_display.delete("1.0", "end")
            self.translation_display.insert("1.0", f"❌ خطأ: {str(e)}")
        
    def on_language_change(self, language_name):
        """تغيير اللغة"""
        # إيقاف التسجيل تلقائياً إذا كان جارياً
        if self.is_listening:
            print("⚠️ إيقاف التسجيل لتغيير اللغة...")
            self.stop_listening()
            # انتظار قليلاً للتأكد من إيقاف التسجيل
            self.root.after(500, lambda: self._apply_language_change(language_name))
            return
        
        self._apply_language_change(language_name)
    
    def _apply_language_change(self, language_name):
        """تطبيق تغيير اللغة (دالة مساعدة)"""
        language_code = self.language_map.get(language_name, 'ar')
        self.current_language = language_code
        
        # محاولة إنشاء model_manager إذا لم يكن موجوداً
        if not self.model_manager:
            try:
                from model_manager import ModelManager
                self.model_manager = ModelManager()
            except:
                pass
        
        if self.recognizer and self.model_manager:
            if not self.model_manager.is_model_downloaded(language_code):
                response = messagebox.askyesno(
                    "نموذج غير محمل",
                    f"نموذج {language_name} غير محمل. هل تريد تحميله الآن؟"
                )
                if response:
                    self.download_specific_model(language_code)
                return
            
            model_path = self.model_manager.get_model_path(language_code)
            if model_path and hasattr(self.recognizer, 'switch_language'):
                if self.recognizer.switch_language(language_code, str(model_path)):
                    self.update_status(f"✅ تم التبديل إلى {language_name}", "#00ff00")
                else:
                    self.update_status(f"❌ فشل التبديل إلى {language_name}", "#ff0000")
            else:
                # إذا كان recognizer من Google، فقط تحديث اللغة
                if hasattr(self.recognizer, 'language'):
                    self.recognizer.language = language_code
                    self.update_status(f"✅ تم التبديل إلى {language_name}", "#00ff00")
                else:
                    self.update_status(f"✅ اللغة: {language_name} (سيتم تطبيقها عند التسجيل التالي)", "#00ff00")
        else:
            # إذا لم يكن recognizer متوفراً، فقط حفظ اللغة
            self.update_status(f"🌍 اللغة: {language_name}", "#00ff00")
    
    def on_mode_change(self, mode_name):
        """تغيير وضع الإنترنت"""
        if mode_name == 'بدون إنترنت فقط':
            self.offline_mode = 'strict_offline'
            if self.recognizer:
                self.recognizer.offline_only = True
                self.recognizer.use_google_fallback = False
        elif mode_name == 'بدون إنترنت أولاً':
            self.offline_mode = 'offline_first'
            if self.recognizer:
                self.recognizer.offline_only = False
                self.recognizer.use_google_fallback = True
        else:
            self.offline_mode = 'online'
            if self.recognizer:
                self.recognizer.offline_only = False
                self.recognizer.use_google_fallback = True
        
        self.update_status(f"📡 الوضع: {mode_name}", "#00ff00")
    
    def download_models(self):
        """فتح نافذة تحميل النماذج"""
        # محاولة إنشاء model_manager إذا لم يكن موجوداً
        if not self.model_manager:
            try:
                from model_manager import ModelManager
                self.model_manager = ModelManager()
                print("✅ تم إنشاء مدير النماذج")
            except Exception as e:
                messagebox.showerror(
                    "خطأ", 
                    f"لا يمكن إنشاء مدير النماذج:\n{e}\n\n"
                    "💡 تأكد من وجود ملف model_manager.py"
                )
                return
        
        # التحقق من تثبيت Vosk (تحذير فقط، لا نمنع التحميل)
        vosk_installed = False
        try:
            from vosk import Model
            vosk_installed = True
        except ImportError:
            # لا نمنع التحميل، لكن نعطي تحذير
            response = messagebox.askyesno(
                "تحذير",
                "Vosk غير مثبت!\n\n"
                "يمكنك تحميل النماذج الآن، لكن لن تعمل بدون تثبيت Vosk.\n\n"
                "هل تريد المتابعة بالتحميل؟\n"
                "(يمكنك تثبيت Vosk لاحقاً: pip install vosk)"
            )
            if not response:
                return
        
        download_window = tk.Toplevel(self.root)
        download_window.title("⬇️ تحميل النماذج اللغوية")
        download_window.geometry("550x450")
        
        title = tk.Label(
            download_window,
            text="⬇️ تحميل النماذج اللغوية",
            font=("Arial", 16, "bold")
        )
        title.pack(pady=10)
        
        # رسالة توضيحية
        if not vosk_installed:
            info_label = tk.Label(
                download_window,
                text="💡 ملاحظة: يجب تثبيت Vosk أولاً لاستخدام النماذج\npip install vosk",
                font=("Arial", 10),
                fg="orange",
                justify="center"
            )
            info_label.pack(pady=5)
        
        # إطار قابل للتمرير
        canvas = tk.Canvas(download_window)
        scrollbar = tk.Scrollbar(download_window, orient="vertical", command=canvas.yview)
        scrollable_frame = tk.Frame(canvas)
        
        scrollable_frame.bind(
            "<Configure>",
            lambda e: canvas.configure(scrollregion=canvas.bbox("all"))
        )
        
        canvas.create_window((0, 0), window=scrollable_frame, anchor="nw")
        canvas.configure(yscrollcommand=scrollbar.set)
        
        frame = tk.Frame(scrollable_frame)
        frame.pack(pady=10, padx=20, fill="both", expand=True)
        
        for lang_code in self.model_manager.get_all_languages():
            lang_name = self.model_manager.get_language_name(lang_code)
            is_downloaded = self.model_manager.is_model_downloaded(lang_code)
            
            lang_frame = tk.Frame(frame)
            lang_frame.pack(fill="x", pady=5)
            
            status = "✅ محمل" if is_downloaded else "❌ غير محمل"
            label = tk.Label(
                lang_frame,
                text=f"{lang_name} ({lang_code}) - {status}",
                font=("Arial", 12),
                width=30,
                anchor="w"
            )
            label.pack(side="left", padx=5)
            
            if not is_downloaded:
                btn = tk.Button(
                    lang_frame,
                    text="⬇️ تحميل",
                    command=lambda lc=lang_code: self.download_specific_model(lc, download_window),
                    bg="#17a2b8",
                    fg="white",
                    cursor="hand2"
                )
                btn.pack(side="left", padx=5)
        
        download_all_btn = tk.Button(
            download_window,
            text="⬇️ تحميل جميع النماذج",
            command=lambda: self.download_all_models(download_window),
            font=("Arial", 12, "bold"),
            bg="#28a745",
            fg="white",
            cursor="hand2"
        )
        download_all_btn.pack(pady=10)
        
        close_btn = tk.Button(
            download_window,
            text="إغلاق",
            command=download_window.destroy,
            bg="#6c757d",
            fg="white",
            cursor="hand2"
        )
        close_btn.pack(pady=5)
    
    def download_specific_model(self, language_code, window=None):
        """تحميل نموذج لغة محدد"""
        if not self.model_manager:
            return
        
        lang_name = self.model_manager.get_language_name(language_code)
        
        progress_window = tk.Toplevel(self.root)
        progress_window.title(f"تحميل {lang_name}")
        progress_window.geometry("400x150")
        
        label = tk.Label(
            progress_window,
            text=f"جاري تحميل نموذج {lang_name}...",
            font=("Arial", 12)
        )
        label.pack(pady=20)
        
        progress_label = tk.Label(
            progress_window,
            text="0%",
            font=("Arial", 10)
        )
        progress_label.pack(pady=10)
        
        def update_progress(downloaded, total):
            if total > 0:
                percent = (downloaded * 100) // total
                progress_label.config(text=f"{percent}%")
                progress_window.update()
        
        def download_thread():
            success = self.model_manager.download_model(language_code, update_progress)
            progress_window.destroy()
            
            if success:
                messagebox.showinfo("نجح", f"تم تحميل نموذج {lang_name} بنجاح!")
                if window:
                    window.destroy()
                    self.download_models()
            else:
                messagebox.showerror("خطأ", f"فشل تحميل نموذج {lang_name}")
        
        thread = threading.Thread(target=download_thread, daemon=True)
        thread.start()
    
    def download_all_models(self, window=None):
        """تحميل جميع النماذج"""
        if not self.model_manager:
            return
        
        response = messagebox.askyesno(
            "تأكيد",
            "هل تريد تحميل جميع النماذج اللغوية؟\nقد يستغرق هذا وقتاً طويلاً."
        )
        
        if not response:
            return
        
        progress_window = tk.Toplevel(self.root)
        progress_window.title("تحميل جميع النماذج")
        progress_window.geometry("400x150")
        
        label = tk.Label(
            progress_window,
            text="جاري تحميل جميع النماذج...",
            font=("Arial", 12)
        )
        label.pack(pady=20)
        
        progress_label = tk.Label(
            progress_window,
            text="",
            font=("Arial", 10)
        )
        progress_label.pack(pady=10)
        
        def update_progress(language, downloaded, total):
            lang_name = self.model_manager.get_language_name(language)
            if total > 0:
                percent = (downloaded * 100) // total
                progress_label.config(text=f"{lang_name}: {percent}%")
                progress_window.update()
        
        def download_thread():
            results = self.model_manager.download_all_models(update_progress)
            progress_window.destroy()
            
            success_count = sum(1 for r in results.values() if r)
            total_count = len(results)
            
            messagebox.showinfo(
                "اكتمل",
                f"تم تحميل {success_count} من {total_count} نماذج بنجاح"
            )
            
            if window:
                window.destroy()
                self.download_models()
        
        thread = threading.Thread(target=download_thread, daemon=True)
        thread.start()
    
    def show_settings(self):
        """عرض نافذة الإعدادات"""
        settings_window = tk.Toplevel(self.root)
        settings_window.title("⚙️ الإعدادات")
        settings_window.geometry("400x300")
        
        label = tk.Label(
            settings_window,
            text="الإعدادات المتقدمة قيد التطوير",
            font=("Arial", 12)
        )
        label.pack(pady=50)
        
    def on_closing(self):
        """عند إغلاق النافذة"""
        try:
            # إيقاف الاستماع أولاً
            self.is_listening = False
            
            # إيقاف التسجيل
            if self.recognizer:
                try:
                    self.recognizer.stop_recording()
                except:
                    pass
            
            # الانتظار قليلاً لإيقاف الـ thread
            if self.listening_thread and self.listening_thread.is_alive():
                self.listening_thread.join(timeout=1.0)
            
            # إغلاق النافذة
            self.root.quit()
            self.root.destroy()
        except Exception as e:
            print(f"⚠️ خطأ عند الإغلاق: {e}")
            # إغلاق قسري
            try:
                self.root.destroy()
            except:
                pass
            # الخروج من البرنامج
            import sys
            sys.exit(0)
        
    def run(self):
        """تشغيل الواجهة"""
        try:
            # التأكد من أن النافذة مرئية ومركزة على الشاشة
            self.root.update_idletasks()
            
            # حساب موضع الوسط للشاشة
            screen_width = self.root.winfo_screenwidth()
            screen_height = self.root.winfo_screenheight()
            window_width = self.root.winfo_reqwidth()
            window_height = self.root.winfo_reqheight()
            x = (screen_width - window_width) // 2
            y = (screen_height - window_height) // 2
            self.root.geometry(f"+{x}+{y}")
            
            self.root.deiconify()  # إظهار النافذة إذا كانت مخفية
            self.root.lift()  # جلب النافذة للأمام
            self.root.focus_force()  # إعطاء النافذة التركيز
            self.root.attributes('-topmost', True)  # جعل النافذة في المقدمة مؤقتاً
            self.root.after(100, lambda: self.root.attributes('-topmost', False))  # إلغاء المقدمة بعد 100ms
            
            print("✅ تم فتح الواجهة بنجاح!")
            self.root.mainloop()
        except Exception as e:
            print(f"❌ خطأ في تشغيل الواجهة: {e}")
            import traceback
            traceback.print_exc()
            # محاولة طريقة بديلة
            try:
                self.root.mainloop()
            except:
                pass


def create_gui(recognizer=None, typer=None):
    """دالة مساعدة لإنشاء الواجهة"""
    app = VoiceTypingGUI(recognizer, typer)
    return app


if __name__ == "__main__":
    # اختبار الواجهة
    print("🧪 اختبار الواجهة الرسومية...")
    app = VoiceTypingGUI()
    app.run()

