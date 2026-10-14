import { describe, expect, it } from 'vitest';
import { AppDatabase } from '../src/main/db/database';
import { examInput, listQuestion, mcqQuestion, setup, tfQuestion } from './helpers';

describe('الأسئلة', () => {
  it('حفظ وتعديل ونسخ إلى بنك آخر، ومنع النقل المباشر بين البنوك', async () => {
    const { questions } = await setup();
    const q = questions.save(tfQuestion('bank-4to3'));
    expect(questions.list({ bankId: 'bank-4to3' })).toHaveLength(1);
    expect(() => questions.save({ ...q, bankId: 'bank-3to2' })).toThrow('نسخ إلى بنك آخر');
    const copy = questions.copy(q.id, 'bank-3to2');
    expect(copy.bankId).toBe('bank-3to2');
    expect(questions.list({ bankId: 'bank-3to2' })).toHaveLength(1);
    expect(questions.list({ bankId: 'bank-4to3', search: 'عبارة' })).toHaveLength(1);
  });

  it('يرفض سؤالًا بلا إجابة صحيحة', async () => {
    const { questions } = await setup();
    const q = mcqQuestion('bank-general');
    expect(() => questions.save({ ...q, data: { ...q.data, correctId: 'nope' } })).toThrow('حدد البديل الصحيح');
  });

  it('«اعتماد» بعد التجربة يسجل وقت التجربة', async () => {
    const { questions } = await setup();
    const q = questions.save(tfQuestion('bank-general'), true);
    expect(q.testedAt).not.toBeNull();
    expect(questions.list({ bankId: 'bank-general' })[0]!.tested).toBe(true);
  });

  it('المفاتيح الخارجية تبقى مفعّلة بعد حفظ الملف', async () => {
    const { db } = await setup();
    db.run("INSERT INTO setting (key, value) VALUES ('x','1')");
    expect(() =>
      db.run(
        "INSERT INTO exam_question (id, exam_id, question_id, sort_order, points) VALUES ('a','missing','missing',0,1)",
      ),
    ).toThrow();
  });
});

describe('الاختبارات', () => {
  it('المجموع يُحسب تلقائيًا مع الدرجات الكسرية', async () => {
    const { questions, exams } = await setup();
    const a = questions.save(tfQuestion('bank-general'));
    const b = questions.save(listQuestion('bank-general'));
    const e = exams.save(
      examInput({ examType: 'surprise', questions: [{ questionId: a.id, points: 0.25 }, { questionId: b.id, points: 1.5 }] }),
    );
    expect(exams.structure(e)).toEqual({ count: 2, total: 1.75 });
  });

  it('اختبار الترفيع لا يقبل أسئلة من بنك آخر (invariant 8)', async () => {
    const { questions, exams } = await setup();
    const q = questions.save(tfQuestion('bank-3to2'));
    expect(() =>
      exams.save(examInput({ examType: 'promotion', gradeId: 'grade-4to3', questions: [{ questionId: q.id, points: 1 }] })),
    ).toThrow('ليس من بنك');
  });

  it('لا يُنشر اختبار سحب عشوائي لا يكفيه البنك', async () => {
    const { questions, exams } = await setup();
    questions.save(tfQuestion('bank-4to3'));
    const e = exams.save(
      examInput({ examType: 'promotion', gradeId: 'grade-4to3', questionMode: 'random_draw', drawRules: [{ type: 'TF', count: 3, points: 1 }] }),
    );
    expect(exams.publishProblems(e.id)[0]).toContain('البنك لا يكفي');
    expect(() => exams.setStatus(e.id, 'published')).toThrow();
  });

  it('حد النجاح بالدرجات لا يتجاوز المجموع عند النشر', async () => {
    const { questions, exams } = await setup();
    const a = questions.save(tfQuestion('bank-general'));
    const e = exams.save(
      examInput({
        examType: 'surprise',
        settings: { pass: { mode: 'points', value: 3 }, timeLimitMinutes: null, showCorrectAfterTries: false, maxAttemptsPerTrainee: 1 },
        questions: [{ questionId: a.id, points: 1 }],
      }),
    );
    expect(() => exams.setStatus(e.id, 'published')).toThrow('أكبر من مجموع');
  });
});

