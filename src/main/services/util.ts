import crypto from 'node:crypto';

export const newId = (): string => crypto.randomUUID();
export const nowIso = (): string => new Date().toISOString();

export function parseJson<T>(text: string | null | undefined, fallback: T): T {
  if (!text) return fallback;
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

/** خطأ برسالة عربية موجهة للمستخدم. */
export class UserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UserError';
  }
}
