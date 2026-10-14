import type { AppDatabase } from '../db/database';
import { ar } from '../../shared/i18n/ar';
import { checkAvailability } from '../../shared/draw/drawQuestions';
import type { ExamType, QuestionType } from '../../shared/types/domain';
import {
  bankForExam,
  examInputSchema,
  type ExamInput,
  type ExamStatus,
  type ExamStored,
  type ExamSummary,
} from '../../shared/types/exam';
import { nowIso, parseJson, UserError } from './util';

interface ExamRow {
  id: string;
  title: string;
  exam_type: ExamType;
  course_id: string | null;
  grade_id: string | null;
  lesson_id: string | null;
  question_mode: 'random_draw' | 'fixed';
  status: ExamStatus;
  is_open: number;
  identify_mode: ExamInput['identifyMode'];
  settings: string;
  created_at: string;
  updated_at: string;
}

/** الاختبارات الأربعة: دورة، ترفيع، سريع، مفاجئ (design.md 1.2، 2.5). */
export class ExamService {
  constructor(private readonly db: AppDatabase) {}

  list(): ExamSummary[] {
    return this.db
      .all<ExamRow & { course_label: string | null; grade_name: string | null; lesson_title: string | null; attempts: number }>(
        `SELECT e.*, c.course_number || ' - ' || c.course_name AS course_label, g.name_ar AS grade_name,
                l.title AS lesson_title,
                (SELECT COUNT(*) FROM attempt a WHERE a.exam_id = e.id AND a.status <> 'preview') AS attempts
           FROM exam e
           LEFT JOIN course c ON c.id = e.course_id
           LEFT JOIN grade g ON g.id = e.grade_id
           LEFT JOIN lesson l ON l.id = e.lesson_id
          WHERE e.status <> 'archived'
          ORDER BY e.updated_at DESC`,
      )
      .map((r) => {
        const exam = this.get(r.id);
        const { count, total } = this.structure(exam);
        return {
          id: r.id,
          title: r.title,
          examType: r.exam_type,
          status: r.status,
          isOpen: Boolean(r.is_open),
          questionCount: count,
          totalPoints: total,
          subtitle: r.grade_name ?? r.lesson_title ?? r.course_label ?? '',
          attempts: Number(r.attempts),
        };
      });
  }

