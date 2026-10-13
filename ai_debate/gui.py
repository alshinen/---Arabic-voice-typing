#!/usr/bin/env python3
"""واجهة سطح مكتب للنقاش الهجين بين Claude و GPT (tkinter)."""

import json
import os
import queue
import threading
import tkinter as tk
from pathlib import Path
from tkinter import messagebox, scrolledtext, ttk

import debate

CONFIG = Path.home() / ".ai_debate_config.json"
COLORS = {"Claude": "#c96442", "GPT": "#10a37f", "final": "#1f4e9c", "header": "#555555"}


class DebateApp(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("نقاش Claude × GPT")
        self.geometry("900x700")
        self.events = queue.Queue()
        self.stop_flag = threading.Event()
        self.result = None
        self._build()
        self._load_config()
        self.after(100, self._poll)

    # ---------- الواجهة ----------
    def _build(self):
        keys = ttk.LabelFrame(self, text="الإعدادات")
        keys.pack(fill="x", padx=10, pady=5)
        self.claude_key = self._field(keys, "مفتاح Anthropic:", 0, show="*")
        self.openai_key = self._field(keys, "مفتاح OpenAI:", 1, show="*")
        self.claude_model = self._field(keys, "نموذج Claude:", 2, default=debate.CLAUDE_MODEL)
        self.openai_model = self._field(keys, "نموذج GPT:", 3, default=debate.OPENAI_MODEL)
        keys.columnconfigure(0, weight=1)

        top = ttk.Frame(self)
        top.pack(fill="x", padx=10, pady=5)
        ttk.Label(top, text=":الموضوع").pack(side="right")
        self.topic = ttk.Entry(top, justify="right", font=("Arial", 12))
        self.topic.pack(side="right", fill="x", expand=True, padx=5)

        bar = ttk.Frame(self)
        bar.pack(fill="x", padx=10)
        ttk.Label(bar, text=":الجولات").pack(side="right")
        self.rounds = tk.Spinbox(bar, from_=1, to=10, width=4, justify="center")
        self.rounds.delete(0, "end")
        self.rounds.insert(0, "3")
        self.rounds.pack(side="right", padx=5)
        self.start_btn = ttk.Button(bar, text="ابدأ النقاش", command=self.start)
        self.start_btn.pack(side="right", padx=5)
        self.stop_btn = ttk.Button(bar, text="إيقاف", command=self.stop_flag.set, state="disabled")
        self.stop_btn.pack(side="right", padx=5)
        self.save_btn = ttk.Button(bar, text="حفظ", command=self.save, state="disabled")
        self.save_btn.pack(side="right", padx=5)
        self.status = ttk.Label(bar, text="")
        self.status.pack(side="left")

        self.out = scrolledtext.ScrolledText(self, wrap="word", font=("Arial", 12))
        self.out.pack(fill="both", expand=True, padx=10, pady=10)
        self.out.tag_configure("rtl", justify="right")
        for name, color in COLORS.items():
            self.out.tag_configure(name, foreground=color, font=("Arial", 13, "bold"), justify="right")
        self.out.configure(state="disabled")

    def _field(self, parent, label, row, show=None, default=""):
        ttk.Label(parent, text=label).grid(row=row, column=1, sticky="e", padx=5, pady=2)
        entry = ttk.Entry(parent, show=show or "")
        entry.grid(row=row, column=0, sticky="ew", padx=5, pady=2)
        entry.insert(0, default)
        return entry

    def _write(self, text, tag="rtl"):
        self.out.configure(state="normal")
        self.out.insert("end", text, tag)
        self.out.see("end")
        self.out.configure(state="disabled")

    # ---------- الإعدادات المحفوظة ----------
    def _load_config(self):
        try:
            cfg = json.loads(CONFIG.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            cfg = {}
        for entry, key, env in (
            (self.claude_key, "anthropic_key", "ANTHROPIC_API_KEY"),
            (self.openai_key, "openai_key", "OPENAI_API_KEY"),
            (self.claude_model, "claude_model", None),
            (self.openai_model, "openai_model", None),
        ):
            value = cfg.get(key) or (os.getenv(env) if env else None)
            if value:
                entry.delete(0, "end")
                entry.insert(0, value)

    def _save_config(self):
        cfg = {
            "anthropic_key": self.claude_key.get().strip(),
            "openai_key": self.openai_key.get().strip(),
            "claude_model": self.claude_model.get().strip(),
            "openai_model": self.openai_model.get().strip(),
        }
        try:
            CONFIG.write_text(json.dumps(cfg), encoding="utf-8")
            os.chmod(CONFIG, 0o600)
        except OSError:
            pass

    # ---------- التشغيل ----------
    def start(self):
        topic = self.topic.get().strip()
        if not topic:
            messagebox.showwarning("تنبيه", "اكتب موضوع النقاش أولًا")
            return
        if not self.claude_key.get().strip() or not self.openai_key.get().strip():
            messagebox.showwarning("تنبيه", "أدخل مفتاحي API لكل من Anthropic و OpenAI")
            return
        self._save_config()
        os.environ["ANTHROPIC_API_KEY"] = self.claude_key.get().strip()
        os.environ["OPENAI_API_KEY"] = self.openai_key.get().strip()
        debate.CLAUDE_MODEL = self.claude_model.get().strip()
        debate.OPENAI_MODEL = self.openai_model.get().strip()
        debate.reset_clients()

        self.out.configure(state="normal")
        self.out.delete("1.0", "end")
        self.out.configure(state="disabled")
        self.stop_flag.clear()
        self.result = None
        self.start_btn.configure(state="disabled")
        self.save_btn.configure(state="disabled")
        self.stop_btn.configure(state="normal")
        self.status.configure(text="...جارٍ النقاش")
        threading.Thread(target=self._worker, args=(topic, int(self.rounds.get())), daemon=True).start()

    def _worker(self, topic, rounds):
        try:
            history, summaries, final = debate.run_debate(
                topic, rounds,
                on_event=lambda *e: self.events.put(("event", e)),
                should_stop=self.stop_flag.is_set,
            )
            self.events.put(("done", (topic, history, summaries, final)))
        except Exception as exc:  # نعرض أي خطأ من الـ API للمستخدم
            self.events.put(("error", str(exc)))

    def _poll(self):
        try:
            while True:
                kind, data = self.events.get_nowait()
                if kind == "event":
                    ev, title, text = data
                    if ev == "header":
                        self._write(f"\n══════ {title} ══════\n", "header")
                    else:
                        tag = "final" if ev == "final" else title.split()[-1]
                        self._write(f"\n{title}:\n", tag if tag in COLORS else "header")
                        self._write(text + "\n")
                elif kind == "done":
                    self.result = data
                    self._finish("انتهى" if data[3] else "تم الإيقاف")
                else:
                    self._finish("حدث خطأ")
                    messagebox.showerror("خطأ", data)
        except queue.Empty:
            pass
        self.after(100, self._poll)

    def _finish(self, msg):
        self.status.configure(text=msg)
        self.start_btn.configure(state="normal")
        self.stop_btn.configure(state="disabled")
        if self.result and self.result[3]:
            self.save_btn.configure(state="normal")

    def save(self):
        if self.result:
            path = debate.save_markdown(*self.result)
            messagebox.showinfo("تم الحفظ", f"حُفظ النقاش في:\n{os.path.abspath(path)}")


if __name__ == "__main__":
    DebateApp().mainloop()
