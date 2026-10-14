import fs from 'node:fs';
import path from 'node:path';
import type { AppDatabase } from '../db/database';
import { newId, nowIso, UserError } from './util';

export interface ImageInfo {
  id: string;
  title: string;
  width: number;
  height: number;
  usedBy: number;
}

const ALLOWED = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp']);
const MAX_BYTES = 25 * 1024 * 1024;

/** مكتبة الصور: الملفات في مجلد images داخل مجلد البيانات. */
export class ImageService {
  constructor(
    private readonly db: AppDatabase,
    readonly dir: string,
  ) {
    fs.mkdirSync(dir, { recursive: true });
  }

  list(): ImageInfo[] {
    return this.db
      .all<{ id: string; title: string; width_px: number; height_px: number; used: number }>(
        `SELECT i.id, i.title, i.width_px, i.height_px,
                (SELECT COUNT(*) FROM question q WHERE q.image_id = i.id AND q.archived = 0) AS used
           FROM image i ORDER BY i.created_at DESC`,
      )
      .map((r) => ({ id: r.id, title: r.title, width: Number(r.width_px), height: Number(r.height_px), usedBy: Number(r.used) }));
  }

  add(input: { bytes: Uint8Array; fileName: string; title: string; width: number; height: number }): ImageInfo {
    const ext = path.extname(input.fileName).slice(1).toLowerCase();
    if (!ALLOWED.has(ext)) throw new UserError('نوع الصورة غير مدعوم. استخدم PNG أو JPG');
    if (input.bytes.byteLength > MAX_BYTES) throw new UserError('حجم الصورة كبير جدًا (الحد 25 ميجابايت)');
    if (!(input.width > 0 && input.height > 0)) throw new UserError('تعذّر قراءة أبعاد الصورة');
    const id = newId();
    const fileName = `${id}.${ext}`;
    fs.writeFileSync(path.join(this.dir, fileName), input.bytes);
    const title = input.title.trim() || path.basename(input.fileName, path.extname(input.fileName));
    this.db.run('INSERT INTO image (id, title, file_name, width_px, height_px, created_at) VALUES (?,?,?,?,?,?)', [
      id,
      title,
      fileName,
      Math.round(input.width),
      Math.round(input.height),
      nowIso(),
    ]);
    return { id, title, width: input.width, height: input.height, usedBy: 0 };
  }

  rename(id: string, title: string): void {
    if (!title.trim()) throw new UserError('اكتب اسم الصورة');
    this.db.run('UPDATE image SET title = ? WHERE id = ?', [title.trim(), id]);
  }

  /** مسار ملف الصورة على القرص، أو null إن لم توجد. */
  filePath(id: string): string | null {
    const row = this.db.get<{ file_name: string }>('SELECT file_name FROM image WHERE id = ?', [id]);
    if (!row) return null;
    const p = path.join(this.dir, row.file_name);
    return fs.existsSync(p) ? p : null;
  }

  remove(id: string): void {
    const used = this.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM question WHERE image_id = ?', [id]);
    if (Number(used?.n ?? 0) > 0) throw new UserError('الصورة مستخدمة في أسئلة، فلا يمكن حذفها');
    const p = this.filePath(id);
    this.db.run('DELETE FROM image WHERE id = ?', [id]);
    if (p) fs.rmSync(p, { force: true });
  }
}
