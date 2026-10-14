import type { LateTryScoring } from '../types/domain';
import { lateTryMultiplier } from './attempts';

export interface SingleAnswerInput {
  /** درجة السؤال كما حددها المدرب، مثل 0.25 أو 0.5 أو 1. */
  points: number;
  /** عدد المحاولات المسموحة. */
  maxTries: number;
  mode: LateTryScoring;
  /** نتيجة كل محاولة بالترتيب: true صحيحة، false خاطئة. */
  attempts: readonly boolean[];
}

export interface SingleAnswerResult {
  earned: number;
  /** رقم المحاولة التي أصاب فيها، أو null إن لم يُصب. */
  correctOnTry: number | null;
  /** عدد المحاولات المحتسبة فعلًا. */
  triesUsed: number;
}

/**
 * تصحيح الأسئلة ذات الإجابة الواحدة: صح وخطأ، واختيار من متعدد، وسؤال الصورة.
 * يتوقف الحساب عند أول إصابة، ولا تُحتسب محاولات بعد الحد المسموح.
 */
export function scoreSingleAnswer(input: SingleAnswerInput): SingleAnswerResult {
  const { points, maxTries, mode, attempts } = input;
  assertPoints(points);
  if (!Number.isInteger(maxTries) || maxTries < 1) {
    throw new RangeError(`عدد المحاولات غير صالح: ${maxTries}`);
  }
  const counted = attempts.slice(0, maxTries);
  const index = counted.indexOf(true);
  if (index === -1) {
    return { earned: 0, correctOnTry: null, triesUsed: counted.length };
  }
  const tryNumber = index + 1;
  return {
    earned: points * lateTryMultiplier(tryNumber, mode),
    correctOnTry: tryNumber,
    triesUsed: tryNumber,
  };
}

export function assertPoints(points: number): void {
  if (!Number.isFinite(points) || points < 0) {
    throw new RangeError(`درجة السؤال غير صالحة: ${points}`);
  }
}
