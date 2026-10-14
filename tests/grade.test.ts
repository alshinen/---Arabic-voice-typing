import { describe, expect, it } from 'vitest';
import { gradeTry, scoreQuestion } from '../src/shared/scoring/grade';
import type { Question } from '../src/shared/types/question';
import { validateQuestionLogic } from '../src/shared/types/question';

const base = {
  id: 'q',
  bankId: 'bank-general',
  text: 'سؤال',
  imageId: null,
  level: null,
  shuffleOptions: true,
} as const;

const opt = (id: string) => ({ id, text: id });

describe('تصحيح المحاولة وحساب درجة السؤال', () => {
  it('صح وخطأ', () => {
    const q: Question = { ...base, type: 'TF', points: 0.5, maxTries: 1, lateTryScoring: 'first_only', data: { correct: true } };
    const t = gradeTry(q, { kind: 'TF', value: true });
    expect(t.correct).toBe(true);
    expect(scoreQuestion(q, [t], 0.5)).toBe(0.5);
  });

  it('اختيار من متعدد بدرجة مختلفة داخل الاختبار', () => {
    const q: Question = {
      ...base,
      type: 'MCQ',
      points: 1,
      maxTries: 2,
      lateTryScoring: 'decreasing',
      data: { options: [opt('a'), opt('b')], correctId: 'b' },
    };
    const tries = [gradeTry(q, { kind: 'MCQ', optionId: 'a' }), gradeTry(q, { kind: 'MCQ', optionId: 'b' })];
    expect(scoreQuestion(q, tries, 2)).toBe(1);
  });

  it('«اذكر» دون ترتيب مع التكرار', () => {
    const q: Question = {
      ...base,
      type: 'LIST',
      points: 1.5,
      maxTries: 1,
      lateTryScoring: 'decreasing',
      data: {
        ordered: false,
        shared: true,
        options: ['speed', 'fuel', 'rpm', 'temp', 'mirror'].map(opt),
        slots: [0, 1, 2].map(() => ({ options: [], correctId: null })),
        correctIds: ['speed', 'fuel', 'rpm', 'temp'],
        scoring: 'partial',
        itemPoints: null,
      },
    };
    expect(validateQuestionLogic(q)).toEqual([]);
    const t = gradeTry(q, { kind: 'SLOTS', selections: ['fuel', 'mirror', 'fuel'] });
    expect(t.correct).toBe(false);
    expect(scoreQuestion(q, [t], 1.5)).toBeCloseTo(0.5, 10);
  });

  it('«اذكر» بترتيب وقائمة لكل موضع', () => {
    const q: Question = {
      ...base,
      type: 'LIST',
      points: 2,
      maxTries: 3,
      lateTryScoring: 'decreasing',
      data: {
        ordered: true,
        shared: false,
        options: [],
        slots: [
          { options: [opt('a1'), opt('a2')], correctId: 'a1' },
          { options: [opt('b1'), opt('b2')], correctId: 'b2' },
        ],
        correctIds: [],
        scoring: 'partial',
        itemPoints: null,
      },
    };
    expect(validateQuestionLogic(q)).toEqual([]);
    const tries = [
      gradeTry(q, { kind: 'SLOTS', selections: ['a1', 'b1'] }),
      gradeTry(q, { kind: 'SLOTS', selections: ['a1', 'b2'] }),
    ];
    // الأفضل: المحاولة الأولى 2×½×1 = 1، والثانية 2×1×½ = 1
    expect(scoreQuestion(q, tries, 2)).toBeCloseTo(1, 10);
  });

  it('المهارات بدرجة لكل بند، وتغيير درجة السؤال في الاختبار يقيس النتيجة', () => {
    const q: Question = {
      ...base,
      type: 'SKILL',
      points: 0,
      maxTries: 1,
      lateTryScoring: 'decreasing',
      data: {
        options: [opt('front'), opt('back')],
        items: [
          { label: 'التقدم', correctId: 'front', points: 0.25 },
          { label: 'التراجع', correctId: 'back', points: 0.25 },
        ],
        scoring: 'per_item',
      },
    };
    const t = gradeTry(q, { kind: 'SLOTS', selections: ['front', 'front'] });
    expect(scoreQuestion(q, [t], 0.5)).toBeCloseTo(0.25, 10);
    expect(scoreQuestion(q, [t], 1)).toBeCloseTo(0.5, 10);
  });

  it('سؤال الصورة', () => {
    const q: Question = {
      ...base,
      imageId: 'img',
      type: 'HOTSPOT',
      points: 1,
      maxTries: 2,
      lateTryScoring: 'decreasing',
      data: { regions: [{ shape: 'ellipse', cx: 0.78, cy: 0.7, rx: 0.03, ry: 0.05 }], tolerance: 0 },
    };
    const tries = [gradeTry(q, { kind: 'POINT', x: 0.5, y: 0.5 }), gradeTry(q, { kind: 'POINT', x: 0.775, y: 0.667 })];
    expect(tries.map((t) => t.correct)).toEqual([false, true]);
    expect(scoreQuestion(q, tries, 1)).toBe(0.5);
  });

  it('إجابة لا تناسب النوع تُرفض', () => {
    const q: Question = { ...base, type: 'TF', points: 1, maxTries: 1, lateTryScoring: 'full', data: { correct: true } };
    expect(() => gradeTry(q, { kind: 'MCQ', optionId: 'x' })).toThrow();
  });

  it('التحقق من المنطق: إجابات صحيحة أقل من المواضع', () => {
    const q: Question = {
      ...base,
      type: 'LIST',
      points: 1,
      maxTries: 1,
      lateTryScoring: 'decreasing',
      data: {
        ordered: false,
        shared: true,
        options: ['a', 'b', 'c', 'd'].map(opt),
        slots: [0, 1, 2].map(() => ({ options: [], correctId: null })),
        correctIds: ['a', 'b'],
        scoring: 'partial',
        itemPoints: null,
      },
    };
    expect(validateQuestionLogic(q)[0]).toContain('طلبت 3 إجابات');
  });
});
