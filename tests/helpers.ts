import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { AppDatabase } from '../src/main/db/database';
import { AttemptService } from '../src/main/services/attempts';
import { ExamService } from '../src/main/services/exams';
import { ImageService } from '../src/main/services/images';
import { QuestionService } from '../src/main/services/questions';
import { ResultService } from '../src/main/services/results';
import { TraineeService } from '../src/main/services/trainees';
import { TransferService } from '../src/main/services/transfer';
import { seededRng } from '../src/shared/draw/random';
import { defaultSettings } from '../src/shared/types/exam';
import type { ExamInput } from '../src/shared/types/exam';
import type { Question } from '../src/shared/types/question';

export async function setup(seed = 1, now?: () => Date) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'exams-'));
  const dbFile = path.join(dir, 'data.sqlite');
  const db = await AppDatabase.open(dbFile);
  const questions = new QuestionService(db);
  const exams = new ExamService(db);
  const trainees = new TraineeService(db);
  const images = new ImageService(db, path.join(dir, 'images'));
  const attempts = new AttemptService({ db, questions, exams, trainees, rng: seededRng(seed), now });
  const results = new ResultService(db);
  const transfer = new TransferService(db, dbFile, path.join(dir, 'images'));
  return { dir, dbFile, db, questions, exams, trainees, images, attempts, results, transfer };
}

let counter = 0;
const opt = (text: string) => ({ id: `o${++counter}`, text });

export function tfQuestion(bankId: string, correct = true, extra: Partial<Question> = {}): Question {
  return {
    id: `tf${++counter}`,
    bankId,
    type: 'TF',
    text: `عبارة ${counter}`,
    imageId: null,
    points: 0.5,
    level: 'advanced',
    maxTries: 1,
    lateTryScoring: 'first_only',
    shuffleOptions: true,
    data: { correct },
    ...extra,
  } as Question;
}

export function mcqQuestion(bankId: string): Question & { type: 'MCQ' } {
  const options = [opt('أخضر'), opt('أزرق'), opt('أحمر'), opt('أبيض')];
  return {
    id: `mcq${++counter}`,
    bankId,
    type: 'MCQ',
    text: 'لون مؤشر ضغط الزيت؟',
    imageId: null,
    points: 1,
    level: 'intermediate',
    maxTries: 2,
    lateTryScoring: 'decreasing',
    shuffleOptions: true,
    data: { options, correctId: options[2]!.id },
  };
}

export function listQuestion(bankId: string): Question & { type: 'LIST' } {
  const options = ['عداد السرعة', 'مؤشر الوقود', 'عداد الدوران', 'مؤشر الحرارة', 'المرآة', 'المقعد'].map(opt);
  return {
    id: `list${++counter}`,
    bankId,
    type: 'LIST',
    text: 'اذكر ثلاثة أجزاء من لوحة السائق',
    imageId: null,
    points: 1.5,
    level: 'beginner',
    maxTries: 3,
    lateTryScoring: 'decreasing',
    shuffleOptions: true,
    data: {
      ordered: false,
      shared: true,
      options,
      slots: [0, 1, 2].map(() => ({ options: [], correctId: null })),
      correctIds: options.slice(0, 4).map((o) => o.id),
      scoring: 'partial',
      itemPoints: null,
    },
  };
}

export function examInput(over: Partial<ExamInput> & Pick<ExamInput, 'examType'>): ExamInput {
  return {
    id: `exam${++counter}`,
    title: 'اختبار',
    courseId: null,
    gradeId: null,
    lessonId: null,
    questionMode: 'fixed',
    identifyMode: 'name',
    settings: defaultSettings(over.examType),
    questions: [],
    drawRules: [],
    ...over,
  };
}
