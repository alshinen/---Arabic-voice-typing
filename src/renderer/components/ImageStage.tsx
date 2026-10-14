import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { containRect, toNormalized, type Point } from '../../shared/hotspot/geometry';

export type PointerKind = 'down' | 'move' | 'up';

/**
 * يعرض الصورة كاملة دون قص أو تمطيط داخل المساحة المتاحة، وفوقها طبقة SVG
 * إحداثياتها نسب من 0 إلى 1 (invariant 3). كل موضع ضغط يتحول إلى نسبة من الصورة.
 */
export function ImageStage({
  src,
  natural,
  height = 480,
  overlay,
  onPointer,
  cursor,
  clamp,
}: {
  src: string;
  natural: { width: number; height: number };
  height?: number | string;
  overlay?: ReactNode;
  onPointer?: (kind: PointerKind, p: Point | null, raw: { clientX: number; clientY: number }) => void;
  cursor?: string;
  /** في محرر المناطق: الموضع خارج الصورة يُقص إلى حدودها بدل تجاهله. */
  clamp?: boolean;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const update = () => setSize({ width: el.clientWidth, height: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const rect = size.width && size.height ? containRect(natural, { left: 0, top: 0, ...size }) : null;
  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);

  useEffect(() => {
    const up = () => {
      dragging.current = false;
    };
    window.addEventListener('pointerup', up);
    return () => window.removeEventListener('pointerup', up);
  }, []);

  const emit = (kind: PointerKind, e: React.PointerEvent) => {
    if (!onPointer || !svgRef.current) return;
    const r = svgRef.current.getBoundingClientRect();
    const p = clamp
      ? {
          x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
          y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)),
        }
      : toNormalized(e.clientX, e.clientY, { left: r.left, top: r.top, width: r.width, height: r.height });
    onPointer(kind, p, { clientX: e.clientX, clientY: e.clientY });
  };

  return (
    <div className="stage" ref={box} style={{ height }}>
      {rect && (
        <div className="stage-inner" style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }}>
          <img src={src} alt="" draggable={false} className="stage-img" />
          <svg
            ref={svgRef}
            className="stage-svg"
            viewBox="0 0 1 1"
            preserveAspectRatio="none"
            style={{ cursor: cursor ?? (onPointer ? 'crosshair' : 'default') }}
            onPointerDown={(e) => {
              if (e.button !== 0) return;
              dragging.current = true;
              try {
                (e.currentTarget as Element).setPointerCapture(e.pointerId);
              } catch {
                // أحداث وضع المقعدين مصطنعة ولا تقبل الالتقاط، ولا تحتاجه.
              }
              emit('down', e);
            }}
            onPointerMove={(e) => dragging.current && emit('move', e)}
            onPointerUp={(e) => {
              dragging.current = false;
              emit('up', e);
            }}
          >
            {overlay}
          </svg>
        </div>
      )}
    </div>
  );
}
