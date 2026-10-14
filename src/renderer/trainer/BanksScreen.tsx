import { useCallback, useState } from 'react';
import { ar } from '../../shared/i18n/ar';
import type { BankSummary } from '../../shared/types/api';
import type { QuestionType } from '../../shared/types/domain';
import type { Question, QuestionSummary } from '../../shared/types/question';
import { api } from '../api';
import { ErrorText, Loading, Modal, PageHeader, useFeedback } from '../components/ui';
import { useApi } from '../useApi';
import { fmt } from '../util';
import { QuestionEditor } from './QuestionEditor';
import { blankQuestion } from './questionDraft';

const TYPES: QuestionType[] = ['TF', 'MCQ', 'LIST', 'SKILL', 'HOTSPOT'];

export function BanksScreen({ onBack }: { onBack: () => void }) {
  const banks = useApi(useCallback(() => api.banks.list(), []));
  const [bank, setBank] = useState<BankSummary | null>(null);

  if (bank)
    return (
      <BankScreen
        bank={bank}
        banks={banks.data ?? []}
        onBack={() => {
          setBank(null);
          void banks.reload();
        }}
      />
    );

  return (
    <main className="page">
      <PageHeader title={ar.banks.title} onBack={onBack} />
      {banks.loading && <Loading />}
      <ErrorText error={banks.error} />
      <div className="grid">
        {banks.data?.map((b) => (
          <button key={b.id} className="card" onClick={() => setBank(b)}>
            <span className="card-title">{b.name}</span>
            <span className="muted">{b.kind === 'promotion' ? ar.banks.promotion : ar.banks.general}</span>
            <strong>{ar.banks.total(b.total)}</strong>
            <span className="counts">
              {TYPES.map((t) => (
                <span key={t} className="count">
                  {ar.questionTypes[t]}: {b.countsByType[t]}
                </span>
              ))}
            </span>
          </button>
        ))}
      </div>
    </main>
  );
}

function BankScreen({ bank, banks, onBack }: { bank: BankSummary; banks: BankSummary[]; onBack: () => void }) {
  const { confirm, toast } = useFeedback();
  const [type, setType] = useState<QuestionType | null>(null);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<{ q: Question; isNew: boolean } | null>(null);
  const [copying, setCopying] = useState<QuestionSummary | null>(null);
  const list = useApi(useCallback(() => api.questions.list({ bankId: bank.id, type, search }), [bank.id, type, search]));

  if (editing)
    return (
      <QuestionEditor
        initial={editing.q}
        isNew={editing.isNew}
        onDone={() => {
          setEditing(null);
          void list.reload();
        }}
      />
    );

  const open = async (id: string) => {
    const r = await api.questions.get(id);
    if (r.ok) setEditing({ q: r.data, isNew: false });
    else toast(r.error, 'error');
  };

  return (
    <main className="page">
      <PageHeader title={bank.name} onBack={onBack}>
        {TYPES.map((t) => (
          <button key={t} className="btn btn-primary" onClick={() => setEditing({ q: blankQuestion(t, bank.id), isNew: true })}>
            + {ar.questionTypes[t]}
          </button>
        ))}
      </PageHeader>
      <div className="row gap wrap filters">
        <div className="segmented">
          <button className={`seg ${type === null ? 'seg-on' : ''}`} onClick={() => setType(null)}>
            {ar.common.all}
          </button>
          {TYPES.map((t) => (
            <button key={t} className={`seg ${type === t ? 'seg-on' : ''}`} onClick={() => setType(t)}>
              {ar.questionTypes[t]}
            </button>
          ))}
        </div>
        <input className="input" placeholder={ar.common.search} value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      <ErrorText error={list.error} />
      {list.data?.length === 0 && <p className="card empty-state">{ar.banks.empty}</p>}
      <div className="table">
        {list.data?.map((q) => (
          <div key={q.id} className="table-row">
            <span className={`chip type-chip type-${q.type}`}>{ar.questionTypes[q.type]}</span>
            <button className="link grow" onClick={() => void open(q.id)}>
              {q.text}
            </button>
            <span className="muted nowrap">
              {fmt(q.points)} {ar.common.points} · {ar.banks.tries(q.maxTries)}
            </span>
            <span className={`chip ${q.tested ? 'chip-ok' : 'chip-warn'}`}>{q.tested ? ar.banks.tested : ar.banks.notTested}</span>
            {q.usedInExams > 0 && <span className="muted nowrap">{ar.banks.usedIn(q.usedInExams)}</span>}
            <div className="row gap-sm">
              <button className="btn btn-sm" onClick={() => void open(q.id)}>
                {ar.common.edit}
              </button>
              <button className="btn btn-sm" onClick={() => setCopying(q)}>
                {ar.common.copy}
              </button>
              <button
                className="btn btn-sm btn-danger"
                onClick={async () => {
                  if (!(await confirm(ar.common.confirmDelete))) return;
                  const r = await api.questions.archive(q.id);
                  if (r.ok) void list.reload();
                  else toast(r.error, 'error');
                }}
              >
                {ar.common.delete}
              </button>
            </div>
          </div>
        ))}
      </div>
      {copying && (
        <Modal title={ar.banks.copyTo} onClose={() => setCopying(null)}>
          <div className="stack">
            {banks.map((b) => (
              <button
                key={b.id}
                className="btn list-pick"
                onClick={async () => {
                  const r = await api.questions.copy(copying.id, b.id);
                  setCopying(null);
                  if (r.ok) {
                    toast(ar.banks.copied);
                    void list.reload();
                  } else toast(r.error, 'error');
                }}
              >
                {b.id === bank.id ? `${b.name} — ${ar.banks.copyHere}` : b.name}
              </button>
            ))}
          </div>
        </Modal>
      )}
    </main>
  );
}
