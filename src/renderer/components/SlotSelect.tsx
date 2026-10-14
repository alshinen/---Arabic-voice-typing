import { useEffect, useMemo, useRef, useState } from 'react';
import { ar } from '../../shared/i18n/ar';
import type { Option } from '../../shared/types/question';
import { firstLetter } from '../util';

/**
 * قائمة منسدلة خاصة بالبرنامج للقوائم الكبيرة في «اذكر» والمهارات (invariant 5، 6):
 * تُرسم داخل الصفحة، والبحث بأزرار الحروف والتمرير، دون كتابة بلوحة المفاتيح.
 */
export function SlotSelect({
  options,
  value,
  onChange,
  disabled,
  placeholder = ar.trainee.chooseOption,
  status,
}: {
  options: Option[];
  value: string | null;
  onChange: (id: string | null) => void;
  disabled?: boolean;
  placeholder?: string;
  status?: 'ok' | 'bad' | null;
}) {
  const [open, setOpen] = useState(false);
  const [letter, setLetter] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [open]);

  const letters = useMemo(() => [...new Set(options.map((o) => firstLetter(o.text)))].sort((a, b) => a.localeCompare(b, 'ar')), [options]);
  const shown = letter ? options.filter((o) => firstLetter(o.text) === letter) : options;
  const selected = options.find((o) => o.id === value);

  return (
    <div className={`slot-select ${status ? `slot-${status}` : ''}`} ref={root}>
      <button
        type="button"
        className={`slot-button ${selected ? '' : 'slot-empty'}`}
        disabled={disabled}
        onClick={() => {
          setOpen((o) => !o);
          setLetter(null);
        }}
      >
        <span>{selected?.text ?? placeholder}</span>
        <span aria-hidden>▾</span>
      </button>
      {open && !disabled && (
        <div className="slot-panel" role="listbox">
          {letters.length > 6 && (
            <div className="letters">
              <button type="button" className={`letter ${letter === null ? 'letter-on' : ''}`} onClick={() => setLetter(null)}>
                {ar.common.all}
              </button>
              {letters.map((l) => (
                <button key={l} type="button" className={`letter ${letter === l ? 'letter-on' : ''}`} onClick={() => setLetter(l)}>
                  {l}
                </button>
              ))}
            </div>
          )}
          <div className="slot-options">
            {selected && (
              <button
                type="button"
                className="slot-option slot-clear"
                onClick={() => {
                  onChange(null);
                  setOpen(false);
                }}
              >
                ✕ {ar.trainee.clear}
              </button>
            )}
            {shown.map((o) => (
              <button
                key={o.id}
                type="button"
                role="option"
                aria-selected={o.id === value}
                className={`slot-option ${o.id === value ? 'slot-option-on' : ''}`}
                onClick={() => {
                  onChange(o.id);
                  setOpen(false);
                }}
              >
                {o.text}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
