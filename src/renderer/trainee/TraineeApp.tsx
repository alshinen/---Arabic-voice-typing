import { useCallback, useEffect, useState } from 'react';
import { ar } from '../../shared/i18n/ar';
import type { AttemptOutcome, AttemptState, AvailableExam, IdentityInput } from '../../shared/types/attempt';
import type { ExamType } from '../../shared/types/domain';
import type { SeatId } from '../../shared/seats';
import { traineeApi } from '../api';
import { NumberPad } from '../components/NumberPad';
import { ErrorText, Loading } from '../components/ui';
import { firstLetter, fmt } from '../util';
import { ExamRunner } from './ExamRunner';

type Step =
  | { name: 'home' }
  | { name: 'identify'; exam: AvailableExam }
  | { name: 'instructions'; exam: AvailableExam; identity: IdentityInput; who: string | null }
  | { name: 'run'; state: AttemptState }
  | { name: 'result'; outcome: AttemptOutcome; state: AttemptState };

const TYPES: ExamType[] = ['course', 'promotion', 'quick', 'surprise'];

/** منصة المتدرب: صفحة الاختبارات، ثم التعريف، ثم التعليمات، ثم الاختبار، ثم النتيجة. */
export function TraineeApp({ onExit, seat }: { onExit?: () => void; seat?: SeatId }) {
  const [step, setStep] = useState<Step>({ name: 'home' });
  const home = () => setStep({ name: 'home' });

  switch (step.name) {
    case 'home':
      return <ExamsHome onChoose={(exam) => setStep({ name: 'identify', exam })} onExit={onExit} />;
    case 'identify':
      return (
        <Identify
          exam={step.exam}
          seat={seat}
          onBack={home}
          onDone={(identity, who) => setStep({ name: 'instructions', exam: step.exam, identity, who })}
        />
      );
    case 'instructions':
      return (
        <Instructions
          exam={step.exam}
          seat={seat}
          who={step.who}
          identity={step.identity}
          onBack={home}
          onStarted={(state) => setStep({ name: 'run', state })}
        />
      );
    case 'run':
      return <ExamRunner initial={step.state} onFinished={(outcome) => setStep({ name: 'result', outcome, state: step.state })} />;
    case 'result':
      return <ResultScreen outcome={step.outcome} state={step.state} onDone={home} />;
  }
}

function ExamsHome({ onChoose, onExit }: { onChoose: (e: AvailableExam) => void; onExit?: () => void }) {
  const [exams, setExams] = useState<AvailableExam[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    const r = await traineeApi.exams();
    if (r.ok) {
      setExams(r.data);
      setError(null);
    } else setError(r.error);
  }, []);
  useEffect(() => {
    void load();
    const t = window.setInterval(() => void load(), 10_000);
    return () => window.clearInterval(t);
  }, [load]);

  return (
    <main className="page">
      <header className="topbar">
        <h1>{ar.trainee.title}</h1>
        <div className="row gap">
          <button className="btn" onClick={() => void load()}>
            ⟳ {ar.trainee.refresh}
          </button>
          {onExit && (
            <button className="btn" onClick={onExit}>
              → {ar.common.back}
            </button>
          )}
        </div>
      </header>
      <ErrorText error={error} />
      {!exams && !error && <Loading />}
      {exams?.length === 0 && (
        <section className="card empty-state">
          <p>{ar.trainee.empty}</p>
        </section>
      )}
      {TYPES.map((type) => {
        const list = exams?.filter((e) => e.examType === type) ?? [];
        if (!list.length) return null;
        return (
          <section key={type} className="section">
            <h2>{ar.examTypes[type]}</h2>
            <div className="grid">
              {list.map((e) => (
                <button key={e.id} className={`card exam-card type-${type}`} onClick={() => onChoose(e)}>
                  <span className="card-title">{e.title}</span>
                  {e.subtitle && <span className="muted">{e.subtitle}</span>}
                  <span className="muted">
                    {ar.trainee.questionsCount(e.questionCount)} · {ar.trainee.timeLimit(e.timeLimitMinutes)}
                  </span>
                </button>
              ))}
            </div>
          </section>
        );
      })}
    </main>
  );
}

