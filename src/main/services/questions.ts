import type { AppDatabase } from '../db/database';
import {
  questionMaxPoints,
  questionSchema,
  validateQuestionLogic,
  type Question,
  type QuestionSummary,
  type StoredQuestion,
} from '../../shared/types/question';
import type { QuestionType } from '../../shared/types/domain';
import { newId, nowIso, parseJson, UserError } from './util';

interface QuestionRow {
  id: string;
  bank_id: string;
  type: QuestionType;
  text: string;
  image_id: string | null;
  points: number;
  level: Question['level'];
  max_tries: number;
  late_try_scoring: Question['lateTryScoring'];
  shuffle_options: number;
  data: string;
  tested_at: string | null;
  archived: number;
  created_at: string;
  updated_at: string;
}

export function rowToQuestion(r: QuestionRow): StoredQuestion {
  return {
    id: r.id,
    bankId: r.bank_id,
    type: r.type,
    text: r.text,
    imageId: r.image_id,
    points: Number(r.points),
    level: r.level,
    maxTries: Number(r.max_tries),
    lateTryScoring: r.late_try_scoring,
    shuffleOptions: Boolean(r.shuffle_options),
    data: parseJson(r.data, {}),
    testedAt: r.tested_at,
    archived: Boolean(r.archived),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  } as StoredQuestion;
}

export interface QuestionFilter {
  bankId: string;
  type?: QuestionType | null;
  search?: string | null;
}

/** بنوك الأسئلة والأسئلة (design.md 1.4، 2.3). */
export class QuestionService {
  constructor(private readonly db: AppDatabase) {}

  list(filter: QuestionFilter): QuestionSummary[] {
    const where = ['q.bank_id = ?', 'q.archived = 0'];
    const params: (string | number)[] = [filter.bankId];
    if (filter.type) {
      where.push('q.type = ?');
      params.push(filter.type);
    }
    if (filter.search?.trim()) {
      where.push('q.text LIKE ?');
      params.push(`%${filter.search.trim()}%`);
    }
    return this.db
      .all<{ id: string; bank_id: string; type: QuestionType; text: string; points: number; max_tries: number; tested_at: string | null; used: number }>(
        `SELECT q.id, q.bank_id, q.type, q.text, q.points, q.max_tries, q.tested_at,
                (SELECT COUNT(DISTINCT eq.exam_id) FROM exam_question eq WHERE eq.question_id = q.id) AS used
           FROM question q WHERE ${where.join(' AND ')}
          ORDER BY q.updated_at DESC`,
        params,
      )
      .map((r) => ({
        id: r.id,
        bankId: r.bank_id,
        type: r.type,
        text: r.text,
        points: Number(r.points),
        maxTries: Number(r.max_tries),
        tested: r.tested_at !== null,
        usedInExams: Number(r.used),
      }));
  }

  get(id: string): StoredQuestion {
    const row = this.db.get<QuestionRow>('SELECT * FROM question WHERE id = ?', [id]);
    if (!row) throw new UserError('السؤال غير موجود');
    return rowToQuestion(row);
  }

  /** كل أسئلة البنك غير المؤرشفة كاملة (للسحب العشوائي والمعاينة). */
  allInBank(bankId: string): StoredQuestion[] {
    return this.db
      .all<QuestionRow>('SELECT * FROM question WHERE bank_id = ? AND archived = 0', [bankId])
      .map(rowToQuestion);
  }

  /**
   * حفظ سؤال جديد أو تعديل سؤال موجود. tested = true عند «اعتماد» بعد «تجربة».
   * لا يُسمح بنقل سؤال بين البنوك بالتعديل: يُستخدم «نسخ إلى بنك آخر».
   */
  save(input: unknown, tested = false): StoredQuestion {
    const parsed = questionSchema.safeParse(input);
    if (!parsed.success) throw new UserError(parsed.error.issues[0]?.message ?? 'بيانات السؤال غير صالحة');
    const q = parsed.data;
    // في «درجة لكل بند» درجة السؤال هي مجموع درجات البنود.
    q.points = questionMaxPoints(q);
    const errors = validateQuestionLogic(q);
    if (errors.length) throw new UserError(errors.join('\n'));
    if (!this.db.get('SELECT 1 FROM question_bank WHERE id = ?', [q.bankId])) throw new UserError('البنك غير موجود');
    if (q.imageId && !this.db.get('SELECT 1 FROM image WHERE id = ?', [q.imageId])) throw new UserError('الصورة غير موجودة');

    const existing = this.db.get<QuestionRow>('SELECT * FROM question WHERE id = ?', [q.id]);
    if (existing && existing.bank_id !== q.bankId) {
      throw new UserError('لا يمكن نقل السؤال إلى بنك آخر. استخدم «نسخ إلى بنك آخر»');
    }
    const now = nowIso();
    const values = [
      q.bankId,
      q.type,
      q.text.trim(),
      q.imageId,
      q.points,
      q.level,
      q.maxTries,
      q.lateTryScoring,
      q.shuffleOptions ? 1 : 0,
      JSON.stringify(q.data),
    ];
    if (existing) {
      this.db.run(
        `UPDATE question SET bank_id=?, type=?, text=?, image_id=?, points=?, level=?, max_tries=?, late_try_scoring=?,
                shuffle_options=?, data=?, tested_at=?, updated_at=? WHERE id=?`,
        [...values, tested ? now : null, now, q.id],
      );
    } else {
      this.db.run(
        `INSERT INTO question (bank_id, type, text, image_id, points, level, max_tries, late_try_scoring,
                shuffle_options, data, tested_at, created_at, updated_at, id)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [...values, tested ? now : null, now, now, q.id],
      );
    }
    return this.get(q.id);
  }

  /** نسخة مستقلة من السؤال، في البنك نفسه أو في بنك آخر. */
  copy(id: string, targetBankId?: string): StoredQuestion {
    const q = this.get(id);
    const copy = { ...q, id: newId(), bankId: targetBankId ?? q.bankId };
    return this.save(copy, false);
  }

  /** حذف السؤال من البنك. يبقى في قاعدة البيانات مؤرشفًا لأن النتائج القديمة قد تشير إليه. */
  archive(id: string): void {
    const used = this.db.get<{ n: number }>(
      `SELECT COUNT(*) AS n FROM exam_question eq JOIN exam e ON e.id = eq.exam_id
        WHERE eq.question_id = ? AND e.status <> 'archived'`,
      [id],
    );
    if (Number(used?.n ?? 0) > 0) throw new UserError('السؤال مستخدم في اختبار. احذفه من الاختبار أولًا');
    this.db.run('UPDATE question SET archived = 1, updated_at = ? WHERE id = ?', [nowIso(), id]);
  }

  countsByType(bankId: string): Record<QuestionType, number> {
    const counts: Record<QuestionType, number> = { TF: 0, MCQ: 0, LIST: 0, SKILL: 0, HOTSPOT: 0 };
    for (const r of this.db.all<{ type: QuestionType; n: number }>(
      'SELECT type, COUNT(*) AS n FROM question WHERE bank_id = ? AND archived = 0 GROUP BY type',
      [bankId],
    )) {
      counts[r.type] = Number(r.n);
    }
    return counts;
  }
}
