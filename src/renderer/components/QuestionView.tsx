import { useEffect, useState } from 'react';
import { ar } from '../../shared/i18n/ar';
import type { Point } from '../../shared/hotspot/geometry';
import type { Response } from '../../shared/scoring/grade';
import type { PublicQuestion } from '../../shared/types/attempt';
import { fmt } from '../util';
import { ImageStage } from './ImageStage';
import { ClickMark, RegionShape } from './Regions';
import { SlotSelect } from './SlotSelect';

/**
 * عرض سؤال واحد كما يراه المتدرب، مشترك بين الاختبار الفعلي وتجربة المدرب.
 * لا يحتوي أي إجابة صحيحة، إلا reveal بعد انتهاء المحاولات إن سمح المدرب.
 */
export function QuestionView({
  q,
  imageUrl,
  busy,
  onSubmit,
  lastPoint,
}: {
  q: PublicQuestion;
  imageUrl: (id: string) => string;
  busy: boolean;
  onSubmit: (r: Response) => void;
  lastPoint: (Point & { ok: boolean }) | null;
}) {
  const [tf, setTf] = useState<boolean | null>(null);
  const [mcq, setMcq] = useState<string | null>(null);
  const [selections, setSelections] = useState<(string | null)[]>([]);

  useEffect(() => {
    setTf(null);
    setMcq(null);
    setSelections(q.lastSelections ?? (q.slots ?? []).map(() => null));
    // يُعاد الضبط عند الانتقال لسؤال آخر فقط، لا عند كل تحديث لبيانات السؤال نفسه.
  }, [q.aqId]);

  const locked = busy || q.done;
  const triesLeft = q.maxTries - q.triesUsed;
  const reveal = q.reveal;

  const confirmEnabled =
    !locked &&
    ((q.type === 'TF' && tf !== null) ||
      (q.type === 'MCQ' && mcq !== null) ||
      ((q.type === 'LIST' || q.type === 'SKILL') && selections.length > 0 && selections.every((s) => s !== null)));

  const submit = () => {
    if (!confirmEnabled) return;
    if (q.type === 'TF') onSubmit({ kind: 'TF', value: tf! });
    else if (q.type === 'MCQ') onSubmit({ kind: 'MCQ', optionId: mcq! });
    else onSubmit({ kind: 'SLOTS', selections });
  };

  return (
    <div className="question">
      <div className="question-head">
        <p className="question-text">{q.text}</p>
        <span className="chip">{ar.trainee.pointsLabel(fmt(q.points))}</span>
      </div>

      {q.type === 'TF' && (
        <div className="row gap">
          {[true, false].map((v) => (
            <button
              key={String(v)}
              className={`answer-btn ${tf === v ? 'answer-on' : ''} ${reveal?.type === 'TF' && reveal.correct === v ? 'answer-correct' : ''}`}
              disabled={locked}
              onClick={() => setTf(v)}
            >
              {v ? ar.editor.true : ar.editor.false}
            </button>
          ))}
        </div>
      )}

      {q.type === 'MCQ' && (
        <div className="mcq">
          {q.mcqOptions!.map((o, i) => (
            <button
              key={o.id}
              className={`answer-btn mcq-option ${mcq === o.id ? 'answer-on' : ''} ${reveal?.type === 'MCQ' && reveal.correctId === o.id ? 'answer-correct' : ''}`}
              disabled={locked}
              onClick={() => setMcq(o.id)}
            >
              <span className="mcq-letter">{'أبجدهوزحطي'[i] ?? i + 1}</span>
              {o.text}
            </button>
          ))}
        </div>
      )}

      {(q.type === 'LIST' || q.type === 'SKILL') && (
        <div className={q.type === 'SKILL' ? 'skill-items' : 'list-slots'}>
          {q.slots!.map((slot, i) => (
            <div key={i} className={q.type === 'SKILL' ? 'skill-row' : 'list-row'}>
              <span className="slot-label">{slot.label ?? `${i + 1}.`}</span>
              <SlotSelect
                options={slot.options}
                value={selections[i] ?? null}
                disabled={locked}
                onChange={(id) => setSelections((s) => s.map((v, j) => (j === i ? id : v)))}
              />
            </div>
          ))}
        </div>
      )}

      {q.type === 'HOTSPOT' && q.imageId && q.image && (
        <>
          <p className="muted">{ar.trainee.tapImage}</p>
          <ImageStage
            src={imageUrl(q.imageId)}
            natural={q.image}
            height="min(62vh, 640px)"
            cursor={locked ? 'default' : 'pointer'}
            onPointer={(kind, p) => {
              if (kind === 'down' && p && !locked) onSubmit({ kind: 'POINT', x: p.x, y: p.y });
            }}
            overlay={
              <>
                {reveal?.type === 'HOTSPOT' && reveal.regions.map((r, i) => <RegionShape key={i} r={r} className="region-reveal" />)}
                {lastPoint && <ClickMark x={lastPoint.x} y={lastPoint.y} ok={lastPoint.ok} aspect={q.image.width / q.image.height} />}
              </>
            }
          />
        </>
      )}

      {reveal?.type === 'SLOTS' && (
        <div className="reveal">
          <strong>{ar.trainee.correctAnswer}</strong>
          <ul>
            {reveal.correctTexts.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </div>
      )}

      {q.type !== 'HOTSPOT' && !q.done && (
        <div className="row gap center">
          <button className="btn btn-primary btn-lg" disabled={!confirmEnabled} onClick={submit}>
            {ar.trainee.confirm}
          </button>
          {q.maxTries > 1 && <span className="muted">{ar.trainee.triesLeft(triesLeft)}</span>}
        </div>
      )}
      {q.type === 'HOTSPOT' && !q.done && q.maxTries > 1 && <p className="muted">{ar.trainee.triesLeft(triesLeft)}</p>}
    </div>
  );
}
