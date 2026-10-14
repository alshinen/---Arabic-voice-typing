import { useCallback, useState } from 'react';
import { ar } from '../../shared/i18n/ar';
import { api } from '../api';
import { ErrorText, NumberInput, PageHeader, useFeedback } from '../components/ui';
import { useApi } from '../useApi';

/** البيانات والشبكة: مكان الحفظ (الفلاش)، والنسخ الاحتياطي، ونقل النتائج، والشبكة المحلية، وكلمة المرور. */
export function DataScreen({ onBack }: { onBack: () => void }) {
  const { confirm, toast } = useFeedback();
  const info = useApi(useCallback(() => api.data.info(), []));
  const lan = useApi(useCallback(() => api.lan.status(), []));
  const [port, setPort] = useState<number | null>(8080);
  const [pw, setPw] = useState({ old: '', next: '' });

  const report = <T,>(r: { ok: true; data: T } | { ok: false; error: string }, ok?: (d: T) => string | null) => {
    if (!r.ok) toast(r.error, 'error');
    else {
      const msg = ok?.(r.data);
      if (msg) toast(msg);
    }
  };

  return (
    <main className="page">
      <PageHeader title={ar.data.title} onBack={onBack} />
      <ErrorText error={info.error} />

      <section className="card stack-sm">
        <h2>{ar.data.location}</h2>
        {info.data && (
          <>
            <p>{info.data.portable ? ar.data.portableYes : ar.data.portableNo}</p>
            <code className="path">{info.data.dataDir}</code>
            <div className="row gap">
              <button className="btn" onClick={() => void api.data.openFolder()}>
                {ar.data.openFolder}
              </button>
            </div>
            <span className="muted">{ar.data.version(info.data.version)}</span>
          </>
        )}
      </section>

      <section className="card stack-sm">
        <h2>{ar.data.backupTitle}</h2>
        <div className="row gap wrap">
          <button className="btn btn-primary" onClick={async () => report(await api.data.backup(), (p) => (p ? ar.results.exported : null))}>
            {ar.data.backup}
          </button>
          <button
            className="btn"
            onClick={async () => {
              if (await confirm(ar.data.restoreConfirm)) report(await api.data.restore());
            }}
          >
            {ar.data.restore}
          </button>
        </div>
      </section>

      <section className="card stack-sm">
        <h2>{ar.data.transferTitle}</h2>
        <p className="muted">{ar.data.transferHint}</p>
        <div className="row gap wrap">
          <button className="btn" onClick={async () => report(await api.data.exportResults(), (p) => (p ? ar.results.exported : null))}>
            {ar.data.exportResults}
          </button>
          <button
            className="btn"
            onClick={async () => report(await api.data.importResults(), (d) => (d ? ar.data.importedResults(d.added, d.duplicates, d.skipped) : null))}
          >
            {ar.data.importResults}
          </button>
        </div>
      </section>

      <section className="card stack-sm">
        <h2>{ar.data.lanTitle}</h2>
        <p className="muted">{ar.data.lanHint}</p>
        {lan.data && (
          <>
            <p>
              <span className={`chip ${lan.data.running ? 'chip-ok' : ''}`}>{lan.data.running ? ar.data.lanRunning : ar.data.lanStopped}</span>
            </p>
            {lan.data.running ? (
              <>
                {lan.data.urls.length === 0 && <p className="warn">{ar.data.noNetwork}</p>}
                {lan.data.urls.map((u) => (
                  <code key={u} className="path big">
                    {u}
                  </code>
                ))}
                <button
                  className="btn"
                  onClick={async () => {
                    report(await api.lan.stop());
                    void lan.reload();
                  }}
                >
                  {ar.data.lanStop}
                </button>
              </>
            ) : (
              <div className="row gap center">
                <label className="field">
                  {ar.data.port}
                  <NumberInput value={port} step={1} onChange={setPort} className="w-sm" />
                </label>
                <button
                  className="btn btn-primary"
                  onClick={async () => {
                    report(await api.lan.start(port ?? 8080));
                    void lan.reload();
                  }}
                >
                  {ar.data.lanStart}
                </button>
              </div>
            )}
            <p className="muted">{ar.data.firewall}</p>
          </>
        )}
      </section>

      <section className="card stack-sm">
        <h2>{ar.auth.changeTitle}</h2>
        <div className="row gap wrap end-items">
          <label className="field">
            {ar.auth.current}
            <input className="input" type="password" value={pw.old} onChange={(e) => setPw({ ...pw, old: e.target.value })} />
          </label>
          <label className="field">
            {ar.auth.newPassword}
            <input className="input" type="password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} />
          </label>
          <button
            className="btn"
            onClick={async () => {
              const r = await api.auth.change(pw.old, pw.next);
              report(r, () => ar.auth.changed);
              if (r.ok) setPw({ old: '', next: '' });
            }}
          >
            {ar.common.save}
          </button>
        </div>
      </section>
    </main>
  );
}
