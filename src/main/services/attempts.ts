import type { AppDatabase } from '../db/database';
import { drawQuestions } from '../../shared/draw/drawQuestions';
import { shuffle, type Rng } from '../../shared/draw/random';
import { ar } from '../../shared/i18n/ar';
import { gradeTry, responseSchema, scoreQuestion, type TryGrade } from '../../shared/scoring/grade';
import { evaluateExam } from '../../shared/scoring/result';
import type {
  AttemptOutcome,
  AttemptState,
  AvailableExam,
  IdentityInput,
  PublicQuestion,
  Reveal,
  TryResult,
} from '../../shared/types/attempt';
import type { ExamType } from '../../shared/types/domain';
import { bankForExam, type ExamSettings, type ExamStored } from '../../shared/types/exam';
import type { Option, Question } from '../../shared/types/question';
import type { ExamService } from './exams';
import type { QuestionService } from './questions';
import { normalizeDigits, type TraineeService } from './trainees';
import { newId, parseJson, UserError } from './util';

interface AttemptRow {
  id: string;
  exam_id: string;
  trainee_id: string | null;
  entered_name: string | null;
  entered_number: string | null;
  exam_snapshot: string;
  started_at: string;
  deadline_at: string | null;
  status: 'in_progress' | 'submitted' | 'timed_out' | 'preview';
  score: number | null;
  max_score: number | null;
  percent: number | null;
  passed: number | null;
}

interface AqRow {
  id: string;
  attempt_id: string;
  question_id: string;
  position: number;
  points: number;
  snapshot: string;
  option_order: string;
  done: number;
  earned: number | null;
}

interface ExamSnapshot {
  title: string;
  examType: ExamType;
  settings: ExamSettings;
  totalPoints: number;
  traineeName: string | null;
  finishedAt?: string;
}

/** ترتيب البدائل والخيارات الخاص بهذا المتدرب. */
interface OptionOrder {
  mcq?: string[];
  shared?: string[];
  slots?: string[][];
}

export interface AttemptDeps {
  db: AppDatabase;
  exams: ExamService;
  questions: QuestionService;
  trainees: TraineeService;
  rng?: Rng;
  now?: () => Date;
}

/** أداء الاختبار: البدء والسحب والتصحيح والنتيجة (design.md 3.3، 4). */
export class AttemptService {
  private readonly db: AppDatabase;
  private readonly rng: Rng;
  private readonly now: () => Date;

  constructor(private readonly deps: AttemptDeps) {
    this.db = deps.db;
    this.rng = deps.rng ?? Math.random;
    this.now = deps.now ?? (() => new Date());
  }

  /** تجارب المدرب لا تُسجَّل: تُحذف عند بدء البرنامج (invariant 11). */
  cleanupPreviews(): void {
    this.db.run("DELETE FROM attempt WHERE status = 'preview'");
  }

  availableExams(): AvailableExam[] {
    return this.deps.exams
      .list()
      .filter((e) => e.status === 'published' && e.isOpen)
      .map((s) => {
        const e = this.deps.exams.get(s.id);
        return {
          id: e.id,
          title: e.title,
          examType: e.examType,
          subtitle: s.subtitle,
          questionCount: s.questionCount,
          totalPoints: s.totalPoints,
          timeLimitMinutes: e.settings.timeLimitMinutes,
          identifyMode: e.identifyMode,
        };
      });
  }

  /** قائمة الأسماء للاختيار. في الترفيع: متدربو الدرجة المناسبة ومن لم تُحدد درجتهم. */
  pickList(examId: string): { id: string; name: string }[] {
    const exam = this.deps.exams.get(examId);
    const level = exam.gradeId
      ? this.db.get<{ from_level: number }>('SELECT from_level FROM grade WHERE id = ?', [exam.gradeId])?.from_level
      : undefined;
    return this.deps.trainees
      .list()
      .filter((t) => exam.examType !== 'promotion' || t.currentLevel === null || t.currentLevel === Number(level))
      .map((t) => ({ id: t.id, name: t.fullName }));
  }

