import { roundForDisplay } from '../shared/scoring/result';

/** يعرض الدرجة مقربة لرقمين عشريين دون أصفار زائدة: 0.5، 1.33، 2. */
export function fmt(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  return String(roundForDisplay(n));
}

export function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatSeconds(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** يقرأ ملف صورة ويرجع بياناته وأبعاده الأصلية. */
export async function readImageFile(file: File): Promise<{ bytes: Uint8Array; width: number; height: number }> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return { bytes, width: img.naturalWidth, height: img.naturalHeight };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** أول حرف من النص لأزرار الحروف في القوائم الكبيرة (بعد إزالة «ال» التعريف). */
export function firstLetter(text: string): string {
  const t = text.trim().replace(/^ال(?=\S{2,})/, '');
  const c = t.charAt(0);
  return 'أإآ'.includes(c) ? 'ا' : c;
}