async function publishedExam(env: Awaited<ReturnType<typeof setup>>, over: Parameters<typeof examInput>[0]) {
  const e = env.exams.save(examInput(over));
  env.exams.setStatus(e.id, 'published');
  env.exams.setOpen(e.id, true);
  return e;
}

describe('أداء الاختبار', () => {
  it('سير كامل: البدء، المحاولات، الخصم التدريجي، «اذكر»، النتيجة', async () => {
    const env = await setup();
    const tf = env.questions.save(tfQuestion('bank-general', true));
    const mcq = env.questions.save(mcqQuestion('bank-general'));
    const list = env.questions.save(listQuestion('bank-general'));
    const exam = await publishedExam(env, {
      examType: 'course',
      courseId: null,
      questions: [
        { questionId: tf.id, points: 0.5 },
        { questionId: mcq.id, points: 1 },
        { questionId: list.id, points: 1.5 },
      ],
    }).catch(() => null);
    // اختبار الدورة يحتاج دورة
    expect(exam).toBeNull();
    const courseId = 'c1';
    env.db.run("INSERT INTO course (id, course_number, course_name, created_at) VALUES ('c1','101','دورة السائقين','x')");
    const e = await publishedExam(env, {
      examType: 'course',
      courseId,
      identifyMode: 'name',
      questions: [
        { questionId: tf.id, points: 0.5 },
        { questionId: mcq.id, points: 1 },
        { questionId: list.id, points: 1.5 },
      ],
    });

    expect(env.attempts.availableExams().map((x) => x.id)).toEqual([e.id]);
    const state = env.attempts.start(e.id, { name: 'أحمد' });
    expect(state.questions).toHaveLength(3);
    expect(state.totalPoints).toBe(3);
    // لا تصل الإجابات الصحيحة إلى المتدرب
    const json = JSON.stringify(state);
    expect(json).not.toContain('correctId');
    expect(json).not.toContain('correctIds');
    expect(json).not.toContain('"correct"');

    const byType = (t: string) => state.questions.find((q) => q.type === t)!;
    // صح وخطأ: صحيح
    expect(env.attempts.submitTry(state.attemptId, byType('TF').aqId, { kind: 'TF', value: true }).correct).toBe(true);
    // اختيار من متعدد: خطأ ثم صحيح = ½
    const m = byType('MCQ');
    const wrong = m.mcqOptions!.find((o) => o.text === 'أزرق')!.id;
    const right = m.mcqOptions!.find((o) => o.text === 'أحمر')!.id;
    const r1 = env.attempts.submitTry(state.attemptId, m.aqId, { kind: 'MCQ', optionId: wrong });
    expect(r1).toMatchObject({ correct: false, triesLeft: 1, done: false });
    const r2 = env.attempts.submitTry(state.attemptId, m.aqId, { kind: 'MCQ', optionId: right });
    expect(r2).toMatchObject({ correct: true, done: true });
    expect(() => env.attempts.submitTry(state.attemptId, m.aqId, { kind: 'MCQ', optionId: right })).toThrow();
    // «اذكر»: إجابة جزئية ثم اعتماد أفضل محاولة
    const l = byType('LIST');
    const id = (t: string) => l.slots![0]!.options.find((o) => o.text === t)!.id;
    const lr = env.attempts.submitTry(state.attemptId, l.aqId, {
      kind: 'SLOTS',
      selections: [id('مؤشر الوقود'), id('المرآة'), id('عداد السرعة')],
    });
    expect(lr).toMatchObject({ correct: false, done: false });
    expect(lr.question.lastSelections).toHaveLength(3);
    env.attempts.acceptBest(state.attemptId, l.aqId);

    const out = env.attempts.finish(state.attemptId);
    // 0.5 + 0.5 + 1.5 × ⅔ = 2
    expect(out.earned).toBeCloseTo(2, 10);
    expect(out.total).toBe(3);
    expect(out.passed).toBe(false); // 66.7٪ < 70٪
    expect(env.results.list()[0]).toMatchObject({ traineeName: 'أحمد', status: 'submitted' });
    expect(env.results.exportCsv()).toContain('أحمد');

    // مرة دخول واحدة افتراضيًا، ثم يسمح المدرب بمرة إضافية
    expect(() => env.attempts.start(e.id, { name: 'أحمد' })).toThrow('استنفدت');
    env.attempts.grantExtraAttempt(state.attemptId);
    expect(env.attempts.start(e.id, { name: 'أحمد' }).questions).toHaveLength(3);
  });

  it('الترفيع: متدربان يأخذان أسئلة مختلفة، والتجربة لا تُسجَّل', async () => {
    const env = await setup(7);
    for (let i = 0; i < 20; i++) env.questions.save(tfQuestion('bank-4to3'));
    env.trainees.save({ id: null, number: '11', fullName: 'خالد', currentLevel: 4, active: true });
    env.trainees.save({ id: null, number: '12', fullName: 'سعد', currentLevel: 4, active: true });
    env.trainees.save({ id: null, number: '13', fullName: 'فهد', currentLevel: 2, active: true });
    const e = await publishedExam(env, {
      examType: 'promotion',
      gradeId: 'grade-4to3',
      questionMode: 'random_draw',
      identifyMode: 'pick_list',
      drawRules: [{ type: 'TF', count: 10, points: 0.5 }],
    });
    expect(env.attempts.pickList(e.id).map((t) => t.name).sort()).toEqual(['خالد', 'سعد']);

    const preview = env.attempts.start(e.id, {}, { preview: true });
    env.attempts.finish(preview.attemptId);
    env.attempts.discardPreview(preview.attemptId);

    const [k, s] = env.attempts.pickList(e.id);
    const a = env.attempts.start(e.id, { traineeId: k!.id });
    const b = env.attempts.start(e.id, { traineeId: s!.id });
    const ids = (st: typeof a) => new Set(env.results.detail(st.attemptId).questions.map((q) => q.question.id));
    expect(env.attempts.finish(a.attemptId).total).toBe(5);
    env.attempts.finish(b.attemptId);
    const overlap = [...ids(a)].filter((x) => ids(b).has(x));
    expect(overlap).toHaveLength(0);
    expect(env.results.list()).toHaveLength(2);
  });

  it('الرقم غير المسجل يُرفض، والاستئناف بعد الإغلاق المفاجئ', async () => {
    const env = await setup();
    const q = env.questions.save(tfQuestion('bank-general'));
    env.trainees.save({ id: null, number: '٥٥', fullName: 'ناصر', currentLevel: null, active: true });
    const e = await publishedExam(env, { examType: 'quick', identifyMode: 'number_lookup', questions: [{ questionId: q.id, points: 1 }] });
    expect(() => env.attempts.start(e.id, { number: '99' })).toThrow('غير مسجل');
    expect(env.attempts.lookupNumber('55').name).toBe('ناصر');
    const s1 = env.attempts.start(e.id, { number: '55' });
    const s2 = env.attempts.start(e.id, { number: '55' });
    expect(s2.attemptId).toBe(s1.attemptId);
  });

  it('انتهاء الوقت يسلّم الاختبار تلقائيًا', async () => {
    let t = new Date('2026-10-14T10:00:00Z').getTime();
    const env = await setup(1, () => new Date(t));
    const q = env.questions.save(tfQuestion('bank-general'));
    const e = await publishedExam(env, {
      examType: 'surprise',
      settings: { pass: { mode: 'none' }, timeLimitMinutes: 5, showCorrectAfterTries: false, maxAttemptsPerTrainee: 1 },
      questions: [{ questionId: q.id, points: 1 }],
    });
    const s = env.attempts.start(e.id, { name: 'علي' });
    expect(s.secondsLeft).toBe(300);
    t += 6 * 60_000;
    expect(() => env.attempts.submitTry(s.attemptId, s.questions[0]!.aqId, { kind: 'TF', value: true })).toThrow('انتهى الوقت');
    expect(env.results.list()[0]!.status).toBe('timed_out');
  });

  it('إظهار الإجابة الصحيحة بعد انتهاء المحاولات إن سمح المدرب', async () => {
    const env = await setup();
    const q = env.questions.save(tfQuestion('bank-general', true));
    const e = await publishedExam(env, {
      examType: 'quick',
      questions: [{ questionId: q.id, points: 1 }],
    });
    const s = env.attempts.start(e.id, { name: 'سالم' });
    const r = env.attempts.submitTry(s.attemptId, s.questions[0]!.aqId, { kind: 'TF', value: false });
    expect(r.done).toBe(true);
    expect(r.question.reveal).toEqual({ type: 'TF', correct: true });
  });
});