function Identify({
  exam,
  seat,
  onBack,
  onDone,
}: {
  exam: AvailableExam;
  seat?: SeatId;
  onBack: () => void;
  onDone: (identity: IdentityInput, who: string | null) => void;
}) {
  const [names, setNames] = useState<{ id: string; name: string }[] | null>(null);
  const [letter, setLetter] = useState<string | null>(null);
  const [number, setNumber] = useState('');
  const [name, setName] = useState('');
  const [found, setFound] = useState<{ traineeId: string; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (exam.identifyMode !== 'pick_list') return;
    void traineeApi.pickList(exam.id).then((r) => (r.ok ? setNames(r.data) : setError(r.error)));
  }, [exam]);

  const lookup = async () => {
    setError(null);
    const r = await traineeApi.lookup(number);
    if (r.ok) setFound(r.data);
    else setError(r.error);
  };

  const letters = names ? [...new Set(names.map((n) => firstLetter(n.name)))].sort((a, b) => a.localeCompare(b, 'ar')) : [];
  const shown = names?.filter((n) => !letter || firstLetter(n.name) === letter) ?? [];

  return (
    <main className="page">
      <header className="topbar">
        <div>
          <h1>{ar.trainee.whoAreYou}</h1>
          <span className="muted">{exam.title}</span>
        </div>
        <button className="btn" onClick={onBack}>
          → {ar.common.back}
        </button>
      </header>
      <section className="card identify">
        {exam.identifyMode === 'pick_list' &&
          (names ? (
            <>
              <p>{ar.trainee.chooseName}</p>
              {letters.length > 6 && (
                <div className="letters">
                  <button className={`letter ${letter === null ? 'letter-on' : ''}`} onClick={() => setLetter(null)}>
                    {ar.common.all}
                  </button>
                  {letters.map((l) => (
                    <button key={l} className={`letter ${letter === l ? 'letter-on' : ''}`} onClick={() => setLetter(l)}>
                      {l}
                    </button>
                  ))}
                </div>
              )}
              <div className="names">
                {shown.map((n) => (
                  <button key={n.id} className="name-btn" onClick={() => onDone({ traineeId: n.id }, n.name)}>
                    {n.name}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <Loading />
          ))}

        {exam.identifyMode === 'number_lookup' &&
          (found ? (
            <div className="center-col">
              <p className="big">{ar.trainee.areYou(found.name)}</p>
              <div className="row gap">
                <button className="btn btn-primary btn-lg" onClick={() => onDone({ number }, found.name)}>
                  {ar.trainee.yesStart}
                </button>
                <button
                  className="btn btn-lg"
                  onClick={() => {
                    setFound(null);
                    setNumber('');
                  }}
                >
                  {ar.trainee.notMe}
                </button>
              </div>
            </div>
          ) : (
            <div className="center-col">
              <p>{ar.trainee.enterNumber}</p>
              <NumberPad value={number} onChange={setNumber} />
              <button className="btn btn-primary btn-lg" disabled={!number} onClick={() => void lookup()}>
                {ar.trainee.next}
              </button>
            </div>
          ))}

        {seat && (exam.identifyMode === 'number_and_name' || exam.identifyMode === 'name') && (
          <p className="warn">{ar.seats.modeNotInSeats}</p>
        )}
        {!seat && (exam.identifyMode === 'number_and_name' || exam.identifyMode === 'name') && (
          <div className="center-col">
            {exam.identifyMode === 'number_and_name' && (
              <>
                <p>{ar.trainee.enterNumber}</p>
                <NumberPad value={number} onChange={setNumber} />
              </>
            )}
            <label className="field wide">
              {ar.trainee.enterName}
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <button
              className="btn btn-primary btn-lg"
              disabled={!name.trim() || (exam.identifyMode === 'number_and_name' && !number)}
              onClick={() => onDone({ name, number: number || null }, name.trim())}
            >
              {ar.trainee.next}
            </button>
          </div>
        )}
        <ErrorText error={error} />
      </section>
    </main>
  );
}

function Instructions({
  exam,
  seat,
  who,
  identity,
  onBack,
  onStarted,
}: {
  exam: AvailableExam;
  seat?: SeatId;
  who: string | null;
  identity: IdentityInput;
  onBack: () => void;
  onStarted: (s: AttemptState) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const start = async () => {
    setBusy(true);
    const r = await traineeApi.start(exam.id, identity, seat);
    setBusy(false);
    if (r.ok) onStarted(r.data);
    else setError(r.error);
  };
  return (
    <main className="page-center">
      <section className="card instructions">
        <h1>{exam.title}</h1>
        {who && <p className="big">{who}</p>}
        <h2>{ar.trainee.instructions}</h2>
        <ul>
          <li>{ar.trainee.questionsCount(exam.questionCount)}</li>
          <li>{ar.trainee.totalPoints(fmt(exam.totalPoints))}</li>
          <li>{ar.trainee.timeLimit(exam.timeLimitMinutes)}</li>
        </ul>
        <ErrorText error={error} />
        <div className="row gap">
          <button className="btn btn-primary btn-lg" disabled={busy} onClick={() => void start()}>
            {ar.trainee.start}
          </button>
          <button className="btn btn-lg" onClick={onBack}>
            {ar.common.back}
          </button>
        </div>
      </section>
    </main>
  );
}

export function ResultScreen({ outcome, state, onDone, doneLabel }: { outcome: AttemptOutcome; state: AttemptState; onDone: () => void; doneLabel?: string }) {
  return (
    <main className="page-center">
      <section className="card result">
        <h1>{ar.result.title}</h1>
        <p className="muted">{state.examTitle}</p>
        {state.traineeName && <p className="big">{state.traineeName}</p>}
        <p className="score">{ar.result.score(fmt(outcome.earned), fmt(outcome.total))}</p>
        <p className="percent">{fmt(outcome.percent)}٪</p>
        {outcome.passed !== null && (
          <p className={`verdict ${outcome.passed ? 'verdict-pass' : 'verdict-fail'}`}>
            {outcome.passed ? ar.result.passed : ar.result.failed}
          </p>
        )}
        <p className="muted">{outcome.passLabel}</p>
        {outcome.status === 'timed_out' && <p className="muted">{ar.result.timedOut}</p>}
        <button className="btn btn-primary btn-lg" onClick={onDone}>
          {doneLabel ?? ar.result.handOver}
        </button>
      </section>
    </main>
  );
}
