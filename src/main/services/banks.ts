import type { AppDatabase } from '../db/database';
import type { BankSummary } from '../../shared/types/api';
import type { QuestionType } from '../../shared/types/domain';

const TYPES: QuestionType[] = ['TF', 'MCQ', 'LIST', 'SKILL', 'HOTSPOT'];

export class BankService {
  constructor(private readonly db: AppDatabase) {}

  /** البنوك الأربعة مع عدد أسئلتها حسب النوع. */
  list(): BankSummary[] {
    const banks = this.db.all<{ id: string; kind: 'promotion' | 'general'; name: string; grade_code: string | null }>(
      `SELECT b.id, b.kind, b.name, g.code AS grade_code
         FROM question_bank b LEFT JOIN grade g ON g.id = b.grade_id
        ORDER BY b.kind DESC, g.from_level DESC`,
    );
    const counts = this.db.all<{ bank_id: string; type: QuestionType; n: number }>(
      'SELECT bank_id, type, COUNT(*) AS n FROM question WHERE archived = 0 GROUP BY bank_id, type',
    );
    return banks.map((b) => {
      const byType = Object.fromEntries(TYPES.map((t) => [t, 0])) as Record<QuestionType, number>;
      for (const c of counts) if (c.bank_id === b.id) byType[c.type] = Number(c.n);
      const total = Object.values(byType).reduce((a, n) => a + n, 0);
      return { id: b.id, kind: b.kind, name: b.name, gradeCode: b.grade_code, countsByType: byType, total };
    });
  }
}
