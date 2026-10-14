import type { AttemptOutcome, AttemptState, AvailableExam, IdentityInput, PublicQuestion, TryResult } from './attempt';
import type { BankKind, ExamType, QuestionType } from './domain';
import type { ExamStatus, ExamStored, ExamSummary } from './exam';
import type { QuestionSummary, StoredQuestion } from './question';
import type { TryGrade } from '../scoring/grade';

export interface BankSummary {
  id: string;
  kind: BankKind;
  name: string;
  gradeCode: string | null;
  countsByType: Record<QuestionType, number>;
  total: number;
}

/** نتيجة موحدة لكل استدعاء: نجاح مع بيانات، أو رسالة خطأ بالعربية. */
export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string };
type R<T> = Promise<ApiResult<T>>;

export interface ImageInfo {
  id: string;
  title: string;
  width: number;
  height: number;
  usedBy: number;
}
export interface ReadyList {
  id: string;
  name: string;
  items: string[];
}
export interface Lesson {
  id: string;
  courseId: string | null;
  lessonNumber: number | null;
  title: string;
  date: string | null;
}
export interface Course {
  id: string;
  courseNumber: string;
  courseName: string;
  startDate: string | null;
  lessons: Lesson[];
}
export interface Trainee {
  id: string;
  number: string | null;
  fullName: string;
  currentLevel: number | null;
  active: boolean;
}
export interface ResultRow {
  attemptId: string;
  examId: string;
  examTitle: string;
  examType: ExamType;
  traineeName: string;
  traineeNumber: string | null;
  startedAt: string;
  status: 'in_progress' | 'submitted' | 'timed_out';
  score: number | null;
  maxScore: number | null;
  percent: number | null;
  passed: boolean | null;
}
export interface ResultDetail extends ResultRow {
  questions: {
    position: number;
    question: StoredQuestion;
    points: number;
    earned: number | null;
    tries: { tryNumber: number; correct: boolean; response: unknown; answeredAt: string }[];
  }[];
}
export interface ResultFilter {
  examId?: string | null;
  examType?: ExamType | null;
}
export interface LanStatus {
  running: boolean;
  port: number;
  urls: string[];
}
export interface DataInfo {
  version: string;
  dataDir: string;
  portable: boolean;
}

/** واجهة المتدرب: تعمل عبر IPC داخل البرنامج، وعبر HTTP من أجهزة الشبكة. */
export interface TraineeApi {
  exams(): R<AvailableExam[]>;
  pickList(examId: string): R<{ id: string; name: string }[]>;
  lookup(number: string): R<{ traineeId: string; name: string }>;
  start(examId: string, identity: IdentityInput): R<AttemptState>;
  state(attemptId: string): R<AttemptState>;
  submitTry(attemptId: string, aqId: string, response: unknown): R<TryResult>;
  acceptBest(attemptId: string, aqId: string): R<PublicQuestion>;
  finish(attemptId: string): R<AttemptOutcome>;
  imageUrl(imageId: string): string;
}

/** الواجهة الكاملة داخل البرنامج (window.api). */
export interface TrainerApi {
  auth: {
    status(): R<{ hasPassword: boolean; loggedIn: boolean }>;
    setup(password: string): R<null>;
    login(password: string): R<null>;
    logout(): R<null>;
    change(oldPassword: string, newPassword: string): R<null>;
  };
  banks: { list(): R<BankSummary[]> };
  questions: {
    list(filter: { bankId: string; type?: QuestionType | null; search?: string | null }): R<QuestionSummary[]>;
    get(id: string): R<StoredQuestion>;
    save(question: unknown, tested: boolean): R<StoredQuestion>;
    copy(id: string, targetBankId: string | null): R<StoredQuestion>;
    archive(id: string): R<null>;
    gradePreview(question: unknown, response: unknown): R<TryGrade>;
  };
  readyLists: {
    list(): R<ReadyList[]>;
    save(list: { id: string | null; name: string; items: string[] }): R<ReadyList>;
    remove(id: string): R<null>;
  };
  images: {
    list(): R<ImageInfo[]>;
    add(input: { bytes: Uint8Array; fileName: string; title: string; width: number; height: number }): R<ImageInfo>;
    rename(id: string, title: string): R<null>;
    remove(id: string): R<null>;
  };
  courses: {
    list(): R<Course[]>;
    saveCourse(c: { id: string | null; courseNumber: string; courseName: string; startDate: string | null }): R<string>;
    archiveCourse(id: string): R<null>;
    saveLesson(l: { id: string | null; courseId: string | null; lessonNumber: number | null; title: string; date: string | null }): R<string>;
    removeLesson(id: string): R<null>;
  };
  trainees: {
    list(includeInactive: boolean): R<Trainee[]>;
    save(t: { id: string | null; number: string | null; fullName: string; currentLevel: number | null; active: boolean }): R<Trainee>;
    remove(id: string): R<null>;
    importCsv(text: string): R<{ added: number; updated: number; skipped: string[] }>;
  };
  exams: {
    list(): R<ExamSummary[]>;
    get(id: string): R<ExamStored>;
    save(exam: unknown): R<ExamStored>;
    setStatus(id: string, status: ExamStatus): R<null>;
    setOpen(id: string, open: boolean): R<null>;
    remove(id: string): R<null>;
    problems(id: string): R<string[]>;
    availability(examType: ExamType, gradeId: string | null): R<Record<QuestionType, number>>;
    bankQuestions(examType: ExamType, gradeId: string | null): R<QuestionSummary[]>;
    previewStart(examId: string): R<AttemptState>;
    previewDiscard(attemptId: string): R<null>;
  };
  results: {
    list(filter: ResultFilter): R<ResultRow[]>;
    detail(attemptId: string): R<ResultDetail>;
    exportCsv(filter: ResultFilter): R<string | null>;
    grantExtra(attemptId: string): R<null>;
  };
  data: {
    info(): R<DataInfo>;
    backup(): R<string | null>;
    restore(): R<boolean>;
    exportResults(): R<string | null>;
    importResults(): R<{ added: number; duplicates: number; skipped: number } | null>;
    openFolder(): R<null>;
  };
  lan: {
    status(): R<LanStatus>;
    start(port: number): R<LanStatus>;
    stop(): R<LanStatus>;
  };
  trainee: TraineeApi;
}
