/** وضع المقعدين على كمبيوتر واحد (design.md القسم 7.2). */

export type SeatId = 'A' | 'B';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SeatLayout {
  /** حدود النافذة الممتدة على الشاشات، بإحداثيات سطح المكتب. */
  window: Rect;
  /** حدود كل مقعد داخل النافذة. A = الشاشة اليمنى (المتدرب الأول)، B = اليسرى. */
  seats: Record<SeatId, Rect>;
  /** true إن كانت هناك شاشة واحدة فقط فقُسمت نصفين. */
  split: boolean;
}

/** أحداث الماوس كما تصل من قارئ الفئران المنفصلة. */
export interface MouseEventMsg {
  id: string;
  /** حركة نسبية بوحدات الماوس، أو موضع مطلق 0..65535 إن كان absolute. */
  dx: number;
  dy: number;
  absolute: boolean;
  buttons: number;
  wheel: number;
}

export interface MouseDevice {
  id: string;
  name: string;
}

export interface SeatBinding {
  A: string | null;
  B: string | null;
}

/** أعلام أزرار Raw Input في ويندوز. */
export const RI_LEFT_DOWN = 0x0001;
export const RI_LEFT_UP = 0x0002;

/**
 * تخطيط المقعدين: شاشتان ← المقعد A على اليمنى وB على اليسرى.
 * شاشة واحدة ← تُقسم نصفين (A يمين، B يسار) للتجربة أو لشاشة عريضة.
 */
export function computeSeatLayout(displays: readonly Rect[]): SeatLayout {
  if (displays.length === 0) throw new Error('لا توجد شاشة');
  const sorted = [...displays].sort((a, b) => a.x - b.x);
  if (sorted.length === 1) {
    const d = sorted[0]!;
    const half = Math.floor(d.width / 2);
    return {
      window: { ...d },
      seats: {
        B: { x: 0, y: 0, width: half, height: d.height },
        A: { x: half, y: 0, width: d.width - half, height: d.height },
      },
      split: true,
    };
  }
  // أكبر شاشتين متجاورتين: نأخذ الشاشتين الأوليين من اليسار.
  const left = sorted[0]!;
  const right = sorted[1]!;
  const x = Math.min(left.x, right.x);
  const y = Math.min(left.y, right.y);
  const window = {
    x,
    y,
    width: Math.max(left.x + left.width, right.x + right.width) - x,
    height: Math.max(left.y + left.height, right.y + right.height) - y,
  };
  const rel = (d: Rect): Rect => ({ x: d.x - x, y: d.y - y, width: d.width, height: d.height });
  return { window, seats: { A: rel(right), B: rel(left) }, split: false };
}

/** يحبس موضع السهم داخل حدود المقعد. */
export function clampToRect(p: { x: number; y: number }, r: Rect): { x: number; y: number } {
  return {
    x: Math.min(r.x + r.width - 1, Math.max(r.x, p.x)),
    y: Math.min(r.y + r.height - 1, Math.max(r.y, p.y)),
  };
}

/** يحلل سطرًا من مخرجات rawmouse.exe. */
export function parseRawLine(line: string): { kind: 'device'; device: MouseDevice } | { kind: 'event'; event: MouseEventMsg } | null {
  const parts = line.trim().split(' ');
  if (parts[0] === 'N' && parts.length >= 3) return { kind: 'device', device: { id: parts[1]!, name: parts.slice(2).join(' ') } };
  if ((parts[0] === 'M' || parts[0] === 'A') && parts.length >= 6) {
    const [, id, dx, dy, buttons, wheel] = parts;
    return {
      kind: 'event',
      event: { id: id!, dx: Number(dx), dy: Number(dy), absolute: parts[0] === 'A', buttons: Number(buttons), wheel: Number(wheel) },
    };
  }
  return null;
}
