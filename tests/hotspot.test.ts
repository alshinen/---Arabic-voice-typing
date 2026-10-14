import { describe, expect, it } from 'vitest';
import { containRect, hitsAny, isInside, toNormalized } from '../src/shared/hotspot/geometry';

describe('مناطق الصور', () => {
  it('14: نقطة داخل القطع الناقص', () => {
    expect(isInside({ shape: 'ellipse', cx: 0.78, cy: 0.7, rx: 0.03, ry: 0.05 }, { x: 0.775, y: 0.667 })).toBe(true);
  });
  it('نقطة خارج القطع الناقص', () => {
    expect(isInside({ shape: 'ellipse', cx: 0.78, cy: 0.7, rx: 0.03, ry: 0.05 }, { x: 0.9, y: 0.7 })).toBe(false);
  });
  it('15: الضغط خارج حدود الصورة يُتجاهل', () => {
    const img = { left: 100, top: 50, width: 800, height: 450 };
    expect(toNormalized(90, 100, img)).toBeNull();
    expect(toNormalized(500, 600, img)).toBeNull();
  });
  it('مثال design.md 6.6: صورة بعرض 800، ضغطة عند (620, 300)', () => {
    const p = toNormalized(620, 300, { left: 0, top: 0, width: 800, height: 450 });
    expect(p!.x).toBeCloseTo(0.775, 10);
    expect(p!.y).toBeCloseTo(0.6667, 3);
    expect(isInside({ shape: 'ellipse', cx: 0.78, cy: 0.7, rx: 0.03, ry: 0.05 }, p!)).toBe(true);
  });
  it('المنطقة تبقى مطابقة مع أي حجم عرض', () => {
    const shape = { shape: 'rect', x: 0.3, y: 0.25, w: 0.1, h: 0.12 } as const;
    for (const width of [400, 800, 1920]) {
      const img = { left: 10, top: 20, width, height: (width * 9) / 16 };
      const clickX = img.left + 0.35 * img.width;
      const clickY = img.top + 0.3 * img.height;
      expect(isInside(shape, toNormalized(clickX, clickY, img)!)).toBe(true);
    }
  });
  it('هامش التسامح', () => {
    const shape = { shape: 'rect', x: 0.3, y: 0.3, w: 0.1, h: 0.1 } as const;
    expect(isInside(shape, { x: 0.405, y: 0.35 })).toBe(false);
    expect(isInside(shape, { x: 0.405, y: 0.35 }, 0.01)).toBe(true);
  });
  it('المضلع', () => {
    const tri = { shape: 'polygon', points: [[0, 0], [1, 0], [0, 1]] } as const;
    expect(isInside(tri, { x: 0.2, y: 0.2 })).toBe(true);
    expect(isInside(tri, { x: 0.8, y: 0.8 })).toBe(false);
  });
  it('أكثر من منطقة صحيحة للسؤال', () => {
    const shapes = [
      { shape: 'rect', x: 0, y: 0, w: 0.1, h: 0.1 },
      { shape: 'rect', x: 0.8, y: 0.8, w: 0.1, h: 0.1 },
    ] as const;
    expect(hitsAny(shapes, { x: 0.85, y: 0.85 })).toBe(true);
  });
  it('عرض الصورة دون قص أو تمطيط', () => {
    const r = containRect({ width: 1600, height: 900 }, { left: 0, top: 0, width: 800, height: 800 });
    expect(r.width).toBe(800);
    expect(r.height).toBe(450);
    expect(r.top).toBe(175);
  });
});
