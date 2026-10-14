import { useEffect, useRef, useState } from 'react';
import { ar } from '../../shared/i18n/ar';
import {
  clampToRect,
  RI_LEFT_DOWN,
  RI_LEFT_UP,
  type MouseDevice,
  type MouseEventMsg,
  type SeatBinding,
  type SeatId,
  type SeatLayout,
} from '../../shared/seats';
import { api } from '../api';
import { FeedbackProvider } from '../components/ui';
import { TraineeApp } from '../trainee/TraineeApp';

const SEATS: SeatId[] = ['A', 'B'];
/** مقدار الحركة الذي يكفي لربط ماوس بمقعد. */
const BIND_THRESHOLD = 150;

interface SeatPointer {
  x: number;
  y: number;
  downTarget: Element | null;
}

/**
 * وضع المقعدين (design.md 7.2): مقعدان مستقلان في نافذة واحدة تغطي الشاشتين.
 * أحداث الماوس الحقيقية من ويندوز تُتجاهل لأنها لا تميّز بين الفأرين، ويُرسم لكل متدرب
 * سهم خاص يتحرك بماوسه هو فقط، وتُرسل ضغطاته إلى مقعده فقط.
 */
export function SeatsApp() {
  const [layout, setLayout] = useState<(SeatLayout & { speed: number }) | null>(null);
  const [devices, setDevices] = useState<MouseDevice[]>([]);
  const [binding, setBinding] = useState<SeatBinding>({ A: null, B: null });
  const [binding2, setBinding2] = useState<SeatId | null>(null);
  const cursors = useRef<Record<SeatId, HTMLDivElement | null>>({ A: null, B: null });
  const pointers = useRef<Record<SeatId, SeatPointer>>({
    A: { x: 0, y: 0, downTarget: null },
    B: { x: 0, y: 0, downTarget: null },
  });
  const live = useRef({ layout, devices, binding, binding2 });
  live.current = { layout, devices, binding, binding2 };
  const bindProgress = useRef(new Map<string, number>());

  const moveCursor = (s: SeatId) => {
    const el = cursors.current[s];
    const p = pointers.current[s];
    if (el) el.style.transform = `translate(${p.x}px, ${p.y}px)`;
  };

  useEffect(() => {
    void api.seats.layout().then((l) => {
      setLayout(l);
      for (const s of SEATS) {
        const r = l.seats[s];
        pointers.current[s].x = r.x + r.width / 2;
        pointers.current[s].y = r.y + r.height / 2;
        moveCursor(s);
      }
    });
    void api.seats.devices().then(setDevices);
    void api.seats.binding().then((b) => {
      setBinding(b);
      if (!b.A || !b.B) setBinding2('A');
    });
    api.seats.onDevices(setDevices);
    api.seats.onRebind(() => {
      bindProgress.current.clear();
      setBinding({ A: null, B: null });
      setBinding2('A');
    });
    api.seats.onMouse((e) => onMouse(e));

    // أحداث ويندوز الحقيقية (السهم المشترك ولوحة المفاتيح) تُلغى. أحداث المقاعد مصطنعة (isTrusted = false).
    const block = (e: Event) => {
      if (e.isTrusted) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    };
    const types = ['pointerdown', 'pointerup', 'pointermove', 'mousedown', 'mouseup', 'click', 'dblclick', 'contextmenu', 'wheel', 'keydown', 'keypress'];
    for (const t of types) window.addEventListener(t, block, { capture: true, passive: false });
    return () => {
      for (const t of types) window.removeEventListener(t, block, { capture: true });
    };
    // يُسجَّل مرة واحدة؛ القيم الحالية تُقرأ من live.
  }, []);

  // ماوس محفوظ في الربط غير موصول الآن: يُطلب الربط من جديد.
  useEffect(() => {
    if (binding2 || devices.length < 2) return;
    const names = new Set(devices.map((d) => d.name));
    if (!binding.A || !names.has(binding.A) || !binding.B || !names.has(binding.B)) setBinding2('A');
  }, [devices, binding, binding2]);

  function seatOfDevice(id: string): SeatId | null {
    const { devices: ds, binding: b } = live.current;
    const name = ds.find((d) => d.id === id)?.name;
    if (!name) return null;
    if (b.A === name) return 'A';
    if (b.B === name) return 'B';
    return null;
  }

  function bind(e: MouseEventMsg, seat: SeatId) {
    const total = (bindProgress.current.get(e.id) ?? 0) + Math.abs(e.dx) + Math.abs(e.dy) + (e.buttons ? BIND_THRESHOLD : 0);
    bindProgress.current.set(e.id, total);
    const name = live.current.devices.find((d) => d.id === e.id)?.name;
    const current = live.current.binding;
    if (!name || total < BIND_THRESHOLD) return;
    if (seat === 'B' && current.A === name) return;
    const next = { ...current, [seat]: name };
    bindProgress.current.clear();
    setBinding(next);
    if (seat === 'A') setBinding2('B');
    else {
      setBinding2(null);
      void api.seats.saveBinding(next);
    }
  }

  function onMouse(e: MouseEventMsg) {
    const { layout: l, binding2: waiting } = live.current;
    if (!l) return;
    if (waiting) return bind(e, waiting);
    const seat = seatOfDevice(e.id);
    if (!seat) return;
    const rect = l.seats[seat];
    const p = pointers.current[seat];
    if (e.absolute) {
      p.x = rect.x + (e.dx / 65535) * rect.width;
      p.y = rect.y + (e.dy / 65535) * rect.height;
    } else {
      p.x += e.dx * l.speed;
      p.y += e.dy * l.speed;
    }
    const c = clampToRect(p, rect);
    p.x = c.x;
    p.y = c.y;
    moveCursor(seat);

    const hit = document.elementFromPoint(p.x, p.y);
    const target = hit?.closest(`[data-seat="${seat}"]`) ? hit : null;
    if (!target) return;
    if (e.dx || e.dy) dispatch(target, 'pointermove', seat, p, false);
    if (e.buttons & RI_LEFT_DOWN) {
      p.downTarget = target;
      dispatch(target, 'pointerdown', seat, p, true);
      dispatch(target, 'mousedown', seat, p, true);
    }
    if (e.buttons & RI_LEFT_UP) {
      const down = p.downTarget;
      p.downTarget = null;
      dispatch(target, 'pointerup', seat, p, false);
      dispatch(target, 'mouseup', seat, p, false);
      // الضغطة تُحتسب إن رُفع الزر على العنصر نفسه الذي ضُغط عليه أو داخله.
      if (down && (down === target || down.contains(target))) dispatch(target, 'click', seat, p, false);
      else if (down && target.contains(down)) dispatch(down, 'click', seat, p, false);
    }
    if (e.wheel) scrollFrom(target, -e.wheel, seat);
  }

  return (
    <div className="seats-root">
      {layout &&
        SEATS.map((s) => {
          const r = layout.seats[s];
          return (
            <div key={s} className={`seat seat-${s}`} data-seat={s} style={{ left: r.x, top: r.y, width: r.width, height: r.height }}>
              <FeedbackProvider>
                <div className="seat-label">{s === 'A' ? ar.seats.seatA : ar.seats.seatB}</div>
                <TraineeApp seat={s} />
              </FeedbackProvider>
              {binding2 && (
                <div className="bind-overlay">
                  <h1>{ar.seats.bindTitle}</h1>
                  {binding2 === s ? (
                    <p className="big">{s === 'A' ? ar.seats.bindRight : ar.seats.bindLeft}</p>
                  ) : (
                    <p className="muted">{binding[s] ? ar.seats.bindDone : ar.seats.bindWaiting}</p>
                  )}
                  <p className="muted">{ar.seats.devicesFound(devices.length)}</p>
                  {devices.length < 2 && <p className="warn">{ar.seats.needTwo}</p>}
                  <p className="muted">{ar.seats.shortcuts}</p>
                </div>
              )}
            </div>
          );
        })}
      {SEATS.map((s) => (
        <div
          key={s}
          ref={(el) => {
            cursors.current[s] = el;
            moveCursor(s);
          }}
          className={`seat-cursor seat-cursor-${s}`}
          aria-hidden
        >
          <svg width="24" height="32" viewBox="0 0 24 32">
            <path d="M2 2 L2 26 L8 20 L12 30 L16 28 L12 18 L20 18 Z" />
          </svg>
        </div>
      ))}
    </div>
  );
}

function dispatch(target: Element, type: string, seat: SeatId, p: { x: number; y: number }, pressed: boolean): void {
  const init: PointerEventInit = {
    bubbles: true,
    cancelable: true,
    composed: true,
    clientX: p.x,
    clientY: p.y,
    button: 0,
    buttons: pressed ? 1 : 0,
    pointerId: seat === 'A' ? 101 : 102,
    pointerType: 'mouse',
    isPrimary: true,
    view: window,
  };
  target.dispatchEvent(type.startsWith('pointer') ? new PointerEvent(type, init) : new MouseEvent(type, init));
}

/** التمرير بعجلة الماوس داخل مقعد المتدرب فقط. */
function scrollFrom(el: Element, delta: number, seat: SeatId): void {
  let node: Element | null = el;
  while (node) {
    const style = getComputedStyle(node);
    const scrollable = /(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight;
    if (scrollable || node.getAttribute('data-seat') === seat) {
      node.scrollBy({ top: (delta / 120) * 80 });
      return;
    }
    node = node.parentElement;
  }
}