  get(id: string): ExamStored {
    const r = this.db.get<ExamRow>('SELECT * FROM exam WHERE id = ?', [id]);
    if (!r) throw new UserError('الاختبار غير موجود');
    const questions = this.db
      .all<{ question_id: string; points: number }>(
        'SELECT question_id, points FROM exam_question WHERE exam_id = ? ORDER BY sort_order',
        [id],
      )
      .map((q) => ({ questionId: q.question_id, points: Number(q.points) }));
    const drawRules = this.db
      .all<{ question_type: QuestionType; count: number; points: number }>(
        'SELECT question_type, count, points FROM exam_draw_rule WHERE exam_id = ? ORDER BY sort_order',
        [id],
      )
      .map((d) => ({ type: d.question_type, count: Number(d.count), points: Number(d.points) }));
    return {
      id: r.id,
      title: r.title,
      examType: r.exam_type,
      courseId: r.course_id,
      gradeId: r.grade_id,
      lessonId: r.lesson_id,
      questionMode: r.question_mode,
      identifyMode: r.identify_mode,
      settings: parseJson(r.settings, {} as ExamInput['settings']),
      questions,
      drawRules,
      status: r.status,
      isOpen: Boolean(r.is_open),
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }

  /** عدد الأسئلة ومجموع الدرجات (يُحسب تلقائيًا). */
  structure(exam: ExamInput): { count: number; total: number } {
    if (exam.questionMode === 'fixed') {
      return { count: exam.questions.length, total: exam.questions.reduce((a, q) => a + q.points, 0) };
    }
    return {
      count: exam.drawRules.reduce((a, r) => a + r.count, 0),
      total: exam.drawRules.reduce((a, r) => a + r.count * r.points, 0),
    };
  }

  /** يحفظ الاختبار مسودة أو يحدّثه. الاختبار المنشور يعود مسودة إن تغيّر تركيبه حتى يُراجَع. */
  save(input: unknown): ExamStored {
    const parsed = examInputSchema.safeParse(input);
    if (!parsed.success) throw new UserError(parsed.error.issues[0]?.message ?? 'بيانات الاختبار غير صالحة');
    const e = parsed.data;
    if (e.examType === 'promotion' && !e.gradeId) throw new UserError('اختر درجة الترفيع');
    if (e.examType === 'course' && !e.courseId) throw new UserError('اختر الدورة');
    if (e.examType !== 'promotion') e.gradeId = null;
    if (e.examType !== 'quick') e.lessonId = null;
    this.assertQuestionsInBank(e);

    const now = nowIso();
    const existing = this.db.get<ExamRow>('SELECT * FROM exam WHERE id = ?', [e.id]);
    this.db.transaction(() => {
      const values = [
        e.title,
        e.examType,
        e.courseId,
        e.gradeId,
        e.lessonId,
        e.questionMode,
        e.identifyMode,
        JSON.stringify(e.settings),
        now,
      ];
      if (existing) {
        this.db.run(
          `UPDATE exam SET title=?, exam_type=?, course_id=?, grade_id=?, lesson_id=?, question_mode=?, identify_mode=?,
                  settings=?, updated_at=? WHERE id=?`,
          [...values, e.id],
        );
      } else {
        this.db.run(
          `INSERT INTO exam (title, exam_type, course_id, grade_id, lesson_id, question_mode, identify_mode, settings,
                  updated_at, id, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
          [...values, e.id, now],
        );
      }
      this.db.run('DELETE FROM exam_question WHERE exam_id = ?', [e.id]);
      this.db.run('DELETE FROM exam_draw_rule WHERE exam_id = ?', [e.id]);
      if (e.questionMode === 'fixed') {
        const seen = new Set<string>();
        e.questions.forEach((q, i) => {
          if (seen.has(q.questionId)) throw new UserError('لا يتكرر السؤال داخل الاختبار');
          seen.add(q.questionId);
          this.db.run('INSERT INTO exam_question (id, exam_id, question_id, sort_order, points) VALUES (?,?,?,?,?)', [
            `${e.id}:${q.questionId}`,
            e.id,
            q.questionId,
            i,
            q.points,
          ]);
        });
      } else {
        e.drawRules
          .filter((r) => r.count > 0)
          .forEach((r, i) => {
            this.db.run(
              'INSERT INTO exam_draw_rule (id, exam_id, question_type, points, count, sort_order) VALUES (?,?,?,?,?,?)',
              [`${e.id}:rule${i}`, e.id, r.type, r.points, r.count, i],
            );
          });
      }
    });
    return this.get(e.id);
  }

  /** الأسئلة اليدوية يجب أن تكون من بنك الاختبار فقط (invariant 8). */
  private assertQuestionsInBank(e: ExamInput): void {
    if (e.questionMode !== 'fixed') return;
    const bank = bankForExam(e.examType, e.gradeId);
    for (const q of e.questions) {
      const row = this.db.get<{ bank_id: string; archived: number }>('SELECT bank_id, archived FROM question WHERE id = ?', [
        q.questionId,
      ]);
      if (!row || row.archived) throw new UserError('أحد الأسئلة المختارة لم يعد موجودًا في البنك');
      if (row.bank_id !== bank) throw new UserError('أحد الأسئلة ليس من بنك هذا الاختبار');
    }
  }

  /** المشاكل التي تمنع نشر الاختبار، بلغة بسيطة (design.md 3.1). */
  publishProblems(id: string): string[] {
    const e = this.get(id);
    const problems: string[] = [];
    const { count, total } = this.structure(e);
    if (count === 0) problems.push('الاختبار لا يحتوي أسئلة');
    if (e.settings.pass.mode === 'points' && e.settings.pass.value > total) {
      problems.push(`حد النجاح (${e.settings.pass.value}) أكبر من مجموع درجات الاختبار (${total})`);
    }
    if (e.questionMode === 'random_draw') {
      const bank = bankForExam(e.examType, e.gradeId);
      const pool = this.db.all<{ id: string; type: QuestionType }>(
        'SELECT id, type FROM question WHERE bank_id = ? AND archived = 0',
        [bank],
      );
      for (const a of checkAvailability(pool, e.drawRules)) {
        if (a.available < a.required) {
          problems.push(`البنك لا يكفي: مطلوب ${a.required} من «${ar.questionTypes[a.type]}» والمتوفر ${a.available}`);
        }
      }
    } else {
      try {
        this.assertQuestionsInBank(e);
      } catch (err) {
        problems.push((err as Error).message);
      }
    }
    return problems;
  }

  setStatus(id: string, status: ExamStatus): void {
    if (status === 'published') {
      const problems = this.publishProblems(id);
      if (problems.length) throw new UserError(problems.join('\n'));
    }
    this.db.run('UPDATE exam SET status = ?, is_open = CASE WHEN ? = \'published\' THEN is_open ELSE 0 END, updated_at = ? WHERE id = ?', [
      status,
      status,
      nowIso(),
      id,
    ]);
  }

  /** فتح الاختبار للمتدربين أو إغلاقه (للسريع والمفاجئ خاصة). */
  setOpen(id: string, open: boolean): void {
    const e = this.get(id);
    if (open && e.status !== 'published') throw new UserError('انشر الاختبار أولًا');
    this.db.run('UPDATE exam SET is_open = ?, updated_at = ? WHERE id = ?', [open ? 1 : 0, nowIso(), id]);
  }

  /** حذف الاختبار: إن كانت له نتائج يُؤرشف حتى لا تضيع. */
  remove(id: string): void {
    const has = this.db.get("SELECT 1 FROM attempt WHERE exam_id = ? AND status <> 'preview'", [id]);
    if (has) {
      this.setStatus(id, 'archived');
      return;
    }
    this.db.transaction(() => {
      this.db.run('DELETE FROM attempt WHERE exam_id = ?', [id]);
      this.db.run('DELETE FROM exam WHERE id = ?', [id]);
    });
  }

  /** عدد الأسئلة المتوفرة من كل نوع في بنك الاختبار (لجدول القالب). */
  bankAvailability(examType: ExamType, gradeId: string | null): Record<QuestionType, number> {
    const counts: Record<QuestionType, number> = { TF: 0, MCQ: 0, LIST: 0, SKILL: 0, HOTSPOT: 0 };
    const bank = bankForExam(examType, gradeId);
    if (!bank) return counts;
    for (const r of this.db.all<{ type: QuestionType; n: number }>(
      'SELECT type, COUNT(*) AS n FROM question WHERE bank_id = ? AND archived = 0 GROUP BY type',
      [bank],
    )) {
      counts[r.type] = Number(r.n);
    }
    return counts;
  }
}

