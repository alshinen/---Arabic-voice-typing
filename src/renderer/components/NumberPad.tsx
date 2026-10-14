import { ar } from '../../shared/i18n/ar';

/** لوحة أرقام على الشاشة تُضغط بالماوس (invariant 5). */
export function NumberPad({ value, onChange, max = 12 }: { value: string; onChange: (v: string) => void; max?: number }) {
  const press = (d: string) => value.length < max && onChange(value + d);
  return (
    <div className="numpad">
      <div className="numpad-display" aria-live="polite">
        {value || '—'}
      </div>
      <div className="numpad-grid">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button key={d} type="button" className="numpad-key" onClick={() => press(d)}>
            {d}
          </button>
        ))}
        <button type="button" className="numpad-key" onClick={() => onChange('')}>
          {ar.trainee.clear}
        </button>
        <button type="button" className="numpad-key" onClick={() => press('0')}>
          0
        </button>
        <button type="button" className="numpad-key" onClick={() => onChange(value.slice(0, -1))} aria-label={ar.common.delete}>
          ⌫
        </button>
      </div>
    </div>
  );
}
