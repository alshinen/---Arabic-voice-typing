#!/usr/bin/env python3
"""
نقاش هجين بين Claude و GPT
يتناوب النموذجان على مناقشة موضوع لعدد من الجولات، ثم يكتب كل منهما خلاصته،
وفي النهاية يدمج Claude الخلاصتين في خلاصة نهائية واحدة.

الاستخدام:
    export ANTHROPIC_API_KEY=...
    export OPENAI_API_KEY=...
    python debate.py "هل العمل عن بُعد أفضل من العمل في المكتب؟" --rounds 3
"""

import argparse
import os
import sys
from datetime import datetime

from anthropic import Anthropic
from openai import OpenAI

CLAUDE_MODEL = os.getenv("CLAUDE_MODEL", "claude-opus-5-5")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o")
MAX_TOKENS = int(os.getenv("MAX_TOKENS", "1500"))

DEBATE_SYSTEM = (
    "أنت {me} وتشارك في نقاش جاد مع نموذج ذكاء اصطناعي آخر اسمه {other}. "
    "الهدف ليس الفوز بل الوصول إلى أدق وأفضل إجابة ممكنة. "
    "في كل رد: قيّم نقاط الطرف الآخر بصدق، وافق على الصحيح منها، "
    "انتقد الخاطئ أو الناقص بالدليل، وأضف أفكارًا جديدة. "
    "وضّح أي معلومة غير مؤكدة. اكتب بالعربية وباختصار (أقل من 300 كلمة)."
)

SUMMARY_PROMPT = (
    "انتهى النقاش. اكتب الآن خلاصتك: نقاط الاتفاق، نقاط الخلاف المتبقية، "
    "والتوصية النهائية برأيك."
)

MERGE_PROMPT = (
    "فيما يلي نقاش كامل بين Claude و GPT حول الموضوع: «{topic}»\n\n{transcript}\n\n"
    "وهذه خلاصة Claude:\n{claude_sum}\n\nوهذه خلاصة GPT:\n{gpt_sum}\n\n"
    "اكتب خلاصة نهائية موحدة ومحايدة بالعربية تتضمن:\n"
    "1. الجواب المختصر\n2. أهم نقاط الاتفاق\n3. نقاط الخلاف (إن وجدت) ورأي كل طرف\n"
    "4. التوصية النهائية\n5. ما هو غير مؤكد ويحتاج تحققًا"
)

_clients = {}


def _client(kind):
    # إنشاء العميل عند أول استخدام حتى تتمكن الواجهة من ضبط المفاتيح قبلها
    if kind not in _clients:
        _clients[kind] = Anthropic() if kind == "claude" else OpenAI()
    return _clients[kind]


def reset_clients():
    _clients.clear()


def build_messages(history, me, topic, extra_user=None):
    """يحوّل سجل النقاش إلى رسائل من منظور نموذج معيّن:
    ردوده = assistant، وردود الطرف الآخر = user (مع دمج الرسائل المتتالية)."""
    msgs = [{"role": "user", "content": f"موضوع النقاش: {topic}"}]
    for speaker, text in history:
        role = "assistant" if speaker == me else "user"
        content = text if role == "assistant" else f"[{speaker}]: {text}"
        if msgs[-1]["role"] == role:
            msgs[-1]["content"] += "\n\n" + content
        else:
            msgs.append({"role": role, "content": content})
    if extra_user:
        if msgs[-1]["role"] == "user":
            msgs[-1]["content"] += "\n\n" + extra_user
        else:
            msgs.append({"role": "user", "content": extra_user})
    return msgs


def ask_claude(system, messages):
    resp = _client("claude").messages.create(
        model=CLAUDE_MODEL,
        max_tokens=MAX_TOKENS,
        system=system,
        messages=messages,
    )
    return "".join(b.text for b in resp.content if b.type == "text").strip()


def ask_gpt(system, messages):
    resp = _client("openai").chat.completions.create(
        model=OPENAI_MODEL,
        messages=[{"role": "system", "content": system}] + messages,
    )
    return resp.choices[0].message.content.strip()


SPEAKERS = {
    "Claude": (ask_claude, DEBATE_SYSTEM.format(me="Claude", other="GPT")),
    "GPT": (ask_gpt, DEBATE_SYSTEM.format(me="GPT", other="Claude")),
}


def _print_event(kind, title, text):
    print(f"\n===== {title} =====" if kind == "header" else f"\n--- {title} ---\n{text}")


def run_debate(topic, rounds, on_event=_print_event, should_stop=lambda: False):
    """on_event(kind, title, text): kind = header | message | summary | final"""
    history = []
    for r in range(1, rounds + 1):
        on_event("header", f"الجولة {r}", "")
        for name in ("Claude", "GPT"):
            if should_stop():
                return history, {}, ""
            ask, system = SPEAKERS[name]
            reply = ask(system, build_messages(history, name, topic))
            history.append((name, reply))
            on_event("message", name, reply)

    on_event("header", "الخلاصات", "")
    summaries = {}
    for name, (ask, system) in SPEAKERS.items():
        summaries[name] = ask(system, build_messages(history, name, topic, SUMMARY_PROMPT))
        on_event("summary", f"خلاصة {name}", summaries[name])

    transcript = "\n\n".join(f"[{s}]: {t}" for s, t in history)
    final = ask_claude(
        "أنت محكّم محايد تدمج آراء نموذجين في خلاصة واحدة دقيقة.",
        [{"role": "user", "content": MERGE_PROMPT.format(
            topic=topic, transcript=transcript,
            claude_sum=summaries["Claude"], gpt_sum=summaries["GPT"])}],
    )
    on_event("final", "الخلاصة النهائية", final)
    return history, summaries, final


def save_markdown(topic, history, summaries, final):
    path = f"debate_{datetime.now():%Y%m%d_%H%M%S}.md"
    with open(path, "w", encoding="utf-8") as f:
        f.write(f"# نقاش: {topic}\n\n")
        f.write(f"النماذج: {CLAUDE_MODEL} × {OPENAI_MODEL}\n\n## النقاش\n\n")
        for speaker, text in history:
            f.write(f"### {speaker}\n\n{text}\n\n")
        f.write("## الخلاصات\n\n")
        for name, text in summaries.items():
            f.write(f"### خلاصة {name}\n\n{text}\n\n")
        f.write(f"## الخلاصة النهائية\n\n{final}\n")
    return path


def main():
    parser = argparse.ArgumentParser(description="نقاش بين Claude و GPT")
    parser.add_argument("topic", nargs="?", help="موضوع النقاش")
    parser.add_argument("--rounds", type=int, default=3, help="عدد الجولات (افتراضي 3)")
    args = parser.parse_args()

    for key in ("ANTHROPIC_API_KEY", "OPENAI_API_KEY"):
        if not os.getenv(key):
            sys.exit(f"خطأ: متغير البيئة {key} غير موجود.")

    topic = args.topic or input("اكتب موضوع النقاش: ").strip()
    history, summaries, final = run_debate(topic, args.rounds)
    print(f"\nتم حفظ النقاش في: {save_markdown(topic, history, summaries, final)}")


if __name__ == "__main__":
    main()
