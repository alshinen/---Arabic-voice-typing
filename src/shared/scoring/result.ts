import type { PassRule } from '../types/domain';

const EPSILON = 1e-9;

export interface ExamOutcome {
  earned: number;
  total: number;
  /** النسبة المئوية بدقة كاملة. */
  percent: number;
  /** ناجح أو راسب، أو null إن كان الاختبار بلا حد نجاح. */
  passed: boolean | null;
}

/** النتيجة النهائية للاختبار (design.md 4.8). */
export function evaluateExam(earned: number, total: number, rule: PassRule): ExamOutcome {
  if (!Number.isFinite(total) || total < 0 || !Number.isFinite(earned) || earned < 0) {
    throw new RangeError('درجات غير صالحة');
  }
  const percent = total === 0 ? 0 : (earned / total) * 100;
  let passed: boolean | null;
  switch (rule.mode) {
    case 'none':
      passed = null;
      break;
    case 'percent':
      passed = percent + EPSILON >= rule.value;
      break;
    case 'points':
      passed = earned + EPSILON >= rule.value;
      break;
  }
  return { earned, total, percent, passed };
}

/** يُستخدم للعرض فقط: الدرجات تُخزَّن بدقة كاملة وتُعرض مقربة لرقمين عشريين. */
export function roundForDisplay(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** مجموع درجات الاختبار. */
export function sumPoints(points: readonly number[]): number {
  return points.reduce((a, b) => a + b, 0);
}
