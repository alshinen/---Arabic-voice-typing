import type { AppDatabase } from '../db/database';
import { ar } from '../../shared/i18n/ar';
import { roundForDisplay } from '../../shared/scoring/result';
import type { ExamType } from '../../shared/types/domain';
import type { Question } from '../../shared/types/question';
import { parseJson } from './util';

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
    question: Question;
    points: number;
    earned: number | null;
    tries: { tryNumber: number; correct: boolean; response: unknown; answeredAt: string }[];
  }[];
}

export interface ResultFilter {
  examId?: string | null;
  examType?: ExamType | null;
}

/** النتائج والتقارير (design.md 2.1 م11). */
export class ResultService {
  constructor(private readonly db: AppDatabase) {}

  list(filter: ResultFilter = {}): ResultRow[] {
    const where = ["a.status <> 'preview'"];
    const params: string[] = [];
    if (filter.examId) {
      where.push('a.exam_id = ?');
      params.push(filter.examId);
    }
    if (filter.examType) {
      where.push('e.exam_type = ?');
      params.push(filter.examType);
    }
    return this.db
      .all<{
        id: string;
        exam_id: string;
        title: string;
        exam_type: ExamType;
        name: string | null;
        number: string | null;
        started_at: string;
        status: ResultRow['status'];
        score: number | null;
        max_score: number | null;
        percent: number | null;
        passed: number | null;
      }>(
        `SELECT a.id, a.exam_id, e.title, e.exam_type, COALESCE(t.full_name, a.entered_name) AS name,
                COALESCE(t.number, a.entered_number) AS number, a.started_at, a.status, a.score, a.max_score,
                a.percent, a.passed
           FROM attempt a JOIN exam e ON e.id = a.exam_id LEFT JOIN trainee t ON t.id = a.trainee_id
          WHERE ${where.join(' AND ')} ORDER BY a.started_at DESC`,
        params,
      )
      .map((r) => ({
        attemptId: r.id,
        examId: r.exam_id,
        examTitle: r.title,
        examType: r.exam_type,
        traineeName: r.name ?? '—',
        traineeNumber: r.number,
        startedAt: r.started_at,
        status: r.status,
        score: r.score === null ? null : Number(r.score),
        maxScore: r.max_score === null ? null : Number(r.max_score),
        percent: r.percent === null ? null : Number(r.percent),
        passed: r.passed === null ? null : Boolean(r.passed),
      }));
  }

  detail(attemptId: string): ResultDetail {
    const row = this.list().find((r) => r.attemptId === attemptId);
    if (!row) throw new Error('النتيجة غير موجودة');
    const aqs = this.db.all<{ id: string; position: number; points: number; earned: number | null; snapshot: string }>(
      'SELECT id, position, points, earned, snapshot FROM attempt_question WHERE attempt_id = ? ORDER BY position',
      [attemptId],
    );
    return {
      ...row,
      questions: aqs.map((aq) => ({
        position: Number(aq.position),
        question: parseJson<Question>(aq.snapshot, {} as Question),
        points: Number(aq.points),
        earned: aq.earned === null ? null : Number(aq.earned),
        tries: this.db
          .all<{ try_number: number; is_correct: number; response: string; answered_at: string }>(
            'SELECT try_number, is_correct, response, answered_at FROM attempt_answer WHERE attempt_question_id = ? ORDER BY try_number',
            [aq.id],
          )
          .map((t) => ({
            tryNumber: Number(t.try_number),
            correct: Boolean(t.is_correct),
            response: parseJson(t.response, null),
            answeredAt: t.answered_at,
          })),
      })),
    };
  }

  /** ملف CSV يفتحه Excel بالعربية (مع BOM). */
  exportCsv(filter: ResultFilter = {}): string {
    const c = ar.results.csv;
    const header = [c.exam, c.type, c.trainee, c.number, c.date, c.score, c.total, c.percent, c.result, c.status];
    const lines = this.list(filter).map((r) => [
      r.examTitle,
      ar.examTypes[r.examType],
      r.traineeName,
      r.traineeNumber ?? '',
      r.startedAt.slice(0, 16).replace('T', ' '),
      r.score === null ? '' : String(roundForDisplay(r.score)),
      r.maxScore === null ? '' : String(roundForDisplay(r.maxScore)),
      r.percent === null ? '' : `${roundForDisplay(r.percent)}%`,
      r.passed === null ? '' : r.passed ? ar.results.passed : ar.results.failed,
      ar.results.status[r.status],
    ]);
    const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    return '﻿' + [header, ...lines].map((l) => l.map(esc).join(',')).join('\r\n');
  }
}
