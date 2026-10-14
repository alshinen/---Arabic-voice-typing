import { z } from 'zod';
import type { AppDatabase } from '../db/database';
import { newId, nowIso, UserError } from './util';

export interface Trainee {
  id: string;
  number: string | null;
  fullName: string;
  currentLevel: number | null;
  active: boolean;
}

const schema = z.object({
  id: z.string().nullable(),
  number: z
    .string()
    .trim()
    .regex(/^[0-9]*$/, 'الرقم يجب أن يحتوي أرقامًا فقط')
    .nullable()
    .transform((v) => (v ? v : null)),
  fullName: z.string().trim().min(1, 'اكتب اسم المتدرب'),
  currentLevel: z.number().int().min(1).max(4).nullable(),
  active: z.boolean(),
});

/** يحوّل الأرقام العربية الهندية (٠-٩) إلى أرقام عادية. */
export function normalizeDigits(s: string): string {
  return s.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
}

export class TraineeService {
  constructor(private readonly db: AppDatabase) {}

  list(includeInactive = false): Trainee[] {
    return this.db
      .all<{ id: string; number: string | null; full_name: string; current_level: number | null; active: number }>(
        `SELECT id, number, full_name, current_level, active FROM trainee
          ${includeInactive ? '' : 'WHERE active = 1'} ORDER BY full_name`,
      )
      .map((r) => ({
        id: r.id,
        number: r.number,
        fullName: r.full_name,
        currentLevel: r.current_level === null ? null : Number(r.current_level),
        active: Boolean(r.active),
      }));
  }

  findByNumber(number: string): Trainee | null {
    const n = normalizeDigits(number.trim());
    return this.list().find((t) => t.number === n) ?? null;
  }

  get(id: string): Trainee | null {
    return this.list(true).find((t) => t.id === id) ?? null;
  }

  save(input: unknown): Trainee {
    const raw = input as { number?: string | null };
    const parsed = schema.safeParse({ ...(input as object), number: raw?.number ? normalizeDigits(raw.number) : null });
    if (!parsed.success) throw new UserError(parsed.error.issues[0]?.message ?? 'بيانات غير صالحة');
    const t = parsed.data;
    if (t.number) {
      const other = this.db.get<{ id: string }>('SELECT id FROM trainee WHERE number = ?', [t.number]);
      if (other && other.id !== t.id) throw new UserError(`الرقم ${t.number} مسجل لمتدرب آخر`);
    }
    const id = t.id ?? newId();
    if (t.id) {
      this.db.run('UPDATE trainee SET number = ?, full_name = ?, current_level = ?, active = ? WHERE id = ?', [
        t.number,
        t.fullName,
        t.currentLevel,
        t.active ? 1 : 0,
        t.id,
      ]);
    } else {
      this.db.run('INSERT INTO trainee (id, number, full_name, current_level, active, created_at) VALUES (?,?,?,?,?,?)', [
        id,
        t.number,
        t.fullName,
        t.currentLevel,
        t.active ? 1 : 0,
        nowIso(),
      ]);
    }
    return { id, number: t.number, fullName: t.fullName, currentLevel: t.currentLevel, active: t.active };
  }

  /** حذف المتدرب: إن كانت له نتائج يُعطَّل فقط حتى لا تضيع نتائجه. */
  remove(id: string): void {
    const has = this.db.get('SELECT 1 FROM attempt WHERE trainee_id = ?', [id]);
    if (has) this.db.run('UPDATE trainee SET active = 0 WHERE id = ?', [id]);
    else this.db.run('DELETE FROM trainee WHERE id = ?', [id]);
  }

  /**
   * استيراد من ملف CSV (يُحفظ من Excel): كل سطر «الرقم، الاسم، الدرجة الحالية (اختياري)».
   * السطر الذي رقمه مسجل يُحدَّث بدل التكرار.
   */
  importCsv(text: string): { added: number; updated: number; skipped: string[] } {
    const result = { added: 0, updated: 0, skipped: [] as string[] };
    const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    this.db.transaction(() => {
      lines.forEach((line, i) => {
        const cells = line.split(/[,;\t،]/).map((c) => c.trim().replace(/^"|"$/g, ''));
        const [rawNumber = '', name = '', rawLevel = ''] = cells;
        const number = normalizeDigits(rawNumber);
        if (i === 0 && !/^[0-9]*$/.test(number)) return; // سطر العناوين
        if (!name) {
          result.skipped.push(`السطر ${i + 1}: الاسم فارغ`);
          return;
        }
        const level = /^[1-4]$/.test(normalizeDigits(rawLevel)) ? Number(normalizeDigits(rawLevel)) : null;
        const existing = number ? this.findByNumber(number) : null;
        try {
          this.save({ id: existing?.id ?? null, number: number || null, fullName: name, currentLevel: level, active: true });
          if (existing) result.updated++;
          else result.added++;
        } catch (e) {
          result.skipped.push(`السطر ${i + 1}: ${(e as Error).message}`);
        }
      });
    });
    return result;
  }
}
