import { describe, expect, it } from 'vitest';
import {
  countToCorrectness,
  countUnorderedCorrect,
  evaluateExam,
  lateTryMultiplier,
  orderedCorrectness,
  roundForDisplay,
  scoreMultiItem,
  scoreSingleAnswer,
  sumPoints,
} from '../src/shared/scoring';

// أرقام الحالات تطابق جدول المرحلة 2 في docs/build-prompt.md

describe('معامل المحاولات', () => {
  it('الخصم التدريجي: 1 ثم ½ ثم ¼', () => {
    expect([1, 2, 3].map((k) => lateTryMultiplier(k, 'decreasing'))).toEqual([1, 0.5, 0.25]);
  });
  it('يرفض رقم محاولة غير صالح', () => {
    expect(() => lateTryMultiplier(0, 'full')).toThrow();
  });
});

describe('الأسئلة ذات الإجابة الواحدة', () => {
  it('1: صح وخطأ بدرجة ½، صحيح من أول محاولة', () => {
    expect(scoreSingleAnswer({ points: 0.5, maxTries: 1, mode: 'first_only', attempts: [true] }).earned).toBe(0.5);
  });
  it('2: صح وخطأ، من أول محاولة فقط، صحيح في الثانية = 0', () => {
    const r = scoreSingleAnswer({ points: 1, maxTries: 2, mode: 'first_only', attempts: [false, true] });
    expect(r.earned).toBe(0);
    expect(r.correctOnTry).toBe(2);
  });
  it('3: اختيار من متعدد، خصم تدريجي، صحيح في الثانية = ½', () => {
    expect(scoreSingleAnswer({ points: 1, maxTries: 3, mode: 'decreasing', attempts: [false, true] }).earned).toBe(0.5);
  });
  it('4: صحيح في الثالثة = ¼', () => {
    expect(
      scoreSingleAnswer({ points: 1, maxTries: 3, mode: 'decreasing', attempts: [false, false, true] }).earned,
    ).toBe(0.25);
  });
  it('5: ثلاث محاولات خاطئة = 0', () => {
    const r = scoreSingleAnswer({ points: 1, maxTries: 3, mode: 'decreasing', attempts: [false, false, false] });
    expect(r.earned).toBe(0);
    expect(r.correctOnTry).toBeNull();
  });
  it('6: الدرجة كاملة في أي محاولة', () => {
    expect(scoreSingleAnswer({ points: 1, maxTries: 3, mode: 'full', attempts: [false, false, true] }).earned).toBe(1);
  });
  it('لا تُحتسب إصابة بعد انتهاء المحاولات المسموحة', () => {
    expect(scoreSingleAnswer({ points: 1, maxTries: 1, mode: 'full', attempts: [false, true] }).earned).toBe(0);
  });
  it('13: سؤال صورة، محاولتان، أصاب في الثانية = ½', () => {
    expect(scoreSingleAnswer({ points: 1, maxTries: 2, mode: 'decreasing', attempts: [false, true] }).earned).toBe(0.5);
  });
});

describe('«اذكر» دون ترتيب', () => {
  const correct = ['speed', 'fuel', 'rpm', 'temp'];
  const score = (sel: (string | null)[]) =>
    scoreMultiItem({
      points: 1.5,
      scoring: 'partial',
      mode: 'decreasing',
      maxTries: 1,
      attempts: [countToCorrectness(countUnorderedCorrect(sel, correct), sel.length)],
    }).earned;

  it('7: المكرر يُحسب مرة واحدة: [وقود، مرآة، وقود] = 0.5', () => {
    expect(score(['fuel', 'mirror', 'fuel'])).toBeCloseTo(0.5, 10);
  });
  it('8: ثلاث صحيحة بأي ترتيب = 1.5', () => {
    expect(score(['rpm', 'speed', 'temp'])).toBeCloseTo(1.5, 10);
  });
  it('الموضع الفارغ لا يُحتسب', () => {
    expect(countUnorderedCorrect([null, 'fuel', null], correct)).toBe(1);
  });
});

