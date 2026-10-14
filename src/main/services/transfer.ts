import fs from 'node:fs';
import path from 'node:path';
import type { AppDatabase, Row } from '../db/database';
import { UserError } from './util';

const BACKUP_FORMAT = 'arabic-exams-backup';
const RESULTS_FORMAT = 'arabic-exams-results';

interface BackupFile {
  format: typeof BACKUP_FORMAT;
  version: 1;
  createdAt: string;
  db: string;
  images: Record<string, string>;
}

interface ResultsFile {
  format: typeof RESULTS_FORMAT;
  version: 1;
  createdAt: string;
  device: string;
  trainees: Row[];
  attempts: Row[];
  attemptQuestions: Row[];
  answers: Row[];
}

/**
 * النسخ الاحتياطي ونقل النتائج بين الأجهزة (design.md القسم 7، الطريقة ب).
 * النسخة الاحتياطية ملف واحد فيه قاعدة البيانات والصور.
 */
export class TransferService {
  constructor(
    private readonly db: AppDatabase,
    private readonly dbFile: string,
    private readonly imagesDir: string,
  ) {}

  exportBackup(): Buffer {
    const images: Record<string, string> = {};
    if (fs.existsSync(this.imagesDir)) {
      for (const f of fs.readdirSync(this.imagesDir)) {
        images[f] = fs.readFileSync(path.join(this.imagesDir, f)).toString('base64');
      }
    }
    const file: BackupFile = {
      format: BACKUP_FORMAT,
      version: 1,
      createdAt: new Date().toISOString(),
      db: Buffer.from(this.db.exportBytes()).toString('base64'),
      images,
    };
    return Buffer.from(JSON.stringify(file), 'utf8');
  }

  /**
   * استعادة نسخة احتياطية: تستبدل كل البيانات الحالية.
   * بعدها يجب إعادة تشغيل البرنامج فورًا دون حفظ القاعدة المفتوحة.
   */
  importBackup(content: Buffer): void {
    let file: BackupFile;
    try {
      file = JSON.parse(content.toString('utf8')) as BackupFile;
    } catch {
      throw new UserError('الملف ليس نسخة احتياطية صالحة');
    }
    if (file.format !== BACKUP_FORMAT || typeof file.db !== 'string') throw new UserError('الملف ليس نسخة احتياطية صالحة');
    fs.mkdirSync(this.imagesDir, { recursive: true });
    for (const [name, data] of Object.entries(file.images ?? {})) {
      if (path.basename(name) !== name) continue;
      fs.writeFileSync(path.join(this.imagesDir, name), Buffer.from(data, 'base64'));
    }
    const tmp = `${this.dbFile}.restore`;
    fs.writeFileSync(tmp, Buffer.from(file.db, 'base64'));
    fs.renameSync(tmp, this.dbFile);
  }

  /** تصدير النتائج من جهاز منعزل، لتُدمج في جهاز المدرب. */
  exportResults(device: string): Buffer {
    const attempts = this.db.all("SELECT * FROM attempt WHERE status IN ('submitted','timed_out')");
    const ids = attempts.map((a) => String(a.id));
    const inList = (col: string) => `${col} IN (${ids.map(() => '?').join(',') || "''"})`;
    const attemptQuestions = this.db.all(`SELECT * FROM attempt_question WHERE ${inList('attempt_id')}`, ids);
    const aqIds = attemptQuestions.map((a) => String(a.id));
    const answers = this.db.all(
      `SELECT * FROM attempt_answer WHERE attempt_question_id IN (${aqIds.map(() => '?').join(',') || "''"})`,
      aqIds,
    );
    const traineeIds = [...new Set(attempts.map((a) => a.trainee_id).filter(Boolean) as string[])];
    const trainees = this.db.all(
      `SELECT * FROM trainee WHERE id IN (${traineeIds.map(() => '?').join(',') || "''"})`,
      traineeIds,
    );
    const file: ResultsFile = {
      format: RESULTS_FORMAT,
      version: 1,
      createdAt: new Date().toISOString(),
      device,
      trainees,
      attempts,
      attemptQuestions,
      answers,
    };
    return Buffer.from(JSON.stringify(file), 'utf8');
  }

  /** دمج نتائج جهاز آخر دون تكرار. النتائج المستوردة سابقًا تُتجاهل. */
  importResults(content: Buffer): { added: number; duplicates: number; skipped: number } {
    let file: ResultsFile;
    try {
      file = JSON.parse(content.toString('utf8')) as ResultsFile;
    } catch {
      throw new UserError('الملف ليس ملف نتائج صالحًا');
    }
    if (file.format !== RESULTS_FORMAT) throw new UserError('الملف ليس ملف نتائج صالحًا');
    const result = { added: 0, duplicates: 0, skipped: 0 };
    this.db.transaction(() => {
      const traineeMap = new Map<string, string>();
      for (const t of file.trainees) {
        const byNumber = t.number
          ? this.db.get<{ id: string }>('SELECT id FROM trainee WHERE number = ?', [t.number as string])
          : undefined;
        const byId = this.db.get<{ id: string }>('SELECT id FROM trainee WHERE id = ?', [t.id as string]);
        if (byId) traineeMap.set(String(t.id), byId.id);
        else if (byNumber) traineeMap.set(String(t.id), byNumber.id);
        else {
          insertRow(this.db, 'trainee', t);
          traineeMap.set(String(t.id), String(t.id));
        }
      }
      for (const a of file.attempts) {
        if (this.db.get('SELECT 1 FROM attempt WHERE id = ?', [a.id as string])) {
          result.duplicates++;
          continue;
        }
        if (!this.db.get('SELECT 1 FROM exam WHERE id = ?', [a.exam_id as string])) {
          result.skipped++;
          continue;
        }
        insertRow(this.db, 'attempt', { ...a, trainee_id: a.trainee_id ? traineeMap.get(String(a.trainee_id)) ?? null : null });
        const aqs = file.attemptQuestions.filter((q) => q.attempt_id === a.id);
        for (const aq of aqs) {
          insertRow(this.db, 'attempt_question', aq);
          for (const ans of file.answers.filter((x) => x.attempt_question_id === aq.id)) insertRow(this.db, 'attempt_answer', ans);
        }
        result.added++;
      }
    });
    return result;
  }
}

const ALLOWED_TABLES = new Set(['trainee', 'attempt', 'attempt_question', 'attempt_answer']);

function insertRow(db: AppDatabase, table: string, row: Row): void {
  if (!ALLOWED_TABLES.has(table)) throw new Error('جدول غير مسموح');
  const cols = Object.keys(row).filter((c) => /^[a-z_]+$/.test(c));
  db.run(
    `INSERT INTO ${table} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`,
    cols.map((c) => row[c] ?? null),
  );
}
