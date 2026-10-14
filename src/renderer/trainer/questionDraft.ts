import type { PublicQuestion } from '../../shared/types/attempt';
import type { QuestionType } from '../../shared/types/domain';
import { TRIES_BY_LEVEL } from '../../shared/types/domain';
import type { Option, Question } from '../../shared/types/question';
import { newId } from '../util';

export const opt = (text = ''): Option => ({ id: newId(), text });

/** سؤال جديد فارغ بالقيم الافتراضية المعتمدة (design.md القسم 9). */
export function blankQuestion(type: QuestionType, bankId: string): Question {
  const base = {
    id: newId(),
    bankId,
    text: '',
    imageId: null,
    points: 1,
    level: 'advanced' as const,
    maxTries: TRIES_BY_LEVEL.advanced,
    lateTryScoring: type === 'TF' ? ('first_only' as const) : ('decreasing' as const),
    shuffleOptions: true,
  };
  switch (type) {
    case 'TF':
      return { ...base, type, points: 0.5, data: { correct: true } };
    case 'MCQ': {
      const options = [opt(), opt(), opt(), opt()];
      return { ...base, type, data: { options, correctId: options[0]!.id } };
    }
    case 'LIST':
      return {
        ...base,
        type,
        data: {
          ordered: false,
          shared: true,
          options: [],
          slots: [0, 1, 2].map(() => ({ options: [], correctId: null })),
          correctIds: [],
          scoring: 'partial',
          itemPoints: null,
        },
      };
    case 'SKILL':
      return { ...base, type, data: { options: [], items: [{ label: '', correctId: '', points: null }], scoring: 'partial' } };
    case 'HOTSPOT':
      return { ...base, type, data: { regions: [], tolerance: 0.01 } };
  }
}

/** يحذف الخيارات الفارغة قبل الحفظ. */
export function cleanQuestion(q: Question): Question {
  const clean = (opts: Option[]) => opts.filter((o) => o.text.trim()).map((o) => ({ ...o, text: o.text.trim() }));
  switch (q.type) {
    case 'MCQ':
      return { ...q, data: { ...q.data, options: clean(q.data.options) } };
    case 'LIST':
      return {
        ...q,
        data: {
          ...q.data,
          options: q.data.shared ? clean(q.data.options) : [],
          slots: q.data.slots.map((s) => ({ ...s, options: q.data.shared ? [] : clean(s.options) })),
          correctIds: q.data.ordered ? [] : q.data.correctIds,
          itemPoints: q.data.scoring === 'per_item' ? q.data.itemPoints : null,
        },
      };
    case 'SKILL':
      return {
        ...q,
        data: {
          ...q.data,
          options: clean(q.data.options),
          items: q.data.items.map((it) => ({ ...it, points: q.data.scoring === 'per_item' ? it.points : null })),
        },
      };
    default:
      return q;
  }
}

/** يحوّل مسودة المدرب إلى شكل السؤال الذي يراه المتدرب، لزر «تجربة». */
export function draftToPublic(
  q: Question,
  image: { width: number; height: number } | null,
  triesUsed: number,
  done: boolean,
  lastCorrect: boolean | null,
  lastSelections: (string | null)[] | null,
): PublicQuestion {
  const shuffled = <T,>(a: T[]) => (q.shuffleOptions ? [...a].sort(() => Math.random() - 0.5) : a);
  let slots: PublicQuestion['slots'] = null;
  if (q.type === 'LIST') {
    const shared = shuffled(q.data.options);
    slots = q.data.slots.map((s) => ({ label: null, options: q.data.shared ? shared : shuffled(s.options) }));
  }
  if (q.type === 'SKILL') {
    const options = shuffled(q.data.options);
    slots = q.data.items.map((it) => ({ label: it.label, options }));
  }
  return {
    aqId: q.id,
    position: 0,
    type: q.type,
    text: q.text,
    imageId: q.imageId,
    image,
    points: q.points,
    maxTries: q.maxTries,
    triesUsed,
    done,
    lastCorrect,
    lastSelections,
    mcqOptions: q.type === 'MCQ' ? shuffled(q.data.options) : null,
    slots,
    reveal: null,
  };
}