describe('«اذكر» بترتيب', () => {
  const accepted = [['belt'], ['engine'], ['handbrake']];
  const sel = ['belt', 'handbrake', 'engine'];
  it('9: موضع واحد صحيح، احتساب جزئي = 1 من 3', () => {
    const r = scoreMultiItem({
      points: 3,
      scoring: 'partial',
      mode: 'decreasing',
      maxTries: 1,
      attempts: [orderedCorrectness(sel, accepted)],
    });
    expect(r.earned).toBeCloseTo(1, 10);
    expect(r.max).toBe(3);
  });
  it('10: الحالة نفسها، كل شيء أو لا شيء = 0', () => {
    expect(
      scoreMultiItem({
        points: 3,
        scoring: 'all_or_nothing',
        mode: 'decreasing',
        maxTries: 1,
        attempts: [orderedCorrectness(sel, accepted)],
      }).earned,
    ).toBe(0);
  });
  it('11: تُحتسب أفضل محاولة (2×⅔×1 أفضل من 2×1×½)', () => {
    const r = scoreMultiItem({
      points: 2,
      scoring: 'partial',
      mode: 'decreasing',
      maxTries: 3,
      attempts: [
        [true, true, false],
        [true, true, true],
      ],
    });
    expect(r.earned).toBeCloseTo(4 / 3, 10);
    expect(r.bestTry).toBe(1);
    expect(r.fullyCorrect).toBe(true);
  });
  it('يقبل أكثر من إجابة لموضع واحد', () => {
    expect(orderedCorrectness(['a2'], [['a1', 'a2']])).toEqual([true]);
  });
});

describe('المهارات', () => {
  it('12: 25 بندًا، كل بند ¼، 22 صحيحة = 5.5', () => {
    const items = Array.from({ length: 25 }, (_, i) => i < 22);
    const r = scoreMultiItem({
      points: 0,
      scoring: 'per_item',
      itemPoints: Array.from({ length: 25 }, () => 0.25),
      mode: 'decreasing',
      maxTries: 1,
      attempts: [items],
    });
    expect(r.earned).toBeCloseTo(5.5, 10);
    expect(r.max).toBeCloseTo(6.25, 10);
  });
  it('درجة لكل بند تتطلب درجة لكل البنود', () => {
    expect(() =>
      scoreMultiItem({ points: 0, scoring: 'per_item', itemPoints: [1], mode: 'full', maxTries: 1, attempts: [[true, false]] }),
    ).toThrow();
  });
});

describe('النتيجة النهائية وحد النجاح', () => {
  it('مثال design.md 4.8: مجموع 4 ودرجة 3.05', () => {
    expect(sumPoints([0.25, 0.25, 0.5, 2, 1])).toBe(4);
  });
  it('16: 3.05 من 4 = 76.25٪، ناجح مع حد 70٪', () => {
    const r = evaluateExam(3.05, 4, { mode: 'percent', value: 70 });
    expect(r.percent).toBeCloseTo(76.25, 10);
    expect(r.passed).toBe(true);
  });
  it('17: 3 من 5 مع حد 3 درجات = ناجح', () => {
    expect(evaluateExam(3, 5, { mode: 'points', value: 3 }).passed).toBe(true);
  });
  it('18: 2.75 من 5 مع حد 3 درجات = راسب', () => {
    expect(evaluateExam(2.75, 5, { mode: 'points', value: 3 }).passed).toBe(false);
  });
  it('بلا حد نجاح', () => {
    expect(evaluateExam(1, 5, { mode: 'none' }).passed).toBeNull();
  });
  it('النسبة على الحد تمامًا رغم أخطاء الكسور العشرية', () => {
    expect(evaluateExam(0.7, 1, { mode: 'percent', value: 70 }).passed).toBe(true);
    expect(evaluateExam(0.1 + 0.2, 0.3, { mode: 'percent', value: 100 }).passed).toBe(true);
  });
  it('التقريب للعرض فقط', () => {
    expect(roundForDisplay(4 / 3)).toBe(1.33);
    expect(roundForDisplay(0.125)).toBe(0.13);
  });
});
