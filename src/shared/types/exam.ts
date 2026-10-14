import { z } from 'zod';
import type { ExamType } from './domain';

export const passRuleSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('percent'), value: z.number().min(0).max(100) }),
  z.object({ mode: z.literal('points'), value: z.number().min(0) }),
  z.object({ mode: z.literal('none') }),
]);

export const examSettingsSchema = z.object({
  pass: passRuleSchema,
  timeLimitMinutes: z.number().int().positive().max(600).nullable(),
  showCorrectAfterTries: z.boolean(),
  /** عدد مرات دخول المتدرب للاختبار، وnull = غير محدود. */
  maxAttemptsPerTrainee: z.number().int().positive().nullable(),
});
export type ExamSettings = z.infer<typeof examSettingsSchema>;

export const identifyModeSchema = z.enum(['name', 'number_lookup', 'number_and_name', 'pick_list']);
export type IdentifyMode = z.infer<typeof identifyModeSchema>;

export const examInputSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1, 'اكتب اسم الاختبار'),
  examType: z.enum(['course', 'promotion', 'quick', 'surprise']),
  courseId: z.string().nullable(),
  gradeId: z.string().nullable(),
  lessonId: z.string().nullable(),
  questionMode: z.enum(['random_draw', 'fixed']),
  identifyMode: identifyModeSchema,
  settings: examSettingsSchema,
  questions: z.array(z.object({ questionId: z.string(), points: z.number().nonnegative() })),
  drawRules: z.array(
    z.object({
      type: z.enum(['TF', 'MCQ', 'LIST', 'SKILL', 'HOTSPOT']),
      count: z.number().int().nonnegative(),
      points: z.number().nonnegative(),
    }),
  ),
});
export type ExamInput = z.infer<typeof examInputSchema>;

export type ExamStatus = 'draft' | 'published' | 'archived';

export interface ExamStored extends ExamInput {
  status: ExamStatus;
  isOpen: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ExamSummary {
  id: string;
  title: string;
  examType: ExamType;
  status: ExamStatus;
  isOpen: boolean;
  questionCount: number;
  totalPoints: number;
  subtitle: string;
  attempts: number;
}

/** الإعدادات الافتراضية لكل نوع اختبار (design.md القسم 9). */
export function defaultSettings(type: ExamType): ExamSettings {
  switch (type) {
    case 'quick':
      return { pass: { mode: 'none' }, timeLimitMinutes: null, showCorrectAfterTries: true, maxAttemptsPerTrainee: null };
    case 'surprise':
      return { pass: { mode: 'points', value: 3 }, timeLimitMinutes: null, showCorrectAfterTries: false, maxAttemptsPerTrainee: 1 };
    case 'course':
    case 'promotion':
      return { pass: { mode: 'percent', value: 70 }, timeLimitMinutes: null, showCorrectAfterTries: false, maxAttemptsPerTrainee: 1 };
  }
}

/** طريقة اختيار الأسئلة الافتراضية: السحب العشوائي في الترفيع، والاختيار اليدوي في غيره. */
export function defaultQuestionMode(type: ExamType): 'random_draw' | 'fixed' {
  return type === 'promotion' ? 'random_draw' : 'fixed';
}

/** البنك الذي تؤخذ منه أسئلة الاختبار (design.md 1.4). */
export function bankForExam(type: ExamType, gradeId: string | null): string | null {
  if (type !== 'promotion') return 'bank-general';
  if (!gradeId) return null;
  return `bank-${gradeId.replace('grade-', '')}`;
}
