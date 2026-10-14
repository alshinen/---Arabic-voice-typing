import type { LateTryScoring } from '../types/domain';

/**
 * معامل الدرجة حسب رقم المحاولة التي أصاب فيها المتدرب (تبدأ من 1).
 * decreasing: 1، ثم ½، ثم ¼ ... | full: 1 دائمًا | first_only: 1 في الأولى فقط.
 */
export function lateTryMultiplier(tryNumber: number, mode: LateTryScoring): number {
  if (!Number.isInteger(tryNumber) || tryNumber < 1) {
    throw new RangeError(`رقم المحاولة غير صالح: ${tryNumber}`);
  }
  switch (mode) {
    case 'full':
      return 1;
    case 'first_only':
      return tryNumber === 1 ? 1 : 0;
    case 'decreasing':
      return 1 / 2 ** (tryNumber - 1);
  }
}

/** الطريقة الافتراضية: في «صح أو خطأ» من أول محاولة فقط، وفي غيره خصم تدريجي. */
export function defaultLateTryScoring(isTrueFalse: boolean): LateTryScoring {
  return isTrueFalse ? 'first_only' : 'decreasing';
}
