import fs from 'node:fs';
import path from 'node:path';
import initSqlJs, { type Database as SqlJsDatabase, type SqlValue } from 'sql.js';
import { MIGRATIONS } from './schema';

export type Row = Record<string, SqlValue>;
export type Params = Record<string, SqlValue> | SqlValue[];

/**
 * غلاف لقاعدة SQLite (sql.js، بلا مكونات أصلية تحتاج تجميعًا على ويندوز).
 * القاعدة في الذاكرة، وتُحفظ إلى الملف بعد كل تعديل بكتابة ذرية.
 */
export class AppDatabase {
  private constructor(
    private readonly db: SqlJsDatabase,
    private readonly filePath: string | null,
  ) {}

  /** filePath = null لقاعدة في الذاكرة فقط (للاختبارات). */
  static async open(filePath: string | null, wasmPath?: string): Promise<AppDatabase> {
    const SQL = await initSqlJs(wasmPath ? { locateFile: () => wasmPath } : undefined);
    const existing = filePath && fs.existsSync(filePath) ? fs.readFileSync(filePath) : null;
    const db = existing ? new SQL.Database(existing) : new SQL.Database();
    db.run('PRAGMA foreign_keys = ON;');
    const app = new AppDatabase(db, filePath);
    app.migrate();
    return app;
  }

  get schemaVersion(): number {
    return Number(this.get<{ v: number }>('SELECT MAX(version) AS v FROM schema_version')?.v ?? 0);
  }

  private migrate(): void {
    this.db.run('CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)');
    const current = this.schemaVersion;
    MIGRATIONS.slice(current).forEach((sql, i) => {
      this.transaction(() => {
        this.db.exec(sql);
        this.run('INSERT INTO schema_version (version, applied_at) VALUES (?, ?)', [
          current + i + 1,
          new Date().toISOString(),
        ]);
      });
    });
  }

  all<T = Row>(sql: string, params: Params = []): T[] {
    const stmt = this.db.prepare(sql);
    try {
      stmt.bind(params);
      const rows: T[] = [];
      while (stmt.step()) rows.push(stmt.getAsObject() as T);
      return rows;
    } finally {
      stmt.free();
    }
  }

  get<T = Row>(sql: string, params: Params = []): T | undefined {
    return this.all<T>(sql, params)[0];
  }

  /** ينفّذ أمر تعديل، ويحفظ الملف ما لم يكن داخل معاملة. */
  run(sql: string, params: Params = []): void {
    this.db.run(sql, params);
    if (this.depth === 0) this.persist();
  }

  private depth = 0;

  /** معاملة: إما أن تنجح كل الأوامر أو لا يُطبَّق شيء. */
  transaction<T>(fn: () => T): T {
    const outer = this.depth === 0;
    this.db.run(outer ? 'BEGIN' : `SAVEPOINT sp${this.depth}`);
    this.depth++;
    try {
      const result = fn();
      this.depth--;
      this.db.run(outer ? 'COMMIT' : `RELEASE sp${this.depth}`);
      if (outer) this.persist();
      return result;
    } catch (err) {
      this.depth--;
      this.db.run(outer ? 'ROLLBACK' : `ROLLBACK TO sp${this.depth}`);
      throw err;
    }
  }

  private persist(): void {
    if (!this.filePath) return;
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const tmp = `${this.filePath}.tmp`;
    fs.writeFileSync(tmp, Buffer.from(this.db.export()));
    fs.renameSync(tmp, this.filePath);
  }

  close(): void {
    this.db.close();
  }
}
