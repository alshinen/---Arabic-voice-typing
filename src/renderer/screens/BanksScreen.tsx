import { useCallback } from 'react';
import { ar } from '../../shared/i18n/ar';
import type { QuestionType } from '../../shared/types/domain';
import { useApi } from '../useApi';

const TYPES: QuestionType[] = ['TF', 'MCQ', 'LIST', 'SKILL', 'HOTSPOT'];

export function BanksScreen({ onBack }: { onBack: () => void }) {
  const banks = useApi(useCallback(() => window.api.banks.list(), []));

  return (
    <main className="page">
      <header className="topbar">
        <h1>{ar.banks.title}</h1>
        <button className="btn" onClick={onBack}>
          {ar.common.back}
        </button>
      </header>
      {banks.loading && <p>{ar.common.loading}</p>}
      {banks.error && <p className="error">{banks.error}</p>}
      <div className="grid">
        {banks.data?.map((bank) => (
          <section key={bank.id} className="card">
            <div className="card-title">{bank.name}</div>
            <div className="muted">{bank.kind === 'promotion' ? ar.banks.promotion : ar.banks.general}</div>
            <p>{ar.banks.total(bank.total)}</p>
            <div className="counts">
              {TYPES.map((t) => (
                <span key={t} className="count">
                  {ar.questionTypes[t]}: {bank.countsByType[t]}
                </span>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
