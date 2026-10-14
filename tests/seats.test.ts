import { describe, expect, it } from 'vitest';
import { clampToRect, computeSeatLayout, parseRawLine } from '../src/shared/seats';

describe('وضع المقعدين', () => {
  it('شاشتان: A على اليمنى وB على اليسرى، والنافذة تغطي الاثنتين', () => {
    const l = computeSeatLayout([
      { x: 1920, y: 0, width: 1920, height: 1080 },
      { x: 0, y: 0, width: 1920, height: 1080 },
    ]);
    expect(l.window).toEqual({ x: 0, y: 0, width: 3840, height: 1080 });
    expect(l.seats.A.x).toBe(1920);
    expect(l.seats.B.x).toBe(0);
    expect(l.split).toBe(false);
  });
  it('شاشة ثانوية على اليسار بإحداثيات سالبة', () => {
    const l = computeSeatLayout([
      { x: 0, y: 0, width: 1920, height: 1080 },
      { x: -1600, y: 100, width: 1600, height: 900 },
    ]);
    expect(l.window).toEqual({ x: -1600, y: 0, width: 3520, height: 1080 });
    expect(l.seats.B).toEqual({ x: 0, y: 100, width: 1600, height: 900 });
    expect(l.seats.A).toEqual({ x: 1600, y: 0, width: 1920, height: 1080 });
  });
  it('شاشة واحدة تُقسم نصفين', () => {
    const l = computeSeatLayout([{ x: 0, y: 0, width: 1366, height: 768 }]);
    expect(l.split).toBe(true);
    expect(l.seats.B.width + l.seats.A.width).toBe(1366);
  });
  it('السهم محبوس داخل المقعد', () => {
    expect(clampToRect({ x: -50, y: 9999 }, { x: 100, y: 0, width: 200, height: 100 })).toEqual({ x: 100, y: 99 });
  });
  it('قراءة أسطر قارئ الفئران', () => {
    expect(parseRawLine('N 12345 \\\\?\\HID#VID_046D')).toEqual({ kind: 'device', device: { id: '12345', name: '\\\\?\\HID#VID_046D' } });
    expect(parseRawLine('M 12345 -3 4 1 0')).toEqual({
      kind: 'event',
      event: { id: '12345', dx: -3, dy: 4, absolute: false, buttons: 1, wheel: 0 },
    });
    expect(parseRawLine('READY')).toBeNull();
  });
});
