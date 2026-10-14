import { useMemo, useState } from 'react';
import { ar } from '../../shared/i18n/ar';
import type { Point } from '../../shared/hotspot/geometry';
import type { Response } from '../../shared/scoring/grade';
import type { Question } from '../../shared/types/question';
import { api, traineeApi } from '../api';
import { QuestionView } from '../components/QuestionView';
import { Modal } from '../components/ui';
import { draftToPublic } from './questionDraft';

/**
 * زر «تجربة» (design.md 2.3): يعرض السؤال بواجهة المتدرب نفسها، والمنطقة مخفية،
 * ويصحح فعليًا. لا تُسجَّل التجربة. بعدها «اعتماد» أو «رجوع للتعديل».
 */
export function QuestionTester({
  question,
  image,
  onApprove,
  onClose,
}: {
  question: Question;
  image: { width: number; height: number } | null;
  onApprove: () => void;
  onClose: () => void;
}) {
  const [round, setRound] = useState(0);
  const base = useMemo(() => draftToPublic(question, image, 0, false, null, null), [question, image, round]);
  const [tries, setTries] = useState<{ correct: boolean; selections: (string | null)[] | null }[]>([]);
  const [busy, setBusy] = useState(false);
  const [lastPoint, setLastPoint] = useState<(Point & { ok: boolean }) | null>(null);
  const [error, setError] = useState<string | null>(null);

  const last = tries[tries.length - 1];
  const done = Boolean(last?.correct) || tries.length >= question.maxTries;
  const pub = {
    ...base,
    triesUsed: tries.length,
    done,
    lastCorrect: last ? last.correct : null,
    lastSelections: last?.selections ?? null,
  };

  const submit = async (r: Response) => {
    setBusy(true);
    const res = await api.questions.gradePreview(question, r);
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setTries((t) => [...t, { correct: res.data.correct, selections: r.kind === 'SLOTS' ? r.selections : null }]);
    if (r.kind === 'POINT') setLastPoint({ x: r.x, y: r.y, ok: res.data.correct });
  };

  const multi = question.type === 'LIST' || question.type === 'SKILL';
  let message: { kind: string; text: string } | null = null;
  if (last) {
    if (last.correct) message = { kind: 'ok', text: ar.trainee.correct };
    else if (!done)
      message = {
        kind: multi ? 'partial' : 'bad',
        text: `${multi ? ar.trainee.notFullyCorrect : ar.trainee.wrong}. ${ar.trainee.tryAgain} (${ar.trainee.triesLeft(question.maxTries - tries.length)})`,
      };
    else message = { kind: 'bad', text: ar.trainee.wrong };
  }

  return (
    <Modal title={ar.editor.test} onClose={onClose} wide>
      <div className="preview-banner">{ar.editor.testBanner}</div>
      <QuestionView q={pub} imageUrl={traineeApi.imageUrl} busy={busy} onSubmit={submit} lastPoint={lastPoint} />
      {message && <div className={`feedback feedback-${message.kind}`}>{message.text}</div>}
      {error && <p className="error">{error}</p>}
      <div className="row gap end">
        <button
          className="btn"
          onClick={() => {
            setTries([]);
            setLastPoint(null);
            setRound((r) => r + 1);
          }}
        >
          ⟳ {ar.editor.test}
        </button>
        <button className="btn" onClick={onClose}>
          {ar.editor.backToEdit}
        </button>
        <button className="btn btn-primary" onClick={onApprove}>
          ✔ {ar.editor.approve}
        </button>
      </div>
    </Modal>
  );
}
