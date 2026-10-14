import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { ar } from '../../shared/i18n/ar';

/** نافذة منبثقة تُرسم داخل الصفحة (لا نوافذ نظام). */
export function Modal({
  title,
  children,
  onClose,
  wide,
}: {
  title: string;
  children: ReactNode;
  onClose?: () => void;
  wide?: boolean;
}) {
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-label={title}>
        <header className="modal-head">
          <h2>{title}</h2>
          {onClose && (
            <button className="btn btn-ghost" onClick={onClose} aria-label={ar.common.close}>
              ✕
            </button>
          )}
        </header>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

interface ConfirmState {
  message: string;
  resolve: (v: boolean) => void;
}

interface Feedback {
  confirm(message: string): Promise<boolean>;
  toast(message: string, kind?: 'ok' | 'error'): void;
}

const FeedbackContext = createContext<Feedback>({
  confirm: async () => false,
  toast: () => undefined,
});

/** تأكيد ورسائل قصيرة داخل الصفحة، بدل confirm وalert. */
export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [confirmState, setConfirm] = useState<ConfirmState | null>(null);
  const [toast, setToast] = useState<{ message: string; kind: 'ok' | 'error' } | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const value: Feedback = {
    confirm: useCallback((message: string) => new Promise<boolean>((resolve) => setConfirm({ message, resolve })), []),
    toast: useCallback((message: string, kind: 'ok' | 'error' = 'ok') => {
      setToast({ message, kind });
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setToast(null), kind === 'error' ? 6000 : 2500);
    }, []),
  };

  const answer = (v: boolean) => {
    confirmState?.resolve(v);
    setConfirm(null);
  };

  return (
    <FeedbackContext.Provider value={value}>
      {children}
      {confirmState && (
        <Modal title={ar.appName}>
          <p className="pre-line">{confirmState.message}</p>
          <div className="row gap end">
            <button className="btn btn-primary" autoFocus onClick={() => answer(true)}>
              {ar.common.yes}
            </button>
            <button className="btn" onClick={() => answer(false)}>
              {ar.common.no}
            </button>
          </div>
        </Modal>
      )}
      {toast && (
        <div className={`toast toast-${toast.kind}`} role="status">
          {toast.message}
        </div>
      )}
    </FeedbackContext.Provider>
  );
}

export const useFeedback = () => useContext(FeedbackContext);

/** شريط عنوان الصفحة مع زر الرجوع. */
export function PageHeader({ title, onBack, children }: { title: string; onBack?: () => void; children?: ReactNode }) {
  return (
    <header className="topbar">
      <div className="row gap center">
        {onBack && (
          <button className="btn" onClick={onBack}>
            → {ar.common.back}
          </button>
        )}
        <h1>{title}</h1>
      </div>
      <div className="row gap wrap">{children}</div>
    </header>
  );
}

/** أزرار اختيار سريعة مع خيار «أخرى» (للدرجة وعدد المحاولات). */
export function ChoiceButtons<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (v: T) => void;
}) {
  return (
    <div className="segmented">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          className={`seg ${value === o.value ? 'seg-on' : ''}`}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** حقل رقم عشري يقبل الأرقام العربية الهندية. */
export function NumberInput({
  value,
  onChange,
  min = 0,
  step = 0.25,
  className,
  placeholder,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  min?: number;
  step?: number;
  className?: string;
  placeholder?: string;
}) {
  const [text, setText] = useState(value === null ? '' : String(value));
  useEffect(() => {
    setText((t) => (Number(normalize(t)) === value ? t : value === null ? '' : String(value)));
  }, [value]);
  return (
    <input
      className={`input num ${className ?? ''}`}
      inputMode="decimal"
      value={text}
      placeholder={placeholder}
      onChange={(e) => {
        setText(e.target.value);
        const n = Number(normalize(e.target.value));
        if (e.target.value.trim() === '') onChange(null);
        else if (Number.isFinite(n) && n >= min) onChange(n);
      }}
      step={step}
    />
  );
}

function normalize(s: string): string {
  return s
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[٫,]/g, '.')
    .replace('½', '0.5')
    .replace('¼', '0.25');
}

export function Loading() {
  return <p className="muted">{ar.common.loading}</p>;
}

export function ErrorText({ error }: { error: string | null }) {
  return error ? <p className="error pre-line">{error}</p> : null;
}