describe('المتدربون والنقل بين الأجهزة', () => {
  it('استيراد CSV من Excel', async () => {
    const { trainees } = await setup();
    const r = trainees.importCsv('﻿الرقم,الاسم,الدرجة\n1,أحمد,4\n2,سعد\n١,أحمد علي,4\n,بلا رقم\n3,,4');
    expect(r).toMatchObject({ added: 3, updated: 1 });
    expect(r.skipped).toHaveLength(1);
    expect(trainees.findByNumber('1')!.fullName).toBe('أحمد علي');
  });

  it('النسخة الاحتياطية تُستعاد كاملة', async () => {
    const env = await setup();
    env.questions.save(tfQuestion('bank-general'));
    const backup = env.transfer.exportBackup();
    const other = await setup();
    other.transfer.importBackup(backup);
    const reopened = await AppDatabase.open(other.dbFile);
    expect(reopened.all('SELECT * FROM question')).toHaveLength(1);
  });

  it('دمج نتائج جهاز منعزل دون تكرار', async () => {
    const env = await setup();
    const q = env.questions.save(tfQuestion('bank-general'));
    const e = await publishedExam(env, { examType: 'quick', questions: [{ questionId: q.id, points: 1 }] });
    // جهاز ثانٍ بنفس البيانات (نُسخ من الفلاش)
    const second = await setup();
    second.transfer.importBackup(env.transfer.exportBackup());
    const db2 = await AppDatabase.open(second.dbFile);
    const { AttemptService } = await import('../src/main/services/attempts');
    const { ExamService } = await import('../src/main/services/exams');
    const { QuestionService } = await import('../src/main/services/questions');
    const { TraineeService } = await import('../src/main/services/trainees');
    const { TransferService } = await import('../src/main/services/transfer');
    const att2 = new AttemptService({ db: db2, exams: new ExamService(db2), questions: new QuestionService(db2), trainees: new TraineeService(db2) });
    const s = att2.start(e.id, { name: 'مهند' });
    att2.submitTry(s.attemptId, s.questions[0]!.aqId, { kind: 'TF', value: true });
    att2.finish(s.attemptId);
    const file = new TransferService(db2, second.dbFile, second.dir).exportResults('جهاز 2');
    expect(env.transfer.importResults(file)).toEqual({ added: 1, duplicates: 0, skipped: 0 });
    expect(env.transfer.importResults(file)).toEqual({ added: 0, duplicates: 1, skipped: 0 });
    expect(env.results.list()[0]).toMatchObject({ traineeName: 'مهند', score: 1 });
  });
});
