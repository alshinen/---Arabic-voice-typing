import { z } from 'zod';

/** بديل أو خيار داخل قائمة. المعرّف يُنشأ عند الحفظ. */
export const optionSchema = z.object({
  id: z.string().min(1),
  text: z.string().trim().min(1, 'نص الخيار فارغ'),
});
export type Option = z.infer<typeof optionSchema>;

export const regionSchema = z.discriminatedUnion('shape', [
  z.object({
    shape: z.literal('rect'),
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    w: z.number().positive().max(1),
    h: z.number().positive().max(1),
  }),
  z.object({
    shape: z.literal('ellipse'),
    cx: z.number().min(0).max(1),
    cy: z.number().min(0).max(1),
    rx: z.number().positive().max(1),
    ry: z.number().positive().max(1),
  }),
]);
export type Region = z.infer<typeof regionSchema>;

const multiScoring = z.enum(['partial', 'all_or_nothing', 'per_item']);

export const tfDataSchema = z.object({ correct: z.boolean() });

export const mcqDataSchema = z.object({
  options: z.array(optionSchema).min(2, 'يجب أن يكون للسؤال بديلان على الأقل'),
  correctId: z.string().min(1, 'حدد البديل الصحيح'),
});

/**
 * «اذكر» (design.md 2.3):
 * - shared: كل المواضع تستخدم القائمة options. وإلا فلكل موضع قائمته slots[i].options.
 * - ordered = false: الإجابات الصحيحة correctIds من القائمة المشتركة (ودون ترتيب تُفرض القائمة المشتركة).
 * - ordered = true: لكل موضع إجابته الصحيحة slots[i].correctId.
 */
export const listDataSchema = z.object({
  ordered: z.boolean(),
  shared: z.boolean(),
  options: z.array(optionSchema),
  slots: z
    .array(z.object({ options: z.array(optionSchema), correctId: z.string().nullable() }))
    .min(1, 'يجب أن يكون للسؤال موضع واحد على الأقل'),
  correctIds: z.array(z.string()),
  scoring: multiScoring,
  itemPoints: z.array(z.number().nonnegative()).nullable(),
});

/** المهارات: قائمة خيارات مشتركة، ولكل بند وصف وإجابة صحيحة. */
export const skillDataSchema = z.object({
  options: z.array(optionSchema).min(2, 'أضف خيارين على الأقل'),
  items: z
    .array(
      z.object({
        label: z.string().trim().min(1, 'وصف البند فارغ'),
        correctId: z.string().min(1, 'حدد الإجابة الصحيحة لكل بند'),
        points: z.number().nonnegative().nullable(),
      }),
    )
    .min(1, 'أضف بندًا واحدًا على الأقل'),
  scoring: multiScoring,
});

export const hotspotDataSchema = z.object({
  regions: z.array(regionSchema).min(1, 'ارسم منطقة الإجابة الصحيحة على الصورة'),
  tolerance: z.number().min(0).max(0.2),
});

export const questionTypeSchema = z.enum(['TF', 'MCQ', 'LIST', 'SKILL', 'HOTSPOT']);

const base = {
  id: z.string().min(1),
  bankId: z.string().min(1),
  text: z.string().trim().min(1, 'اكتب نص السؤال'),
  imageId: z.string().nullable(),
  points: z.number().nonnegative('الدرجة لا تكون سالبة'),
  level: z.enum(['beginner', 'intermediate', 'advanced']).nullable(),
  maxTries: z.number().int().min(1, 'عدد المحاولات واحد على الأقل').max(10),
  lateTryScoring: z.enum(['decreasing', 'full', 'first_only']),
  shuffleOptions: z.boolean(),
};

export const questionSchema = z.discriminatedUnion('type', [
  z.object({ ...base, type: z.literal('TF'), data: tfDataSchema }),
  z.object({ ...base, type: z.literal('MCQ'), data: mcqDataSchema }),
  z.object({ ...base, type: z.literal('LIST'), data: listDataSchema }),
  z.object({ ...base, type: z.literal('SKILL'), data: skillDataSchema }),
  z.object({ ...base, type: z.literal('HOTSPOT'), data: hotspotDataSchema }),
]);