  /** البحث برقم المتدرب، ليظهر اسمه للتأكيد («هل أنت: فلان؟»). */
  lookupNumber(number: string): { traineeId: string; name: string } {
    const t = this.deps.trainees.findByNumber(number);
    if (!t) throw new UserError(ar.trainee.numberNotFound);
    return { traineeId: t.id, name: t.fullName };
  }

  start(examId: string, identity: IdentityInput, opts: { preview?: boolean; device?: string | null } = {}): AttemptState {
    const exam = this.deps.exams.get(examId);
    const preview = Boolean(opts.preview);
    if (!preview && !(exam.status === 'published' && exam.isOpen)) throw new UserError(ar.trainee.examClosed);

    const who = preview ? { traineeId: null, name: null, number: null } : this.resolveIdentity(exam, identity);
    const key = who.traineeId ? ['trainee_id = ?', who.traineeId] : ['trainee_id IS NULL AND entered_name = ?', who.name];

    if (!preview) {
      const open = this.db.get<AttemptRow>(
        `SELECT * FROM attempt WHERE exam_id = ? AND status = 'in_progress' AND ${key[0]} ORDER BY started_at DESC`,
        [examId, key[1] as string],
      );
      if (open) {
        // استئناف بعد إغلاق مفاجئ.
        if (!this.expired(open)) return this.state(open.id);
        this.finish(open.id);
      }
      const done = this.db.get<{ n: number }>(
        `SELECT COUNT(*) AS n FROM attempt WHERE exam_id = ? AND status IN ('submitted','timed_out') AND ${key[0]}`,
        [examId, key[1] as string],
      );
      const max = exam.settings.maxAttemptsPerTrainee;
      const extra = this.extraAllowance(examId, who.traineeId ?? `name:${who.name}`);
      if (max !== null && Number(done?.n ?? 0) >= max + extra) throw new UserError(ar.trainee.noAttemptsLeft);
    }

    const picked = this.pickQuestions(exam, who.traineeId, who.name);
    const total = picked.reduce((a, p) => a + p.points, 0);
    const startedAt = this.now();
    const limit = exam.settings.timeLimitMinutes;
    const snapshot: ExamSnapshot = {
      title: exam.title,
      examType: exam.examType,
      settings: exam.settings,
      totalPoints: total,
      traineeName: who.name,
    };
    const attemptId = newId();
    this.db.transaction(() => {
      this.db.run(
        `INSERT INTO attempt (id, exam_id, trainee_id, entered_name, entered_number, exam_snapshot, device_name,
                started_at, deadline_at, status) VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [
          attemptId,
          exam.id,
          who.traineeId,
          who.name,
          who.number,
          JSON.stringify(snapshot),
          opts.device ?? null,
          startedAt.toISOString(),
          limit ? new Date(startedAt.getTime() + limit * 60_000).toISOString() : null,
          preview ? 'preview' : 'in_progress',
        ],
      );
      picked.forEach((p, position) => {
        this.db.run(
          `INSERT INTO attempt_question (id, attempt_id, question_id, position, points, snapshot, option_order)
           VALUES (?,?,?,?,?,?,?)`,
          [newId(), attemptId, p.question.id, position, p.points, JSON.stringify(p.question), JSON.stringify(this.optionOrder(p.question))],
        );
      });
    });
    return this.state(attemptId);
  }

  private resolveIdentity(
    exam: ExamStored,
    input: IdentityInput,
  ): { traineeId: string | null; name: string | null; number: string | null } {
    const name = input.name?.trim() || null;
    const number = input.number ? normalizeDigits(input.number.trim()) || null : null;
    switch (exam.identifyMode) {
      case 'pick_list': {
        const t = input.traineeId ? this.deps.trainees.get(input.traineeId) : null;
        if (!t || !t.active) throw new UserError(ar.trainee.chooseName);
        return { traineeId: t.id, name: t.fullName, number: t.number };
      }
      case 'number_lookup': {
        if (!number) throw new UserError(ar.trainee.enterNumber);
        const found = this.lookupNumber(number);
        return { traineeId: found.traineeId, name: found.name, number };
      }
      case 'number_and_name': {
        if (!number || !name) throw new UserError(ar.trainee.enterNumberAndName);
        const t = this.deps.trainees.findByNumber(number);
        return { traineeId: t?.id ?? null, name: t?.fullName ?? name, number };
      }
      case 'name':
        if (!name) throw new UserError(ar.trainee.enterName);
        return { traineeId: null, name, number: null };
    }
  }

  private extraAllowance(examId: string, key: string): number {
    const row = this.db.get<{ value: string }>('SELECT value FROM setting WHERE key = ?', [`allow:${examId}:${key}`]);
    return row ? Number(row.value) : 0;
  }

  /** يسمح للمتدرب بدخول الاختبار مرة إضافية (design.md القسم 9، القرار 15). */
  grantExtraAttempt(attemptId: string): void {
    const a = this.attemptRow(attemptId);
    const key = a.trainee_id ?? `name:${a.entered_name}`;
    const k = `allow:${a.exam_id}:${key}`;
    const current = this.extraAllowance(a.exam_id, key);
    this.db.run('INSERT INTO setting (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [
      k,
      String(current + 1),
    ]);
  }

  private pickQuestions(
    exam: ExamStored,
    traineeId: string | null,
    name: string | null,
  ): { question: Question; points: number }[] {
    if (exam.questionMode === 'fixed') {
      const list = exam.questions.map((q) => {
        const question = this.deps.questions.get(q.questionId);
        if (question.archived) throw new UserError(ar.trainee.examBroken);
        return { question: stripStored(question), points: q.points };
      });
      if (list.length === 0) throw new UserError(ar.trainee.examBroken);
      return shuffle(list, this.rng);
    }
    const bank = bankForExam(exam.examType, exam.gradeId);
    if (!bank) throw new UserError(ar.trainee.examBroken);
    const pool = this.deps.questions.allInBank(bank);
    const today = this.now().toISOString().slice(0, 10);
    const usage = new Map<string, number>();
    for (const r of this.db.all<{ question_id: string; n: number }>(
      `SELECT aq.question_id, COUNT(*) AS n FROM attempt_question aq JOIN attempt a ON a.id = aq.attempt_id
        WHERE a.exam_id = ? AND a.status <> 'preview' AND substr(a.started_at, 1, 10) = ? GROUP BY aq.question_id`,
      [exam.id, today],
    )) {
      usage.set(r.question_id, Number(r.n));
    }
    const seen = new Set(
      this.db
        .all<{ question_id: string }>(
          `SELECT aq.question_id FROM attempt_question aq JOIN attempt a ON a.id = aq.attempt_id
            WHERE a.exam_id = ? AND a.status <> 'preview' AND ${traineeId ? 'a.trainee_id = ?' : 'a.entered_name = ?'}`,
          [exam.id, (traineeId ?? name ?? '') as string],
        )
        .map((r) => r.question_id),
    );
    let drawn;
    try {
      drawn = drawQuestions(pool, exam.drawRules, { rng: this.rng, sessionUsage: usage, seenByTrainee: seen });
    } catch {
      throw new UserError(ar.trainee.examBroken);
    }
    const byId = new Map(pool.map((q) => [q.id, q]));
    return drawn.map((d) => ({ question: stripStored(byId.get(d.id)!), points: d.points }));
  }

  private optionOrder(q: Question): OptionOrder {
    const order = (opts: Option[]) => (q.shuffleOptions ? shuffle(opts, this.rng) : opts).map((o) => o.id);
    switch (q.type) {
      case 'MCQ':
        return { mcq: order(q.data.options) };
      case 'LIST':
        return q.data.shared ? { shared: order(q.data.options) } : { slots: q.data.slots.map((s) => order(s.options)) };
      case 'SKILL':
        return { shared: order(q.data.options) };
      default:
        return {};
    }
  }

  private attemptRow(id: string): AttemptRow {
    const a = this.db.get<AttemptRow>('SELECT * FROM attempt WHERE id = ?', [id]);
    if (!a) throw new UserError(ar.trainee.attemptNotFound);
    return a;
  }

  private expired(a: AttemptRow): boolean {
    return a.deadline_at !== null && this.now().getTime() >= new Date(a.deadline_at).getTime();
  }

  private finished(a: AttemptRow): boolean {
    return a.status === 'submitted' || a.status === 'timed_out' || (a.status === 'preview' && a.score !== null);
  }

  state(attemptId: string): AttemptState {
    let a = this.attemptRow(attemptId);
    if (!this.finished(a) && this.expired(a)) {
      this.finish(attemptId);
      a = this.attemptRow(attemptId);
    }
    const snap = parseJson<ExamSnapshot>(a.exam_snapshot, {} as ExamSnapshot);
    const aqs = this.db.all<AqRow>('SELECT * FROM attempt_question WHERE attempt_id = ? ORDER BY position', [attemptId]);
    return {
      attemptId,
      preview: a.status === 'preview',
      examTitle: snap.title,
      examType: snap.examType,
      traineeName: snap.traineeName,
      secondsLeft: a.deadline_at ? Math.max(0, Math.floor((new Date(a.deadline_at).getTime() - this.now().getTime()) / 1000)) : null,
      finished: this.finished(a),
      questions: aqs.map((aq) => this.publicQuestion(aq, snap.settings)),
      totalPoints: snap.totalPoints,
    };
  }

  private tries(aqId: string): TryGrade[] {
    return this.db
      .all<{ is_correct: number; items: string | null }>(
        'SELECT is_correct, items FROM attempt_answer WHERE attempt_question_id = ? ORDER BY try_number',
        [aqId],
      )
      .map((t) => ({ correct: Boolean(t.is_correct), items: parseJson<boolean[] | null>(t.items, null) }));
  }

  private publicQuestion(aq: AqRow, settings: ExamSettings): PublicQuestion {
    const q = parseJson<Question>(aq.snapshot, {} as Question);
    const order = parseJson<OptionOrder>(aq.option_order, {});
    const answers = this.db.all<{ is_correct: number; response: string }>(
      'SELECT is_correct, response FROM attempt_answer WHERE attempt_question_id = ? ORDER BY try_number',
      [aq.id],
    );
    const last = answers[answers.length - 1];
    const lastResponse = last ? parseJson<{ kind: string; selections?: (string | null)[] }>(last.response, { kind: '' }) : null;
    const sortBy = (opts: Option[], ids?: string[]) =>
      ids ? ids.map((id) => opts.find((o) => o.id === id)).filter((o): o is Option => Boolean(o)) : opts;

    let slots: PublicQuestion['slots'] = null;
    let mcqOptions: Option[] | null = null;
    if (q.type === 'MCQ') mcqOptions = sortBy(q.data.options, order.mcq);
    if (q.type === 'LIST') {
      slots = q.data.slots.map((s, i) => ({
        label: null,
        options: q.data.shared ? sortBy(q.data.options, order.shared) : sortBy(s.options, order.slots?.[i]),
      }));
    }
    if (q.type === 'SKILL') {
      const opts = sortBy(q.data.options, order.shared);
      slots = q.data.items.map((it) => ({ label: it.label, options: opts }));
    }
    const image =
      q.imageId !== null
        ? this.db.get<{ width_px: number; height_px: number }>('SELECT width_px, height_px FROM image WHERE id = ?', [q.imageId])
        : undefined;
    const done = Boolean(aq.done);
    const lastCorrect = last ? Boolean(last.is_correct) : null;
    return {
      aqId: aq.id,
      position: aq.position,
      type: q.type,
      text: q.text,
      imageId: q.imageId,
      image: image ? { width: Number(image.width_px), height: Number(image.height_px) } : null,
      points: Number(aq.points),
      maxTries: q.maxTries,
      triesUsed: answers.length,
      done,
      lastCorrect,
      lastSelections: lastResponse?.kind === 'SLOTS' ? lastResponse.selections ?? null : null,
      mcqOptions,
      slots,
      reveal: done && lastCorrect !== true && settings.showCorrectAfterTries ? revealFor(q) : null,
    };
  }

  submitTry(attemptId: string, aqId: string, response: unknown): TryResult {
    const a = this.attemptRow(attemptId);
    if (this.finished(a)) throw new UserError(ar.trainee.alreadyFinished);
    if (this.expired(a)) {
      this.finish(attemptId);
      throw new UserError(ar.trainee.timeUp);
    }
    const aq = this.db.get<AqRow>('SELECT * FROM attempt_question WHERE id = ? AND attempt_id = ?', [aqId, attemptId]);
    if (!aq) throw new UserError(ar.trainee.attemptNotFound);
    if (aq.done) throw new UserError(ar.trainee.questionDone);
    const parsed = responseSchema.safeParse(response);
    if (!parsed.success) throw new UserError(ar.trainee.invalidAnswer);
    const q = parseJson<Question>(aq.snapshot, {} as Question);
    const grade = gradeTry(q, parsed.data);
    const previous = this.tries(aq.id);
    const tryNumber = previous.length + 1;
    const done = grade.correct || tryNumber >= q.maxTries;

    this.db.transaction(() => {
      this.db.run(
        `INSERT INTO attempt_answer (id, attempt_question_id, try_number, response, is_correct, items, answered_at)
         VALUES (?,?,?,?,?,?,?)`,
        [newId(), aq.id, tryNumber, JSON.stringify(parsed.data), grade.correct ? 1 : 0, grade.items ? JSON.stringify(grade.items) : null, this.now().toISOString()],
      );
      if (done) this.closeQuestion(aq, q, [...previous, grade]);
    });
    const settings = parseJson<ExamSnapshot>(a.exam_snapshot, {} as ExamSnapshot).settings;
    const fresh = this.db.get<AqRow>('SELECT * FROM attempt_question WHERE id = ?', [aq.id])!;
    return { correct: grade.correct, triesLeft: q.maxTries - tryNumber, done, question: this.publicQuestion(fresh, settings) };
  }

  private closeQuestion(aq: AqRow, q: Question, tries: TryGrade[]): void {
    const earned = tries.length ? scoreQuestion(q, tries, Number(aq.points)) : 0;
    this.db.run('UPDATE attempt_question SET done = 1, earned = ? WHERE id = ?', [earned, aq.id]);
  }

  /** «اعتماد إجابتي والانتقال» في «اذكر» والمهارات: يحتفظ بأفضل نتيجة دون استنفاد المحاولات. */
  acceptBest(attemptId: string, aqId: string): PublicQuestion {
    const a = this.attemptRow(attemptId);
    if (this.finished(a)) throw new UserError(ar.trainee.alreadyFinished);
    const aq = this.db.get<AqRow>('SELECT * FROM attempt_question WHERE id = ? AND attempt_id = ?', [aqId, attemptId]);
    if (!aq) throw new UserError(ar.trainee.attemptNotFound);
    const tries = this.tries(aq.id);
    if (!tries.length) throw new UserError(ar.trainee.answerFirst);
    if (!aq.done) this.closeQuestion(aq, parseJson<Question>(aq.snapshot, {} as Question), tries);
    const settings = parseJson<ExamSnapshot>(a.exam_snapshot, {} as ExamSnapshot).settings;
    return this.publicQuestion(this.db.get<AqRow>('SELECT * FROM attempt_question WHERE id = ?', [aq.id])!, settings);
  }

  /** تسليم الاختبار وحساب النتيجة. الأسئلة التي لم يُجب عنها تُحسب صفرًا. */
  finish(attemptId: string): AttemptOutcome {
    const a = this.attemptRow(attemptId);
    const snap = parseJson<ExamSnapshot>(a.exam_snapshot, {} as ExamSnapshot);
    if (!this.finished(a)) {
      const timedOut = this.expired(a);
      this.db.transaction(() => {
        for (const aq of this.db.all<AqRow>('SELECT * FROM attempt_question WHERE attempt_id = ? AND done = 0', [attemptId])) {
          this.closeQuestion(aq, parseJson<Question>(aq.snapshot, {} as Question), this.tries(aq.id));
        }
        const sum = this.db.get<{ earned: number; total: number }>(
          'SELECT COALESCE(SUM(earned),0) AS earned, COALESCE(SUM(points),0) AS total FROM attempt_question WHERE attempt_id = ?',
          [attemptId],
        )!;
        const outcome = evaluateExam(Number(sum.earned), Number(sum.total), snap.settings.pass);
        const status = a.status === 'preview' ? 'preview' : timedOut ? 'timed_out' : 'submitted';
        this.db.run(
          'UPDATE attempt SET status = ?, submitted_at = ?, score = ?, max_score = ?, percent = ?, passed = ? WHERE id = ?',
          [
            status,
            this.now().toISOString(),
            outcome.earned,
            outcome.total,
            outcome.percent,
            outcome.passed === null ? null : outcome.passed ? 1 : 0,
            attemptId,
          ],
        );
      });
    }
    const done = this.attemptRow(attemptId);
    const passed = done.passed === null ? null : Boolean(done.passed);
    return {
      earned: Number(done.score ?? 0),
      total: Number(done.max_score ?? 0),
      percent: Number(done.percent ?? 0),
      passed,
      passLabel: passLabel(snap.settings),
      status: done.status === 'timed_out' ? 'timed_out' : 'submitted',
    };
  }

  /** إنهاء تجربة المدرب وحذفها. */
  discardPreview(attemptId: string): void {
    this.db.run("DELETE FROM attempt WHERE id = ? AND status = 'preview'", [attemptId]);
  }
}

function stripStored(q: Question & { testedAt?: unknown; archived?: unknown; createdAt?: unknown; updatedAt?: unknown }): Question {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { testedAt, archived, createdAt, updatedAt, ...rest } = q;
  return rest as Question;
}

function revealFor(q: Question): Reveal {
  switch (q.type) {
    case 'TF':
      return { type: 'TF', correct: q.data.correct };
    case 'MCQ':
      return { type: 'MCQ', correctId: q.data.correctId };
    case 'HOTSPOT':
      return { type: 'HOTSPOT', regions: q.data.regions };
    case 'LIST': {
      const d = q.data;
      const text = (opts: Option[], id: string | null) => opts.find((o) => o.id === id)?.text ?? '';
      const correctTexts = d.ordered
        ? d.slots.map((s) => text(d.shared ? d.options : s.options, s.correctId))
        : d.correctIds.map((id) => text(d.options, id));
      return { type: 'SLOTS', correctTexts };
    }
    case 'SKILL':
      return {
        type: 'SLOTS',
        correctTexts: q.data.items.map((it) => `${it.label}: ${q.data.options.find((o) => o.id === it.correctId)?.text ?? ''}`),
      };
  }
}

export function passLabel(settings: ExamSettings): string {
  const p = settings.pass;
  if (p.mode === 'none') return ar.result.noPass;
  if (p.mode === 'percent') return ar.result.passPercent(p.value);
  return ar.result.passPoints(p.value);
}
