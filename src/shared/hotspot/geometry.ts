/**
 * هندسة مناطق الإجابة على الصور (design.md 4.7).
 * كل الإحداثيات نسب من 0 إلى 1 من أبعاد الصورة الأصلية، لا بكسل.
 */

export interface Point {
  x: number;
  y: number;
}

export type HotspotShape =
  | { shape: 'rect'; x: number; y: number; w: number; h: number }
  | { shape: 'ellipse'; cx: number; cy: number; rx: number; ry: number }
  | { shape: 'polygon'; points: readonly (readonly [number, number])[] };

export interface DisplayedImageRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * يحوّل موضع الضغط على الشاشة إلى نسبة من الصورة المعروضة.
 * يرجع null إن كان الضغط خارج حدود الصورة، فلا يُحسب محاولة.
 */
export function toNormalized(clientX: number, clientY: number, img: DisplayedImageRect): Point | null {
  if (img.width <= 0 || img.height <= 0) return null;
  const x = (clientX - img.left) / img.width;
  const y = (clientY - img.top) / img.height;
  if (x < 0 || x > 1 || y < 0 || y > 1) return null;
  return { x, y };
}

/**
 * مساحة عرض الصورة داخل إطار مع الحفاظ على نسبة أبعادها، دون قص أو تمطيط
 * (مثل object-fit: contain).
 */
export function containRect(
  natural: { width: number; height: number },
  box: DisplayedImageRect,
): DisplayedImageRect {
  const scale = Math.min(box.width / natural.width, box.height / natural.height);
  const width = natural.width * scale;
  const height = natural.height * scale;
  return {
    left: box.left + (box.width - width) / 2,
    top: box.top + (box.height - height) / 2,
    width,
    height,
  };
}

/** هل النقطة داخل الشكل؟ tolerance هامش تسامح بنسبة من الصورة. */
export function isInside(shape: HotspotShape, p: Point, tolerance = 0): boolean {
  switch (shape.shape) {
    case 'rect':
      return (
        p.x >= shape.x - tolerance &&
        p.x <= shape.x + shape.w + tolerance &&
        p.y >= shape.y - tolerance &&
        p.y <= shape.y + shape.h + tolerance
      );
    case 'ellipse': {
      const rx = shape.rx + tolerance;
      const ry = shape.ry + tolerance;
      if (rx <= 0 || ry <= 0) return false;
      const dx = (p.x - shape.cx) / rx;
      const dy = (p.y - shape.cy) / ry;
      return dx * dx + dy * dy <= 1;
    }
    case 'polygon':
      return (
        pointInPolygon(p, shape.points) ||
        (tolerance > 0 && distanceToPolygonEdge(p, shape.points) <= tolerance)
      );
  }
}

/** هل النقطة داخل أي منطقة من مناطق السؤال؟ */
export function hitsAny(shapes: readonly HotspotShape[], p: Point, tolerance = 0): boolean {
  return shapes.some((s) => isInside(s, p, tolerance));
}

function pointInPolygon(p: Point, pts: readonly (readonly [number, number])[]): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i]!;
    const [xj, yj] = pts[j]!;
    const crosses = yi > p.y !== yj > p.y && p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}

function distanceToPolygonEdge(p: Point, pts: readonly (readonly [number, number])[]): number {
  let min = Infinity;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [x1, y1] = pts[j]!;
    const [x2, y2] = pts[i]!;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len2 = dx * dx + dy * dy;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - x1) * dx + (p.y - y1) * dy) / len2));
    const qx = x1 + t * dx;
    const qy = y1 + t * dy;
    min = Math.min(min, Math.hypot(p.x - qx, p.y - qy));
  }
  return min;
}
