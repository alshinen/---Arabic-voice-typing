import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ar } from '../../shared/i18n/ar';
import type { Point } from '../../shared/hotspot/geometry';
import type { Response } from '../../shared/scoring/grade';
import type { AttemptOutcome, AttemptState, PublicQuestion } from '../../shared/types/attempt';
import { traineeApi } from '../api';
import { QuestionView } from '../components/QuestionView';
import { useFeedback } from '../components/ui';
import { formatSeconds } from '../util';

type Feedback = { kind: 'ok' | 'bad' | 'partial' | 'info'; text: string } | null;

/**
 * تشغيل الاختبار (design.md 3.3): سؤال واحد في كل مرة، للأمام فقط بعد التأكيد،
 * مع التأجيل والمحاولات والوقت. كل إجابة تُحفظ فورًا في جهاز المدرب.
 */
export function ExamRunner({
  initial,
  onFinished,
  onExitPreview,
}: {
  initial: AttemptState;
  onFinished: (o: AttemptOutcome) => void;
  onExitPreview?: () => void;
}) {
  const { confirm } = useFeedback();
  const [state, setState] = useState(initial);
  const [order, setOrder] = useState<string[]>(() => initial.questions.map((q) => q.aqId));
  const [currentId, setCurrentId] = useState<string | null>(() => initial.questions.find((q) => !q.done)?.aqId ?? null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [lastPoint, setLastPoint] = useState<(Point & { ok: boolean }) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(initial.secondsLeft);
  const finishing = useRef(false);

  const byId = useMemo(() => new Map(state.questions.map((q) => [q.aqId, q])), [state.questions]);
  const current = currentId ? byId.get(currentId) ?? null : null;
  const doneCount = state.questions.filter((q) => q.done).length;
  const total = state.questions.length;

  const finish = useCallback(async () => {
    if (finishing.current) return;
    finishing.current = true;
    const r = await traineeApi.finish(state.attemptId);
    if (r.ok) onFinished(r.data);
    else {
      finishing.current = false;
      setError(r.error);
    }
  }, [onFinished, state.attemptId]);

  // المؤقت المستقل لكل متدرب. عند انتهاء الوقت يُسلَّم الاختبار تلقائيًا.
  useEffect(() => {
    if (secondsLeft === null) return;
    if (secondsLeft <= 0) {
      void finish();
      return;
    }
    const t = window.setTimeout(() => setSecondsLeft((s) => (s === null ? s : s - 1)), 1000);
    return () => window.clearTimeout(t);
  }, [secondsLeft, finish]);

  const replace = (q: PublicQuestion) =>
    setState((s) => ({ ...s, questions: s.questions.map((x) => (x.aqId === q.aqId ? q : x)) }));

  const nextUndone = (after: string | null, ord = order): string | null => {
    const start = after ? ord.indexOf(after) + 1 : 0;
    const rotated = [...ord.slice(start), ...ord.slice(0, start)];
    return rotated.find((id) => id !== after && !byId.get(id)?.done) ?? null;
  };

  const goNext = () => {
    setFeedback(null);
    setLastPoint(null);
    setCurrentId(nextUndone(currentId));
  };

  const submit = async (response: Response) => {
    if (!current || busy) return;
    setBusy(true);
    setError(null);
    const r = await traineeApi.submitTry(state.attemptId, current.aqId, response);
    setBusy(false);
    if (!r.ok) {
      setError(r.error);
      if (r.error === ar.trainee.timeUp) void finish();
      return;
    }
    const { correct, done, triesLeft, question } = r.data;
    replace(question);
    if (response.kind === 'POINT') setLastPoint({ x: response.x, y: response.y, ok: correct });
    if (correct) {
      setFeedback({ kind: 'ok', text: ar.trainee.correct });
      // في سؤال الصورة: تأكيد ثم انتقال تلقائي (design.md 4.7).
      if (current.type === 'HOTSPOT') window.setTimeout(() => goNextFrom(current.aqId), 1300);
    } else if (!done) {
      const multi = current.type === 'LIST' || current.type === 'SKILL';
      setFeedback({
        kind: multi ? 'partial' : 'bad',
        text: `${multi ? ar.trainee.notFullyCorrect : ar.trainee.wrong}. ${ar.trainee.tryAgain} (${ar.trainee.triesLeft(triesLeft)})`,
      });
    } else {
      setFeedback({ kind: 'bad', text: ar.trainee.wrong });
    }
  };

  const goNextFrom = (aqId: string) => {
    setCurrentId((cur) => (cur === aqId ? nextAfter(aqId) : cur));
    setFeedback(null);
    setLastPoint(null);
  };
  const nextAfter = (aqId: string) => {
    const start = order.indexOf(aqId) + 1;
    const rotated = [...order.slice(start), ...order.slice(0, start)];
    return rotated.find((id) => id !== aqId && !stateRef.current.questions.find((q) => q.aqId === id)?.done) ?? null;
  };
  const stateRef = useRef(state);
  stateRef.current = state;

  const defer = () => {
    if (!current) return;
    const newOrder = [...order.filter((id) => id !== current.aqId), current.aqId];
    setOrder(newOrder);
    setFeedback(null);
    setCurrentId(nextUndone(current.aqId, newOrder) ?? current.aqId);
  };

  const acceptBest = async () => {
    if (!current) return;
    setBusy(true);
    const r = await traineeApi.acceptBest(state.attemptId, current.aqId);
    setBusy(false);
    if (r.ok) {
      replace(r.data);
      goNextFrom(current.aqId);
    } else setError(r.error);
  };

  const askFinish = async () => {
    const remaining = total - doneCount;
    const msg = remaining ? `${ar.trainee.finishConfirm}\n${ar.trainee.unanswered(remaining)}` : ar.trainee.finishConfirm;
    if (await confirm(msg)) void finish();
  };

  const position = current ? state.questions.findIndex((q) => q.aqId === current.aqId) + 1 : total;
  const multi = current && (current.type === 'LIST' || current.type === 'SKILL');

  return (
    <main className="runner">
      {state.preview && (
        <div className="preview-banner">
          {ar.trainee.previewBanner}
          {onExitPreview && (
            <button className="btn btn-sm" onClick={onExitPreview}>
              {ar.trainee.exitPreview}
            </button>
          )}
        </div>
      )}
      <header className="runner-head">
        <div>
          <h1>{state.examTitle}</h1>
          {state.traineeName && <span className="muted">{state.traineeName}</span>}
        </div>
        <div className="row gap center">
          {secondsLeft !== null && (
            <span className={`timer ${secondsLeft < 60 ? 'timer-low' : ''}`} aria-label={ar.trainee.timeLeft}>
              ⏱ {formatSeconds(Math.max(0, secondsLeft))}
            </span>
          )}
          <button className="btn" onClick={askFinish}>
            {ar.trainee.finish}
          </button>
        </div>
      </header>
      <div className="progress" aria-hidden>
        <div className="progress-bar" style={{ width: `${(doneCount / Math.max(1, total)) * 100}%` }} />
      </div>
      <div className="dots">
        {order.map((id) => {
          const q = byId.get(id)!;
          return <span key={id} className={`dot ${q.done ? 'dot-done' : ''} ${id === currentId ? 'dot-current' : ''}`} />;
        })}
      </div>

      <section className="card runner-card">
        {current ? (
          <>
            <p className="muted">{ar.trainee.progress(position, total)}</p>
            <QuestionView q={current} imageUrl={traineeApi.imageUrl} busy={busy} onSubmit={submit} lastPoint={lastPoint} />
            {feedback && <div className={`feedback feedback-${feedback.kind}`}>{feedback.text}</div>}
            {error && <p className="error">{error}</p>}
            <div className="row gap end">
              {!current.done && current.triesUsed === 0 && (
                <button className="btn" onClick={defer} disabled={busy || doneCount === total - 1}>
                  {ar.trainee.defer}
                </button>
              )}
              {multi && !current.done && current.triesUsed > 0 && (
                <button className="btn" onClick={acceptBest} disabled={busy}>
                  {ar.trainee.acceptBest}
                </button>
              )}
              {current.done && (
                <button className="btn btn-primary btn-lg" onClick={goNext}>
                  {nextUndone(current.aqId) ? ar.trainee.nextQuestion : ar.trainee.finish}
                </button>
              )}
            </div>
          </>
        ) : (
          <div className="center-col">
            <p>{ar.trainee.finishConfirm}</p>
            <button className="btn btn-primary btn-lg" onClick={() => void finish()}>
              {ar.trainee.finish}
            </button>
            {error && <p className="error">{error}</p>}
          </div>
        )}
      </section>
    </main>
  );
}
