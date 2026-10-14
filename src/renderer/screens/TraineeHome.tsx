import { ar } from '../../shared/i18n/ar';

/** صفحة الاختبارات للمتدرب. تُستكمل في المرحلة 6. */
export function TraineeHome({ onExit }: { onExit: () => void }) {
  return (
    <main className="page">
      <header className="topbar">
        <h1>{ar.trainee.title}</h1>
        <button className="btn" onClick={onExit}>
          {ar.common.back}
        </button>
      </header>
      <section className="card">
        <p className="muted">{ar.trainee.empty}</p>
      </section>
    </main>
  );
}
