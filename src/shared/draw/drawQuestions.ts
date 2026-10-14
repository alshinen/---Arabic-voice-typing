import type { QuestionType } from '../types/domain';
import { shuffle, type Rng } from './random';

export interface DrawCandidate {
  id: string;
  type: QuestionType;
}

/** سطر في قالب الاختبار: النوع، والعدد، ودرجة السؤال (design.md 1.5). */
export interface DrawRule {
  type: QuestionType;
  count: number;
  points: number;
}

export interface DrawOptions {
  /** عدد مرات استخدام كل سؤال في الجلسة الحالية. */
  sessionUsage?: ReadonlyMap<string, number>;
  /** أسئلة رآها هذا المتدرب في محاولات سابقة. */
  seenByTrainee?: ReadonlySet<string>;
  rng: Rng;
}

export interface DrawnQuestion {
  id: string;
  type: QuestionType;
  points: number;
  position: number;
}

export class InsufficientQuestionsError extends Error {
  constructor(
    readonly type: QuestionType,
    readonly required: number,
    readonly available: number,
  ) {
    super(`البنك لا يكفي: المطلوب ${required} من نوع ${type}، والمتوفر ${available}`);
    this.name = 'InsufficientQuestionsError';
  }
}

/** كم سؤالًا متوفرًا من كل نوع، مقارنة بالقالب. يُستخدم لمنع نشر اختبار لا يكفيه البنك. */
export function checkAvailability(
  pool: readonly DrawCandidate[],
  rules: readonly DrawRule[],
): { type: QuestionType; required: number; available: number }[] {
  const required = new Map<QuestionType, number>();
  for (const r of rules) required.set(r.type, (required.get(r.type) ?? 0) + r.count);
  return [...required].map(([type, req]) => ({
    type,
    required: req,
    available: pool.filter((q) => q.type === type).length,
  }));
}

/**
 * يسحب أسئلة متدرب واحد حسب القالب:
 * - لا يتكرر سؤال داخل الاختبار.
 * - يفضّل ما لم يره المتدرب سابقًا، ثم الأقل استخدامًا في الجلسة، ثم عشوائيًا.
 * - يخلط الترتيب النهائي.
 */
export function drawQuestions(
  pool: readonly DrawCandidate[],
  rules: readonly DrawRule[],
  options: DrawOptions,
): DrawnQuestion[] {
  for (const a of checkAvailability(pool, rules)) {
    if (a.available < a.required) throw new InsufficientQuestionsError(a.type, a.required, a.available);
  }
  const usage = options.sessionUsage ?? new Map<string, number>();
  const seen = options.seenByTrainee ?? new Set<string>();
  const chosen = new Set<string>();
  const picked: Omit<DrawnQuestion, 'position'>[] = [];

  for (const rule of rules) {
    if (!Number.isInteger(rule.count) || rule.count < 0) {
      throw new RangeError(`عدد غير صالح في القالب: ${rule.count}`);
    }
    const candidates = shuffle(
      pool.filter((q) => q.type === rule.type && !chosen.has(q.id)),
      options.rng,
    ).sort(
      (a, b) =>
        Number(seen.has(a.id)) - Number(seen.has(b.id)) ||
        (usage.get(a.id) ?? 0) - (usage.get(b.id) ?? 0),
    );
    for (const q of candidates.slice(0, rule.count)) {
      chosen.add(q.id);
      picked.push({ id: q.id, type: q.type, points: rule.points });
    }
  }

  return shuffle(picked, options.rng).map((q, position) => ({ ...q, position }));
}
