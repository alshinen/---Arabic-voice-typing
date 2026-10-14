import { z } from 'zod';
import type { AppDatabase } from '../db/database';
import { newId, nowIso, parseJson, UserError } from './util';

export interface ReadyList {
  id: string;
  name: string;
  items: string[];
}

const schema = z.object({
  id: z.string().nullable(),
  name: z.string().trim().min(1, 'اكتب اسم القائمة'),
  items: z.array(z.string().trim().min(1)).min(1, 'أضف عنصرًا واحدًا على الأقل'),
});

/** «القوائم الجاهزة» لأسئلة «اذكر» والمهارات (design.md 1.7). */
export class ReadyListService {
  constructor(private readonly db: AppDatabase) {}

  list(): ReadyList[] {
    return this.db
      .all<{ id: string; name: string; items: string }>('SELECT id, name, items FROM ready_list ORDER BY name')
      .map((r) => ({ id: r.id, name: r.name, items: parseJson<string[]>(r.items, []) }));
  }

  save(input: unknown): ReadyList {
    const parsed = schema.safeParse(input);
    if (!parsed.success) throw new UserError(parsed.error.issues[0]?.message ?? 'بيانات غير صالحة');
    const { id, name, items } = parsed.data;
    const unique = [...new Set(items)];
    const listId = id ?? newId();
    if (id && this.db.get('SELECT 1 FROM ready_list WHERE id = ?', [id])) {
      this.db.run('UPDATE ready_list SET name = ?, items = ? WHERE id = ?', [name, JSON.stringify(unique), id]);
    } else {
      this.db.run('INSERT INTO ready_list (id, name, items, created_at) VALUES (?,?,?,?)', [
        listId,
        name,
        JSON.stringify(unique),
        nowIso(),
      ]);
    }
    return { id: listId, name, items: unique };
  }

  remove(id: string): void {
    this.db.run('DELETE FROM ready_list WHERE id = ?', [id]);
  }
}
