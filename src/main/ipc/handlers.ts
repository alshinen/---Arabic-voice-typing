import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import fs from 'node:fs';
import os from 'node:os';
import { z } from 'zod';
import { gradeTry, responseSchema } from '../../shared/scoring/grade';
import { questionSchema } from '../../shared/types/question';
import type { ApiResult, ResultFilter } from '../../shared/types/api';
import type { ExamStatus } from '../../shared/types/exam';
import type { ExamType } from '../../shared/types/domain';
import { bankForExam } from '../../shared/types/exam';
import type { LanServer } from '../server/lan';
import { isSeatSender, type SeatManager } from '../seats/seatWindow';
import { screen } from 'electron';
import type { AttemptService } from '../services/attempts';
import type { AuthService } from '../services/auth';
import type { BankService } from '../services/banks';
import type { CourseService } from '../services/courses';
import type { ExamService } from '../services/exams';
import type { ImageService } from '../services/images';
import type { QuestionService } from '../services/questions';
import type { ReadyListService } from '../services/readyLists';
import type { ResultService } from '../services/results';
import type { TraineeService } from '../services/trainees';
import type { TransferService } from '../services/transfer';
import { UserError } from '../services/util';
import { ar } from '../../shared/i18n/ar';
import { callTrainee } from './trainee';

export interface Services {
  auth: AuthService;
  banks: BankService;
  questions: QuestionService;
  readyLists: ReadyListService;
  images: ImageService;
  courses: CourseService;
  trainees: TraineeService;
  exams: ExamService;
  attempts: AttemptService;
  results: ResultService;
  transfer: TransferService;
  lan: LanServer;
  seats: SeatManager;
  dataDir: string;
  portable: boolean;
}

const password = z.string().min(1).max(200);
const s = (v: unknown) => z.string().min(1).parse(v);
const parentWindow = () => BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]!;
const stamp = () => new Date().toISOString().slice(0, 10);

async function saveFile(defaultName: string, ext: string, label: string, content: Buffer | string): Promise<string | null> {
  const r = await dialog.showSaveDialog(parentWindow(), {
    defaultPath: defaultName,
    filters: [{ name: label, extensions: [ext] }],
  });
  if (r.canceled || !r.filePath) return null;
  fs.writeFileSync(r.filePath, content);
  return r.filePath;
}

async function openFile(ext: string, label: string): Promise<Buffer | null> {
  const r = await dialog.showOpenDialog(parentWindow(), { properties: ['openFile'], filters: [{ name: label, extensions: [ext] }] });
  const file = r.filePaths[0];
  if (r.canceled || !file) return null;
  return fs.readFileSync(file);
}

