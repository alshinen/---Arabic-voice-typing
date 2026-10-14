import { describe, expect, it } from 'vitest';
import { drawQuestions, InsufficientQuestionsError, type DrawCandidate } from '../src/shared/draw/drawQuestions';
import { seededRng, shuffle } from '../src/shared/draw/random';

const pool: DrawCandidate[] = [
  ...Array.from({ length: 40 }, (_, i) => ({ id: `tf${i}`, type: 'TF' as const })),
  ...Array.from({ length: 20 }, (_, i) => ({ id: `mcq${i}`, type: 'MCQ' as const })),
  ...Array.from({ length: 9 }, (_, i) => ({ id: `list${i}`, type: 'LIST' as const })),
];
const rules = [
  { type: 'TF' as const, count: 10, points: 0.5 },
  { type: 'MCQ' as const, count: 6, points: 1 },
  { type: 'LIST' as const, count: 3, points: 2 },
];

describe('سحب الأسئلة', () => {
  it('يلتزم بالقالب: العدد والدرجة لكل نوع، دون تكرار', () => {
    const drawn = drawQuestions(pool, rules, { rng: seededRng(1) });
    expect(drawn).toHaveLength(19);
    expect(new Set(drawn.map((q) => q.id)).size).toBe(19);
    expect(drawn.filter((q) => q.type === 'TF').every((q) => q.points === 0.5)).toBe(true);
    expect(drawn.reduce((s, q) => s + q.points, 0)).toBe(17);
    expect(drawn.map((q) => q.position)).toEqual([...Array(19).keys()]);
  });

  it('متدربان مختلفان يأخذان أسئلة مختلفة عند تفضيل الأقل استخدامًا', () => {
    const usage = new Map<string, number>();
    const first = drawQuestions(pool, rules, { rng: seededRng(1), sessionUsage: usage });
    first.forEach((q) => usage.set(q.id, (usage.get(q.id) ?? 0) + 1));
    const second = drawQuestions(pool, rules, { rng: seededRng(2), sessionUsage: usage });
    const overlap = second.filter((q) => usage.has(q.id));
    expect(overlap).toHaveLength(0);
  });

  it('يتجنب ما رآه المتدرب سابقًا ما دام البنك يكفي', () => {
    const seen = new Set(pool.filter((q) => q.type === 'LIST').slice(0, 6).map((q) => q.id));
    const drawn = drawQuestions(pool, rules, { rng: seededRng(3), seenByTrainee: seen });
    expect(drawn.filter((q) => seen.has(q.id))).toHaveLength(0);
  });

  it('يرفض إذا كان البنك لا يكفي', () => {
    expect(() =>
      drawQuestions(pool, [{ type: 'LIST', count: 10, points: 1 }], { rng: seededRng(1) }),
    ).toThrow(InsufficientQuestionsError);
  });

  it('سطران للنوع نفسه بدرجتين مختلفتين دون تكرار', () => {
    const drawn = drawQuestions(
      pool,
      [
        { type: 'LIST', count: 5, points: 1 },
        { type: 'LIST', count: 4, points: 2 },
      ],
      { rng: seededRng(4) },
    );
    expect(new Set(drawn.map((q) => q.id)).size).toBe(9);
  });

  it('الخلط لا يغيّر العناصر', () => {
    expect(shuffle([1, 2, 3, 4], seededRng(5)).sort()).toEqual([1, 2, 3, 4]);
  });
});
