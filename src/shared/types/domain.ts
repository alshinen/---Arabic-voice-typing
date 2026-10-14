/** أنواع الأسئلة: صح وخطأ، اختيار من متعدد، اذكر، مهارات، سؤال صورة. */
export type QuestionType = 'TF' | 'MCQ' | 'LIST' | 'SKILL' | 'HOTSPOT';

/** أنواع الاختبار: دورة، ترفيع درجة، سريع بعد الحصة، مفاجئ. */
export type ExamType = 'course' | 'promotion' | 'quick' | 'surprise';

/** طريقة احتساب الدرجة عند الإصابة في محاولة متأخرة (design.md 1.3ب). */
export type LateTryScoring = 'decreasing' | 'full' | 'first_only';

/** طريقة توزيع درجة الأسئلة متعددة البنود (design.md 4.6). */
export type MultiItemScoring = 'partial' | 'all_or_nothing' | 'per_item';

/** مستوى المتدرب وعدد المحاولات المقابل له (design.md 1.3ب). */
export type TriesLevel = 'beginner' | 'intermediate' | 'advanced';

export const TRIES_BY_LEVEL: Record<TriesLevel, number> = {
  beginner: 3,
  intermediate: 2,
  advanced: 1,
};

export type BankKind = 'promotion' | 'general';

/** حد النجاح: نسبة مئوية، أو عدد درجات، أو بلا حد (design.md 2.5). */
export type PassRule =
  | { mode: 'percent'; value: number }
  | { mode: 'points'; value: number }
  | { mode: 'none' };