export type Question = z.infer<typeof questionSchema>;
export type QuestionOf<T extends Question['type']> = Extract<Question, { type: T }>;
export type ListData = z.infer<typeof listDataSchema>;
export type SkillData = z.infer<typeof skillDataSchema>;

/** السؤال كما يُخزَّن ويُعرض للمدرب، مع معلومات إضافية. */
export type StoredQuestion = Question & {
  testedAt: string | null;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
};

/** ملخص للسؤال في قوائم البنك. */
export interface QuestionSummary {
  id: string;
  bankId: string;
  type: Question['type'];
  text: string;
  points: number;
  maxTries: number;
  tested: boolean;
  usedInExams: number;
}

/**
 * يتحقق من منطق السؤال بعد تحقق البنية، ويرجع رسائل عربية مفهومة للمدرب.
 * (الإجابة الصحيحة موجودة ضمن الخيارات، إلخ.)
 */
export function validateQuestionLogic(q: Question): string[] {
  const errors: string[] = [];
  const ids = (opts: Option[]) => new Set(opts.map((o) => o.id));
  const dupText = (opts: Option[]) => new Set(opts.map((o) => o.text.trim())).size !== opts.length;

  switch (q.type) {
    case 'MCQ':
      if (!ids(q.data.options).has(q.data.correctId)) errors.push('حدد البديل الصحيح');
      if (dupText(q.data.options)) errors.push('يوجد بديلان بالنص نفسه');
      break;
    case 'LIST': {
      const d = q.data;
      if (!d.ordered && !d.shared) errors.push('في «اذكر» دون ترتيب يجب أن تكون القائمة مشتركة');
      if (d.shared) {
        if (d.options.length < d.slots.length) errors.push('عدد الخيارات أقل من عدد المواضع');
        if (dupText(d.options)) errors.push('يوجد خياران بالنص نفسه');
      }
      if (!d.ordered) {
        const all = ids(d.options);
        const correct = new Set(d.correctIds.filter((c) => all.has(c)));
        if (correct.size < d.slots.length) {
          errors.push(`طلبت ${d.slots.length} إجابات، لكن حددت ${correct.size} إجابات صحيحة فقط`);
        }
      } else {
        d.slots.forEach((s, i) => {
          const list = d.shared ? d.options : s.options;
          if (!d.shared && list.length < 2) errors.push(`الموضع ${i + 1}: أضف خيارين على الأقل`);
          if (!s.correctId || !ids(list).has(s.correctId)) errors.push(`الموضع ${i + 1}: حدد الإجابة الصحيحة`);
        });
      }
      if (d.scoring === 'per_item' && (!d.itemPoints || d.itemPoints.length !== d.slots.length)) {
        errors.push('حدد درجة لكل موضع');
      }
      break;
    }
    case 'SKILL': {
      const all = ids(q.data.options);
      q.data.items.forEach((it, i) => {
        if (!all.has(it.correctId)) errors.push(`البند ${i + 1}: حدد الإجابة الصحيحة`);
        if (q.data.scoring === 'per_item' && it.points === null) errors.push(`البند ${i + 1}: حدد درجة البند`);
      });
      if (dupText(q.data.options)) errors.push('يوجد خياران بالنص نفسه');
      break;
    }
    case 'HOTSPOT':
      if (!q.imageId) errors.push('اختر صورة للسؤال');
      break;
    case 'TF':
      break;
  }
  return errors;
}

/** الدرجة الكاملة للسؤال: في «درجة لكل بند» هي مجموع درجات البنود. */
export function questionMaxPoints(q: Question): number {
  if (q.type === 'LIST' && q.data.scoring === 'per_item') return (q.data.itemPoints ?? []).reduce((a, b) => a + b, 0);
  if (q.type === 'SKILL' && q.data.scoring === 'per_item') {
    return q.data.items.reduce((a, it) => a + (it.points ?? 0), 0);
  }
  return q.points;
}

/** حد أدنى مُستحسن لحجم قائمة «اذكر» حتى تشوّش على المتدرب (design.md 1.7). */
export const RECOMMENDED_LIST_SIZE = 15;
