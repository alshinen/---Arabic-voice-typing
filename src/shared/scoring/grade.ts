import { z } from 'zod';
import { hitsAny } from '../hotspot/geometry';
import type { Question } from '../types/question';
import { questionMaxPoints } from '../types/question';
import { countToCorrectness, countUnorderedCorrect, orderedCorrectness, scoreMultiItem } from './multiItem';
import { scoreSingleAnswer } from './single';

/** إجابة المتدرب في محاولة واحدة، حسب نوع السؤال. */
export const responseSchema = z.union([
  z.object({ kind: z.literal('TF'), value: z.boolean() }),
  z.object({ kind: z.literal('MCQ'), optionId: z.string() }),
  z.object({ kind: z.literal('SLOTS'), selections: z.array(z.string().nullable()) }),
  z.object({ kind: z.literal('POINT'), x: z.number().min(0).max(1), y: z.number().min(0).max(1) }),
]);
export type Response = z.infer<typeof responseSchema>;

export interface TryGrade {
  correct: boolean;
  /** صحة كل بند في «اذكر» والمهارات، وnull في غيرهما. */
  items: boolean[] | null;
}

/** تصحيح محاولة واحدة. يرمي خطأ إن كانت الإجابة لا تناسب نوع السؤال. */
export function gradeTry(q: Question, r: Response): TryGrade {
  switch (q.type) {
    case 'TF':
      if (r.kind !== 'TF') break;
      return { correct: r.value === q.data.correct, items: null };
    case 'MCQ':
      if (r.kind !== 'MCQ') break;
      return { correct: r.optionId === q.data.correctId, items: null };
    case 'HOTSPOT':
      if (r.kind !== 'POINT') break;
      return { correct: hitsAny(q.data.regions, { x: r.x, y: r.y }, q.data.tolerance), items: null };
    case 'LIST': {
      if (r.kind !== 'SLOTS' || r.selections.length !== q.data.slots.length) break;
      const d = q.data;
      const items = d.ordered
        ? orderedCorrectness(
            r.selections,
            d.slots.map((s) => (s.correctId ? [s.correctId] : [])),
          )
        : countToCorrectness(countUnorderedCorrect(r.selections, d.correctIds), d.slots.length);
      return { correct: items.every(Boolean), items };
    }
    case 'SKILL': {
      if (r.kind !== 'SLOTS' || r.selections.length !== q.data.items.length) break;
      const items = orderedCorrectness(
        r.selections,
        q.data.items.map((it) => [it.correctId]),
      );
      return { correct: items.every(Boolean), items };
    }
  }
  throw new Error('الإجابة لا تناسب نوع السؤال');
}

/**
 * درجة السؤال من محاولاته، مقيسة على درجة السؤال داخل الاختبار (examPoints).
 * tries: نتائج المحاولات بالترتيب.
 */
export function scoreQuestion(q: Question, tries: readonly TryGrade[], examPoints: number): number {
  const max = questionMaxPoints(q);
  let earned: number;
  if (q.type === 'LIST' || q.type === 'SKILL') {
    const scoring = q.data.scoring;
    const itemPoints =
      q.type === 'LIST' ? q.data.itemPoints ?? undefined : q.data.items.map((it) => it.points ?? 0);
    earned = scoreMultiItem({
      points: q.points,
      scoring,
      itemPoints: scoring === 'per_item' ? itemPoints : undefined,
      mode: q.lateTryScoring,
      maxTries: q.maxTries,
      attempts: tries.map((t) => t.items ?? []),
    }).earned;
  } else {
    earned = scoreSingleAnswer({
      points: max,
      maxTries: q.maxTries,
      mode: q.lateTryScoring,
      attempts: tries.map((t) => t.correct),
    }).earned;
  }
  if (max === 0) return 0;
  return (earned / max) * examPoints;
}
