import { useRef, useState } from 'react';
import { ar } from '../../shared/i18n/ar';
import { isInside, type Point } from '../../shared/hotspot/geometry';
import type { Region } from '../../shared/types/question';
import { ImageStage } from '../components/ImageStage';
import { RegionShape } from '../components/Regions';

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

type Drag =
  | { mode: 'draw'; start: Point }
  | { mode: 'move'; index: number; offset: Point; box: Box }
  | { mode: 'resize'; index: number; anchor: Point };

const MIN = 0.004;
const HANDLE = 0.014;

function toBox(r: Region): Box {
  return r.shape === 'rect' ? { x: r.x, y: r.y, w: r.w, h: r.h } : { x: r.cx - r.rx, y: r.cy - r.ry, w: r.rx * 2, h: r.ry * 2 };
}

function fromBox(shape: Region['shape'], b: Box): Region {
  const x = clamp01(b.x);
  const y = clamp01(b.y);
  const w = Math.max(MIN, Math.min(b.w, 1 - x));
  const h = Math.max(MIN, Math.min(b.h, 1 - y));
  return shape === 'rect' ? { shape, x, y, w, h } : { shape, cx: x + w / 2, cy: y + h / 2, rx: w / 2, ry: h / 2 };
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** صندوق من نقطتين، مع إبقاء الشكل دائرة أو مربعًا على الشاشة إن طُلب. */
function boxFrom(a: Point, b: Point, keepRatio: boolean, aspect: number): Box {
  let w = Math.abs(b.x - a.x);
  let h = Math.abs(b.y - a.y);
  if (keepRatio) {
    // مربع على الشاشة: w × عرض الصورة = h × ارتفاعها
    const side = Math.max(w, h / aspect);
    w = side;
    h = side * aspect;
  }
  return { x: b.x >= a.x ? a.x : a.x - w, y: b.y >= a.y ? a.y : a.y - h, w, h };
}

/**
 * محرر مناطق الإجابة على الصورة (design.md 2.4): دائرة أو مربع، رسم بالسحب،
 * تكبير وتصغير بالمقابض، وتحريك بالسحب. الإحداثيات نسب من الصورة الأصلية.
 */
export function HotspotEditor({
  src,
  natural,
  regions,
  onChange,
  tolerance,
}: {
  src: string;
  natural: { width: number; height: number };
  regions: Region[];
  onChange: (r: Region[]) => void;
  tolerance: number;
}) {
  const aspect = natural.width / natural.height;
  const [tool, setTool] = useState<Region['shape']>('ellipse');
  const [keepRatio, setKeepRatio] = useState(true);
  const [selected, setSelected] = useState<number | null>(regions.length ? 0 : null);
  const [draft, setDraft] = useState<Region | null>(null);
  const [zoom, setZoom] = useState(1);
  const drag = useRef<Drag | null>(null);

  const corners = (b: Box): Point[] => [
    { x: b.x, y: b.y },
    { x: b.x + b.w, y: b.y },
    { x: b.x, y: b.y + b.h },
    { x: b.x + b.w, y: b.y + b.h },
  ];
  const nearHandle = (p: Point, c: Point) => Math.abs(p.x - c.x) <= HANDLE && Math.abs(p.y - c.y) <= HANDLE * aspect;

  const onPointer = (kind: 'down' | 'move' | 'up', p: Point | null) => {
    if (!p) return;
    if (kind === 'down') {
      if (selected !== null && regions[selected]) {
        const b = toBox(regions[selected]!);
        const cs = corners(b);
        const hit = cs.findIndex((c) => nearHandle(p, c));
        if (hit >= 0) {
          drag.current = { mode: 'resize', index: selected, anchor: cs[3 - hit]! };
          return;
        }
      }
      for (let i = regions.length - 1; i >= 0; i--) {
        if (isInside(regions[i]!, p)) {
          const b = toBox(regions[i]!);
          setSelected(i);
          drag.current = { mode: 'move', index: i, offset: { x: p.x - b.x, y: p.y - b.y }, box: b };
          return;
        }
      }
      drag.current = { mode: 'draw', start: p };
      setSelected(null);
      return;
    }
    const d = drag.current;
    if (!d) return;
    if (d.mode === 'draw') {
      const b = boxFrom(d.start, p, keepRatio, aspect);
      const r = fromBox(tool, b);
      if (kind === 'move') setDraft(r);
      else {
        setDraft(null);
        drag.current = null;
        if (b.w > MIN * 2 && b.h > MIN * 2) {
          onChange([...regions, r]);
          setSelected(regions.length);
        }
      }
      return;
    }
    const current = regions[d.index];
    if (!current) return;
    let next: Region;
    if (d.mode === 'move') {
      const x = clamp01(Math.min(p.x - d.offset.x, 1 - d.box.w));
      const y = clamp01(Math.min(p.y - d.offset.y, 1 - d.box.h));
      next = fromBox(current.shape, { ...d.box, x, y });
    } else {
      next = fromBox(current.shape, boxFrom(d.anchor, p, keepRatio, aspect));
    }
    onChange(regions.map((r, i) => (i === d.index ? next : r)));
    if (kind === 'up') drag.current = null;
  };

  const selectedBox = selected !== null && regions[selected] ? toBox(regions[selected]!) : null;
  const hw = HANDLE * 0.7;

  return (
    <div className="hotspot-editor">
      <div className="row gap wrap center">
        <div className="segmented">
          <button type="button" className={`seg ${tool === 'ellipse' ? 'seg-on' : ''}`} onClick={() => setTool('ellipse')}>
            ⬤ {ar.hotspot.circle}
          </button>
          <button type="button" className={`seg ${tool === 'rect' ? 'seg-on' : ''}`} onClick={() => setTool('rect')}>
            ■ {ar.hotspot.square}
          </button>
        </div>
        <label className="check">
          <input type="checkbox" checked={keepRatio} onChange={(e) => setKeepRatio(e.target.checked)} />
          {ar.hotspot.keepRatio}
        </label>
        <button
          type="button"
          className="btn"
          disabled={selected === null}
          onClick={() => {
            if (selected === null) return;
            onChange(regions.filter((_, i) => i !== selected));
            setSelected(null);
          }}
        >
          {ar.hotspot.deleteRegion}
        </button>
        <button type="button" className="btn" onClick={() => setZoom((z) => Math.min(3, z + 0.5))}>
          + {ar.hotspot.zoomIn}
        </button>
        <button type="button" className="btn" onClick={() => setZoom((z) => Math.max(1, z - 0.5))} disabled={zoom === 1}>
          − {ar.hotspot.zoomOut}
        </button>
        <span className="muted">{ar.hotspot.count(regions.length)}</span>
      </div>
      <p className="muted">{ar.hotspot.hint}</p>
      <div className="zoom-box">
        <div style={{ width: `${zoom * 100}%` }}>
          <ImageStage
            src={src}
            natural={natural}
            height={Math.round(520 * zoom)}
            clamp
            onPointer={onPointer}
            overlay={
              <>
                {regions.map((r, i) => (
                  <g key={i}>
                    {tolerance > 0 && (
                      <RegionShape
                        r={fromBox(r.shape, (() => {
                          const b = toBox(r);
                          return { x: b.x - tolerance, y: b.y - tolerance, w: b.w + tolerance * 2, h: b.h + tolerance * 2 };
                        })())}
                        className="region-tolerance"
                      />
                    )}
                    <RegionShape r={r} className={i === selected ? 'region region-selected' : 'region'} />
                  </g>
                ))}
                {draft && <RegionShape r={draft} className="region region-draft" />}
                {selectedBox &&
                  corners(selectedBox).map((c, i) => (
                    <rect
                      key={i}
                      x={c.x - hw}
                      y={c.y - hw * aspect}
                      width={hw * 2}
                      height={hw * 2 * aspect}
                      className="handle"
                      vectorEffect="non-scaling-stroke"
                    />
                  ))}
              </>
            }
          />
        </div>
      </div>
    </div>
  );
}
