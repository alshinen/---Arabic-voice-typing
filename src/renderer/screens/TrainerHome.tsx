import { useState } from 'react';
import { ar } from '../../shared/i18n/ar';
import { BanksScreen } from '../trainer/BanksScreen';
import { DataScreen } from '../trainer/DataScreen';
import { ExamsScreen } from '../trainer/ExamsScreen';
import { CoursesScreen, ImagesScreen, ReadyListsScreen, TraineesScreen } from '../trainer/LibraryScreens';
import { ResultsScreen } from '../trainer/ResultsScreen';

type Section = keyof typeof ar.home.cards;

const ORDER: Section[] = ['banks', 'exams', 'results', 'trainees', 'courses', 'images', 'readyLists', 'data'];

/** لوحة المدرب (design.md 2.1 م2). */
export function TrainerHome({ onLogout }: { onLogout: () => void }) {
  const [section, setSection] = useState<Section | null>(null);
  const back = () => setSection(null);

  switch (section) {
    case 'banks':
      return <BanksScreen onBack={back} />;
    case 'exams':
      return <ExamsScreen onBack={back} />;
    case 'results':
      return <ResultsScreen onBack={back} />;
    case 'trainees':
      return <TraineesScreen onBack={back} />;
    case 'courses':
      return <CoursesScreen onBack={back} />;
    case 'images':
      return <ImagesScreen onBack={back} />;
    case 'readyLists':
      return <ReadyListsScreen onBack={back} />;
    case 'data':
      return <DataScreen onBack={back} />;
  }

  return (
    <main className="page">
      <header className="topbar">
        <h1>{ar.home.title}</h1>
        <button className="btn" onClick={onLogout}>
          {ar.auth.logout}
        </button>
      </header>
      <div className="grid">
        {ORDER.map((key) => (
          <button key={key} className={`card home-card home-${key}`} onClick={() => setSection(key)}>
            <span className="card-title">{ar.home.cards[key].title}</span>
            <span className="muted">{ar.home.cards[key].hint}</span>
          </button>
        ))}
      </div>
    </main>
  );
}