/** يسجل كل قنوات IPC. دوال المدرب تتطلب دخوله، ودوال المتدرب والدخول متاحة دائمًا. */
export function registerHandlers(sv: Services): void {
  let loggedIn = false;

  const trainer: Record<string, Record<string, (...a: unknown[]) => unknown>> = {
    banks: { list: () => sv.banks.list() },
    questions: {
      list: (f) => sv.questions.list(f as { bankId: string }),
      get: (id) => sv.questions.get(s(id)),
      save: (q, tested) => sv.questions.save(q, Boolean(tested)),
      copy: (id, target) => sv.questions.copy(s(id), (target as string | null) ?? undefined),
      archive: (id) => (sv.questions.archive(s(id)), null),
      gradePreview: (q, r) => {
        const question = questionSchema.parse(q);
        return gradeTry(question, responseSchema.parse(r));
      },
    },
    readyLists: {
      list: () => sv.readyLists.list(),
      save: (l) => sv.readyLists.save(l),
      remove: (id) => (sv.readyLists.remove(s(id)), null),
    },
    images: {
      list: () => sv.images.list(),
      add: (input) => sv.images.add(input as Parameters<ImageService['add']>[0]),
      rename: (id, title) => (sv.images.rename(s(id), String(title ?? '')), null),
      remove: (id) => (sv.images.remove(s(id)), null),
    },
    courses: {
      list: () => sv.courses.list(),
      saveCourse: (c) => sv.courses.saveCourse(c),
      archiveCourse: (id) => (sv.courses.archiveCourse(s(id)), null),
      saveLesson: (l) => sv.courses.saveLesson(l),
      removeLesson: (id) => (sv.courses.removeLesson(s(id)), null),
    },
    trainees: {
      list: (all) => sv.trainees.list(Boolean(all)),
      save: (t) => sv.trainees.save(t),
      remove: (id) => (sv.trainees.remove(s(id)), null),
      importCsv: (text) => sv.trainees.importCsv(String(text ?? '')),
    },
    exams: {
      list: () => sv.exams.list(),
      get: (id) => sv.exams.get(s(id)),
      save: (e) => sv.exams.save(e),
      setStatus: (id, st) => (sv.exams.setStatus(s(id), st as ExamStatus), null),
      setOpen: (id, open) => (sv.exams.setOpen(s(id), Boolean(open)), null),
      remove: (id) => (sv.exams.remove(s(id)), null),
      problems: (id) => sv.exams.publishProblems(s(id)),
      availability: (t, g) => sv.exams.bankAvailability(t as ExamType, (g as string | null) ?? null),
      bankQuestions: (t, g) => {
        const bank = bankForExam(t as ExamType, (g as string | null) ?? null);
        return bank ? sv.questions.list({ bankId: bank }) : [];
      },
      previewStart: (id) => sv.attempts.start(s(id), {}, { preview: true }),
      previewDiscard: (id) => (sv.attempts.discardPreview(s(id)), null),
    },
    results: {
      list: (f) => sv.results.list((f ?? {}) as ResultFilter),
      detail: (id) => sv.results.detail(s(id)),
      exportCsv: (f) => saveFile(`النتائج-${stamp()}.csv`, 'csv', 'Excel CSV', sv.results.exportCsv((f ?? {}) as ResultFilter)),
      grantExtra: (id) => (sv.attempts.grantExtraAttempt(s(id)), null),
    },
    data: {
      info: () => ({ version: app.getVersion(), dataDir: sv.dataDir, portable: sv.portable }),
      backup: () => saveFile(`نسخة-احتياطية-${stamp()}.exambak`, 'exambak', 'نسخة احتياطية', sv.transfer.exportBackup()),
      restore: async () => {
        const content = await openFile('exambak', 'نسخة احتياطية');
        if (!content) return false;
        sv.transfer.importBackup(content);
        // إعادة التشغيل فورًا دون حفظ القاعدة المفتوحة حتى لا تُكتب فوق النسخة المستعادة.
        app.relaunch();
        app.exit(0);
        return true;
      },
      exportResults: () =>
        saveFile(`نتائج-${os.hostname()}-${stamp()}.examres`, 'examres', 'ملف نتائج', sv.transfer.exportResults(os.hostname())),
      importResults: async () => {
        const content = await openFile('examres', 'ملف نتائج');
        return content ? sv.transfer.importResults(content) : null;
      },
      openFolder: async () => (await shell.openPath(sv.dataDir), null),
      seatsInfo: () => ({
        supported: sv.seats.supported,
        running: sv.seats.running,
        displays: screen.getAllDisplays().length,
        speed: sv.seats.speed,
      }),
      seatsOpen: () => (sv.seats.open(), null),
      seatsSpeed: (v) => (sv.seats.setSpeed(Number(v)), null),
    },
    lan: {
      status: () => sv.lan.status(),
      start: (port) => sv.lan.start(Number(port)),
      stop: () => sv.lan.stop(),
    },
  };

  const wrap = async (fn: () => unknown): Promise<ApiResult<unknown>> => {
    try {
      return { ok: true, data: await fn() };
    } catch (err) {
      if (err instanceof z.ZodError) return { ok: false, error: err.issues[0]?.message ?? 'البيانات غير صالحة' };
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  };

  for (const [group, methods] of Object.entries(trainer)) {
    for (const [method, fn] of Object.entries(methods)) {
      ipcMain.handle(`${group}:${method}`, (e, ...args) =>
        wrap(() => {
          // نافذة المقعدين للمتدربين فقط: لا تصل منها أي دالة من دوال المدرب.
          if (!loggedIn || isSeatSender(e.sender.id)) throw new UserError('يجب دخول المدرب أولًا');
          return fn(...args);
        }),
      );
    }
  }

  const auth: Record<string, (...a: unknown[]) => unknown> = {
    status: () => ({ hasPassword: sv.auth.hasPassword(), loggedIn }),
    setup: (p) => {
      if (sv.auth.hasPassword()) throw new UserError('كلمة المرور موجودة مسبقًا');
      sv.auth.setPassword(password.parse(p));
      loggedIn = true;
      return null;
    },
    login: (p) => {
      if (!sv.auth.verify(password.parse(p))) throw new UserError('كلمة المرور غير صحيحة');
      loggedIn = true;
      return null;
    },
    logout: () => ((loggedIn = false), null),
    change: (oldP, newP) => {
      if (!loggedIn) throw new UserError('يجب دخول المدرب أولًا');
      if (!sv.auth.verify(password.parse(oldP))) throw new UserError('كلمة المرور الحالية غير صحيحة');
      sv.auth.setPassword(password.parse(newP));
      return null;
    },
  };
  for (const [method, fn] of Object.entries(auth)) {
    ipcMain.handle(`auth:${method}`, (_e, ...args) => wrap(() => fn(...args)));
  }

  for (const method of ['exams', 'pickList', 'lookup', 'start', 'state', 'submitTry', 'acceptBest', 'finish']) {
    ipcMain.handle(`trainee:${method}`, (_e, ...args) => {
      const seat = method === 'start' && (args[2] === 'A' || args[2] === 'B') ? args[2] : null;
      const device = seat ? `${os.hostname()} - ${seat === 'A' ? ar.seats.seatA : ar.seats.seatB}` : os.hostname();
      return callTrainee(sv.attempts, method, method === 'start' ? args.slice(0, 2) : args, device);
    });
  }
}

