import crypto from 'node:crypto';
import type { AppDatabase } from '../db/database';

const KEY = 'trainer_password';
const MIN_LENGTH = 4;

/** كلمة مرور المدرب: تُحفظ مشفرة (scrypt مع ملح)، ولا تُحفظ نصًا. */
export class AuthService {
  constructor(private readonly db: AppDatabase) {}

  hasPassword(): boolean {
    return this.db.get('SELECT 1 FROM setting WHERE key = ?', [KEY]) !== undefined;
  }

  setPassword(password: string): void {
    if (password.length < MIN_LENGTH) {
      throw new Error(`كلمة المرور يجب ألا تقل عن ${MIN_LENGTH} أحرف أو أرقام`);
    }
    const salt = crypto.randomBytes(16);
    const hash = crypto.scryptSync(password, salt, 64);
    const value = `${salt.toString('hex')}:${hash.toString('hex')}`;
    this.db.run('INSERT INTO setting (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [
      KEY,
      value,
    ]);
  }

  verify(password: string): boolean {
    const row = this.db.get<{ value: string }>('SELECT value FROM setting WHERE key = ?', [KEY]);
    if (!row) return false;
    const [saltHex, hashHex] = row.value.split(':');
    if (!saltHex || !hashHex) return false;
    const expected = Buffer.from(hashHex, 'hex');
    const actual = crypto.scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length);
    return crypto.timingSafeEqual(actual, expected);
  }
}
