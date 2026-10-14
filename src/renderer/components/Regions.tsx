import type { Region } from '../../shared/types/question';

/** رسم مناطق الإجابة داخل طبقة SVG (إحداثيات 0..1). */
export function RegionShape({ r, className }: { r: Region; className?: string }) {
  return r.shape === 'rect' ? (
    <rect x={r.x} y={r.y} width={r.w} height={r.h} className={className} vectorEffect="non-scaling-stroke" />
  ) : (
    <ellipse cx={r.cx} cy={r.cy} rx={r.rx} ry={r.ry} className={className} vectorEffect="non-scaling-stroke" />
  );
}

/** علامة موضع الضغط (✔ أو ✘) بحجم ثابت على الشاشة. */
export function ClickMark({ x, y, ok, aspect }: { x: number; y: number; ok: boolean; aspect: number }) {
  const rx = 0.018;
  const ry = rx * aspect;
  return (
    <g className={ok ? 'mark-ok' : 'mark-bad'}>
      <ellipse cx={x} cy={y} rx={rx} ry={ry} vectorEffect="non-scaling-stroke" />
    </g>
  );
}
