import { useState } from 'react';
import { ar } from '../../shared/i18n/ar';
import { BanksScreen } from './BanksScreen';

type Section = 'home' | 'banks';

const CARDS = [
  { key: 'banks', ready: true },
  { key: 'exams', ready: false },
  { key: 'courses', ready: false },
  { key: 'images', ready: false },
  { key: 'trainees', ready: false },
  { key: 'results', ready: false },
] as const;

export function TrainerHome({ onLogout }: { onLogout: () => void }) {
  const [section, setSection] = useState<Section>('home');

  if (section === 'banks') return <BanksScreen onBack={() => setSection('home')} />;

  return (
    <main className="page">
      <header className="topbar">
        <h1>{ar.home.title}</h1>
        <button className="btn" onClick={onLogout}>
          {ar.auth.logout}
        </button>
      </header>
      <div className="grid">
        {CARDS.map(({ key, ready }) => (
          <button key={key} className="card" disabled={!ready} onClick={() => key === 'banks' && setSection('banks')}>
            <span className="card-title">{ar.home.cards[key].title}</span>
            <span className="muted">{ar.home.cards[key].hint}</span>
            {!ready && <span className="badge">{ar.common.soon}</span>}
          </button>
        ))}
      </div>
    </main>
  );
}
