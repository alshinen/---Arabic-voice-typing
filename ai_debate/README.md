# نقاش هجين: Claude × GPT

سكربت يجعل Claude و GPT يتناقشان حول أي موضوع لعدة جولات، ثم:
1. يكتب كل نموذج خلاصته.
2. يدمج Claude الخلاصتين في **خلاصة نهائية** موحدة.
3. يُحفظ النقاش كاملًا في ملف `debate_*.md`.

## التشغيل

```bash
pip install -r requirements.txt
export ANTHROPIC_API_KEY="..."
export OPENAI_API_KEY="..."
python debate.py "ما أفضل طريقة لتعلم البرمجة؟" --rounds 3
```

## إعدادات اختيارية (متغيرات بيئة)

| المتغير | الافتراضي |
|---|---|
| `CLAUDE_MODEL` | `claude-opus-5-5` |
| `OPENAI_MODEL` | `gpt-4o` |
| `MAX_TOKENS` | `1500` |

## واجهة سطح المكتب

```bash
python gui.py
```

أدخل المفتاحين والموضوع وعدد الجولات ثم اضغط «ابدأ النقاش». تظهر ردود Claude باللون البرتقالي وGPT بالأخضر والخلاصة النهائية بالأزرق، ويمكن إيقاف النقاش أو حفظه كملف Markdown.
تُحفظ الإعدادات (ومنها المفاتيح) في `~/.ai_debate_config.json` على جهازك فقط.

> ملاحظة: اشتراك Claude Pro واشتراك ChatGPT Plus **لا يشملان** استخدام الـ API.
> تحتاج مفاتيح API من [console.anthropic.com](https://console.anthropic.com) و [platform.openai.com](https://platform.openai.com) والدفع فيهما منفصل حسب الاستخدام.
