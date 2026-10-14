import type { LateTryScoring, MultiItemScoring } from '../types/domain';
import { lateTryMultiplier } from './attempts';
import { assertPoints } from './single';

export type OptionId = string;
/** اختيار المتدرب في كل موضع، أو null إن تركه فارغًا. */
export type SlotSelections = readonly (OptionId | null)[];

/**
 * «اذكر» دون ترتيب (design.md 4.3): عدد الإجابات الصحيحة المختلفة،
 * فالمكرر يُحتسب مرة واحدة، والحد الأعلى عدد المواضع.
 */
export function countUnorderedCorrect(
  selections: SlotSelections,
  correctSet: readonly OptionId[],
): number {
  const correct = new Set(correctSet);
  const distinct = new Set(selections.filter((s): s is OptionId => s !== null && correct.has(s)));
  return Math.min(distinct.size, selections.length);
}

/**
 * «اذكر» بترتيب، والمهارات (design.md 4.4، 4.5): كل موضع يُصحح وحده.
 * accepted[i] هي الإجابات المقبولة للموضع i.
 */
export function orderedCorrectness(
  selections: SlotSelections,
  accepted: readonly (readonly OptionId[])[],
): boolean[] {
  if (selections.length !== accepted.length) {
    throw new RangeError('عدد المواضع لا يطابق عدد الإجابات الصحيحة');
  }
  return selections.map((s, i) => s !== null && (accepted[i] ?? []).includes(s));
}

export interface MultiItemInput {
  /** درجة السؤال. تُتجاهل في per_item لأن الدرجة مجموع درجات البنود. */
  points: number;
  scoring: MultiItemScoring;
  /** درجة كل بند في طريقة per_item. */
  itemPoints?: readonly number[];
  mode: LateTryScoring;
  maxTries: number;
  /** صحة كل بند في كل محاولة: attempts[k][i]. */
  attempts: readonly (readonly boolean[])[];
}

export interface MultiItemResult {
  earned: number;
  /** الدرجة الكاملة الممكنة للسؤال. */
  max: number;
  /** رقم المحاولة التي أعطت أفضل نتيجة، أو null إن لم توجد محاولات. */
  bestTry: number | null;
  /** هل أصبحت كل البنود صحيحة في محاولة ما. */
  fullyCorrect: boolean;
}

/** يحوّل عدد الإجابات الصحيحة في «اذكر» دون ترتيب إلى مصفوفة صحة للبنود. */
export function countToCorrectness(correctCount: number, slots: number): boolean[] {
  return Array.from({ length: slots }, (_, i) => i < correctCount);
}

/**
 * تصحيح «اذكر» والمهارات مع المحاولات:
 * درجة كل محاولة = الدرجة × نسبة الصواب × معامل المحاولة،
 * والنتيجة النهائية أفضل محاولة (design.md 1.3ب).
 */
export function scoreMultiItem(input: MultiItemInput): MultiItemResult {
  const { scoring, mode, maxTries, attempts } = input;
  if (!Number.isInteger(maxTries) || maxTries < 1) {
    throw new RangeError(`عدد المحاولات غير صالح: ${maxTries}`);
  }
  const counted = attempts.slice(0, maxTries);
  const slots = counted[0]?.length ?? input.itemPoints?.length ?? 0;
  const weights = itemWeights(input, slots);
  const max = weights.reduce((a, b) => a + b, 0);

  let earned = 0;
  let bestTry: number | null = null;
  let fullyCorrect = false;

  counted.forEach((items, k) => {
    if (items.length !== slots) {
      throw new RangeError('عدد البنود يختلف بين المحاولات');
    }
    const allCorrect = items.every(Boolean);
    fullyCorrect ||= allCorrect;
    const raw =
      scoring === 'all_or_nothing'
        ? allCorrect
          ? max
          : 0
        : items.reduce((sum, ok, i) => sum + (ok ? (weights[i] ?? 0) : 0), 0);
    const value = raw * lateTryMultiplier(k + 1, mode);
    if (bestTry === null || value > earned) {
      earned = value;
      bestTry = k + 1;
    }
  });

  return { earned, max, bestTry, fullyCorrect };
}

function itemWeights(input: MultiItemInput, slots: number): number[] {
  if (input.scoring === 'per_item') {
    const items = input.itemPoints;
    if (!items || items.length !== slots) {
      throw new RangeError('طريقة «درجة لكل بند» تحتاج درجة لكل بند');
    }
    items.forEach(assertPoints);
    return [...items];
  }
  assertPoints(input.points);
  if (slots === 0) return [];
  return Array.from({ length: slots }, () => input.points / slots);
}
