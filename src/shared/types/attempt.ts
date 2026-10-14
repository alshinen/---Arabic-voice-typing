import type { ExamType, QuestionType } from './domain';
import type { IdentifyMode } from './exam';
import type { Option, Region } from './question';

/** اختبار متاح في صفحة المتدرب. */
export interface AvailableExam {
  id: string;
  title: string;
  examType: ExamType;
  subtitle: string;
  questionCount: number;
  totalPoints: number;
  timeLimitMinutes: number | null;
  identifyMode: IdentifyMode;
}

/** ما يُرسل لتعريف المتدرب حسب طريقة الاختبار. */
export interface IdentityInput {
  traineeId?: string | null;
  number?: string | null;
  name?: string | null;
}

/**
 * السؤال كما يراه المتدرب: دون أي إجابة صحيحة أو منطقة صورة (invariant 7).
 * reveal يظهر فقط بعد انتهاء محاولات السؤال إن سمح المدرب بذلك.
 */
export interface PublicQuestion {
  aqId: string;
  position: number;
  type: QuestionType;
  text: string;
  imageId: string | null;
  image: { width: number; height: number } | null;
  points: number;
  maxTries: number;
  triesUsed: number;
  done: boolean;
  /** نتيجة آخر محاولة: true صحيحة، false خاطئة، null لم يجب بعد. */
  lastCorrect: boolean | null;
  /** آخر إجابة في «اذكر» والمهارات، لتبقى في المواضع (design.md 1.3ب). */
  lastSelections: (string | null)[] | null;
  mcqOptions: Option[] | null;
  /** «اذكر»: خيارات كل موضع. المهارات: الخيارات نفسها لكل بند. */
  slots: { label: string | null; options: Option[] }[] | null;
  reveal: Reveal | null;
}

export type Reveal =
  | { type: 'TF'; correct: boolean }
  | { type: 'MCQ'; correctId: string }
  | { type: 'SLOTS'; correctTexts: string[] }
  | { type: 'HOTSPOT'; regions: Region[] };

export interface AttemptState {
  attemptId: string;
  preview: boolean;
  examTitle: string;
  examType: ExamType;
  traineeName: string | null;
  /** الثواني المتبقية، أو null إن لم يكن للاختبار وقت. */
  secondsLeft: number | null;
  finished: boolean;
  questions: PublicQuestion[];
  totalPoints: number;
}

export interface TryResult {
  correct: boolean;
  triesLeft: number;
  done: boolean;
  question: PublicQuestion;
}

export interface AttemptOutcome {
  earned: number;
  total: number;
  percent: number;
  passed: boolean | null;
  passLabel: string;
  status: 'submitted' | 'timed_out';
}
