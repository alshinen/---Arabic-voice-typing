import { describe, expect, it } from 'vitest';
import { AppDatabase } from '../src/main/db/database';
import { AuthService } from '../src/main/services/auth';
import { BankService } from '../src/main/services/banks';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const now = new Date().toISOString();

describe('قاعدة البيانات', () => {
  it('تُنشأ بالبيانات الأولية: 3 درجات ترفيع و4 بنوك', async () => {
    const db = await AppDatabase.open(null);
    expect(db.schemaVersion).toBe(1);
    expect(db.all('SELECT * FROM grade')).toHaveLength(3);
    const banks = new BankService(db).list();
    expect(banks.map((b) => b.id)).toEqual(['bank-4to3', 'bank-3to2', 'bank-2to1', 'bank-general']);
    expect(banks.every((b) => b.total === 0)).toBe(true);
  });

  it('تُحفظ في ملف وتُفتح مرة أخرى دون تكرار الترحيل', async () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'exams-')), 'data.sqlite');
    const db1 = await AppDatabase.open(file);
    db1.run(
      "INSERT INTO question (id, bank_id, type, text, points, max_tries, data, created_at, updated_at) VALUES ('q1','bank-4to3','TF','نص',0.5,1,'{}',?,?)",
      [now, now],
    );
    db1.close();
    const db2 = await AppDatabase.open(file);
    expect(db2.schemaVersion).toBe(1);
    const bank = new BankService(db2).list().find((b) => b.id === 'bank-4to3')!;
    expect(bank.countsByType.TF).toBe(1);
  });

  it('بنك الترفيع يجب أن يرتبط بدرجة، والبنك العام بلا درجة', async () => {
    const db = await AppDatabase.open(null);
    expect(() => db.run("INSERT INTO question_bank (id, kind, grade_id, name) VALUES ('x','promotion',NULL,'خطأ')")).toThrow();
  });

  it('سؤال الصورة يحتاج صورة', async () => {
    const db = await AppDatabase.open(null);
    expect(() =>
      db.run(
        "INSERT INTO question (id, bank_id, type, text, points, data, created_at, updated_at) VALUES ('q','bank-general','HOTSPOT','اضغط',1,'{}',?,?)",
        [now, now],
      ),
    ).toThrow();
  });

  it('لا يتكرر سؤال داخل الاختبار', async () => {
    const db = await AppDatabase.open(null);
    db.run(
      "INSERT INTO question (id, bank_id, type, text, points, data, created_at, updated_at) VALUES ('q','bank-general','TF','نص',1,'{}',?,?)",
      [now, now],
    );
    db.run(
      "INSERT INTO exam (id, title, exam_type, question_mode, settings, created_at, updated_at) VALUES ('e','اختبار','surprise','fixed','{}',?,?)",
      [now, now],
    );
    db.run("INSERT INTO exam_question (id, exam_id, question_id, sort_order, points) VALUES ('a','e','q',0,1)");
    expect(() =>
      db.run("INSERT INTO exam_question (id, exam_id, question_id, sort_order, points) VALUES ('b','e','q',1,1)"),
    ).toThrow();
  });

  it('المعاملة تتراجع بالكامل عند الخطأ', async () => {
    const db = await AppDatabase.open(null);
    expect(() =>
      db.transaction(() => {
        db.run("INSERT INTO setting (key, value) VALUES ('a','1')");
        throw new Error('فشل');
      }),
    ).toThrow();
    expect(db.get("SELECT * FROM setting WHERE key = 'a'")).toBeUndefined();
  });
});

describe('كلمة مرور المدرب', () => {
  it('تُحفظ مشفرة وتُتحقق', async () => {
    const db = await AppDatabase.open(null);
    const auth = new AuthService(db);
    expect(auth.hasPassword()).toBe(false);
    auth.setPassword('1234');
    expect(auth.hasPassword()).toBe(true);
    expect(auth.verify('1234')).toBe(true);
    expect(auth.verify('0000')).toBe(false);
    const stored = db.get<{ value: string }>("SELECT value FROM setting WHERE key = 'trainer_password'")!;
    expect(stored.value).not.toContain('1234');
  });
  it('ترفض كلمة مرور قصيرة', async () => {
    const auth = new AuthService(await AppDatabase.open(null));
    expect(() => auth.setPassword('12')).toThrow();
  });
});
