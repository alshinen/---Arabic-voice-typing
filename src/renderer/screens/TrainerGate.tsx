import { useCallback, useState, type FormEvent } from 'react';
import { ar } from '../../shared/i18n/ar';
import { useApi } from '../useApi';
import { TrainerHome } from './TrainerHome';

/** بوابة منصة المدرب: إنشاء كلمة المرور أول مرة، ثم الدخول. */
export function TrainerGate({ onExit }: { onExit: () => void }) {
  const status = useApi(useCallback(() => window.api.auth.status(), []));

  if (status.loading) return <main className="page-center">{ar.common.loading}</main>;
  if (status.error || !status.data) return <main className="page-center error">{status.error ?? ar.common.error}</main>;
  if (status.data.loggedIn) {
    return (
      <TrainerHome
        onLogout={async () => {
          await window.api.auth.logout();
          onExit();
        }}
      />
    );
  }
  return (
    <PasswordForm
      mode={status.data.hasPassword ? 'login' : 'setup'}
      onDone={() => void status.reload()}
      onBack={onExit}
    />
  );
}

function PasswordForm({ mode, onDone, onBack }: { mode: 'login' | 'setup'; onDone: () => void; onBack: () => void }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (mode === 'setup' && password !== confirm) {
      setError(ar.auth.mismatch);
      return;
    }
    const res = mode === 'setup' ? await window.api.auth.setup(password) : await window.api.auth.login(password);
    if (res.ok) onDone();
    else setError(res.error);
  };

  return (
    <main className="page-center">
      <form className="card form" onSubmit={submit}>
        <h1>{mode === 'setup' ? ar.auth.setupTitle : ar.auth.loginTitle}</h1>
        {mode === 'setup' && <p className="muted">{ar.auth.setupHint}</p>}
        <label className="field">
          {ar.auth.password}
          <input type="password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {mode === 'setup' && (
          <label className="field">
            {ar.auth.confirm}
            <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </label>
        )}
        <div className="error" role="alert">
          {error}
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn btn-primary" type="submit">
            {mode === 'setup' ? ar.auth.save : ar.auth.login}
          </button>
          <button className="btn" type="button" onClick={onBack}>
            {ar.common.back}
          </button>
        </div>
      </form>
    </main>
  );
}
