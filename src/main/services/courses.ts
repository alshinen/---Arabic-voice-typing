import { z } from 'zod';
import type { AppDatabase } from '../db/database';
import { newId, nowIso, UserError } from './util';

export interface Course {
  id: string;
  courseNumber: string;
  courseName: string;
  startDate: string | null;
  lessons: Lesson[];
}

export interface Lesson {
  id: string;
  courseId: string | null;
  lessonNumber: number | null;
  title: string;
  date: string | null;
}

const courseSchema = z.object({
  id: z.string().nullable(),
  courseNumber: z.string().trim().min(1, 'اكتب رقم الدورة'),
  courseName: z.string().trim().min(1, 'اكتب اسم الدورة'),
  startDate: z.string().nullable(),
});

const lessonSchema = z.object({
  id: z.string().nullable(),
  courseId: z.string().nullable(),
  lessonNumber: z.number().int().positive().nullable(),
  title: z.string().trim().min(1, 'اكتب عنوان الحصة'),
  date: z.string().nullable(),
});

/** الدورات وحصصها (design.md 1.2). */
export class CourseService {
  constructor(private readonly db: AppDatabase) {}

  list(): Course[] {
    const lessons = this.listLessons();
    return this.db
      .all<{ id: string; course_number: string; course_name: string; start_date: string | null }>(
        'SELECT id, course_number, course_name, start_date FROM course WHERE archived = 0 ORDER BY created_at DESC',
      )
      .map((r) => ({
        id: r.id,
        courseNumber: r.course_number,
        courseName: r.course_name,
        startDate: r.start_date,
        lessons: lessons.filter((l) => l.courseId === r.id),
      }));
  }

  listLessons(): Lesson[] {
    return this.db
      .all<{ id: string; course_id: string | null; lesson_number: number | null; title: string; date: string | null }>(
        'SELECT id, course_id, lesson_number, title, date FROM lesson ORDER BY lesson_number, created_at',
      )
      .map((r) => ({
        id: r.id,
        courseId: r.course_id,
        lessonNumber: r.lesson_number === null ? null : Number(r.lesson_number),
        title: r.title,
        date: r.date,
      }));
  }

  saveCourse(input: unknown): string {
    const parsed = courseSchema.safeParse(input);
    if (!parsed.success) throw new UserError(parsed.error.issues[0]?.message ?? 'بيانات غير صالحة');
    const c = parsed.data;
    if (c.id) {
      this.db.run('UPDATE course SET course_number = ?, course_name = ?, start_date = ? WHERE id = ?', [
        c.courseNumber,
        c.courseName,
        c.startDate,
        c.id,
      ]);
      return c.id;
    }
    const id = newId();
    this.db.run('INSERT INTO course (id, course_number, course_name, start_date, created_at) VALUES (?,?,?,?,?)', [
      id,
      c.courseNumber,
      c.courseName,
      c.startDate,
      nowIso(),
    ]);
    return id;
  }

  archiveCourse(id: string): void {
    this.db.run('UPDATE course SET archived = 1 WHERE id = ?', [id]);
  }

  saveLesson(input: unknown): string {
    const parsed = lessonSchema.safeParse(input);
    if (!parsed.success) throw new UserError(parsed.error.issues[0]?.message ?? 'بيانات غير صالحة');
    const l = parsed.data;
    if (l.id) {
      this.db.run('UPDATE lesson SET course_id = ?, lesson_number = ?, title = ?, date = ? WHERE id = ?', [
        l.courseId,
        l.lessonNumber,
        l.title,
        l.date,
        l.id,
      ]);
      return l.id;
    }
    const id = newId();
    this.db.run('INSERT INTO lesson (id, course_id, lesson_number, title, date, created_at) VALUES (?,?,?,?,?,?)', [
      id,
      l.courseId,
      l.lessonNumber,
      l.title,
      l.date,
      nowIso(),
    ]);
    return id;
  }

  removeLesson(id: string): void {
    const used = this.db.get('SELECT 1 FROM exam WHERE lesson_id = ?', [id]);
    if (used) throw new UserError('الحصة مرتبطة باختبار، فلا يمكن حذفها');
    this.db.run('DELETE FROM lesson WHERE id = ?', [id]);
  }
}
