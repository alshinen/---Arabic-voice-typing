import { ar } from '../../shared/i18n/ar';

export function Launcher({ onChoose }: { onChoose: (p: 'trainer' | 'trainee') => void }) {
  return (
    <main className="page-center">
      <div>
        <h1 style={{ textAlign: 'center' }}>{ar.appName}</h1>
        <p className="muted" style={{ textAlign: 'center', marginBottom: 32 }}>
          {ar.launcher.subtitle}
        </p>
        <div className="launcher">
          <button className="card" onClick={() => onChoose('trainer')}>
            <span className="card-title">{ar.launcher.trainer}</span>
            <span className="muted">{ar.launcher.trainerHint}</span>
          </button>
          <button className="card" onClick={() => onChoose('trainee')}>
            <span className="card-title">{ar.launcher.trainee}</span>
            <span className="muted">{ar.launcher.traineeHint}</span>
          </button>
        </div>
      </div>
    </main>
  );
}
