import { useCallback, useState } from 'react';
import { ar } from '../../shared/i18n/ar';
import type { ResultDetail, ResultFilter } from '../../shared/types/api';
import type { ExamType } from '../../shared/types/domain';
import type { Question, Region } from '../../shared/types/question';
import { api, traineeApi } from '../api';
import { ImageStage } from '../components/ImageStage';
import { ClickMark, RegionShape } from '../components/Regions';
import { ErrorText, Loading, PageHeader, useFeedback } from '../components/ui';
import { useApi } from '../useApi';
import { fmt, formatDate } from '../util';

const TYPES: ExamType[] = ['course', 'promotion', 'quick', 'surprise'];

export function ResultsScreen({ onBack }: { onBack: () => void }) {
  const { toast } = useFeedback();
  const [filter, setFilter] = useState<ResultFilter>({});
  const rows = useApi(useCallback(() => api.results.list(filter), [filter]));
  const exams = useApi(useCallback(() => api.exams.list(), []));
  const [detail, setDetail] = useState<ResultDetail | null>(null);

  if (detail) return <ResultDetailView detail={detail} onBack={() => setDetail(null)} />;

  return (
    <main className="page">
      <PageHeader title={ar.results.title} onBack={onBack}>
        <button
          className="btn btn-primary"
          onClick={async () => {
            const r = await api.results.exportCsv(filter);
            if (r.ok && r.data) toast(ar.results.exported);
            else if (!r.ok) toast(r.error, 'error');
          }}
        >
          {ar.results.exportCsv}
        </button>
      </PageHeader>
      <div className="row gap wrap filters">
        <div className="segmented">
          <button className={`seg ${!filter.examType ? 'seg-on' : ''}`} onClick={() => setFilter({ ...filter, examType: null, examId: null })}>
            {ar.common.all}
          </button>
          {TYPES.map((t) => (
            <button key={t} className={`seg ${filter.examType === t ? 'seg-on' : ''}`} onClick={() => setFilter({ examType: t, examId: null })}>
              {ar.examTypes[t]}
            </button>
          ))}
        </div>
        <select className="input" value={filter.examId ?? ''} onChange={(e) => setFilter({ ...filter, examId: e.target.value || null })}>
          <option value="">{ar.results.filterExam}: {ar.common.all}</option>
          {exams.data
            ?.filter((e) => !filter.examType || e.examType === filter.examType)
            .map((e) => (
              <option key={e.id} value={e.id}>
                {e.title}
              </option>
            ))}
        </select>
      </div>
      {rows.loading && <Loading />}
      <ErrorText error={rows.error} />
      {rows.data?.length === 0 && <p className="card empty-state">{ar.results.empty}</p>}
      <div className="table">
        {rows.data?.map((r) => (
          <button
            key={r.attemptId}
            className="table-row clickable"
            onClick={async () => {
              const d = await api.results.detail(r.attemptId);
              if (d.ok) setDetail(d.data);
              else toast(d.error, 'error');
            }}
          >
            <span className="grow">
              <strong>{r.traineeName}</strong> {r.traineeNumber && <span className="muted">({r.traineeNumber})</span>}
              <br />
              <span className="muted">
                {r.examTitle} · {ar.examTypes[r.examType]}
              </span>
            </span>
            <span className="muted nowrap">{formatDate(r.startedAt)}</span>
            <span className="nowrap">
              {r.score === null ? '—' : `${fmt(r.score)} / ${fmt(r.maxScore)}`} {r.percent !== null && <span className="muted">({fmt(r.percent)}٪)</span>}
            </span>
            {r.passed !== null && <span className={`chip ${r.passed ? 'chip-ok' : 'chip-bad'}`}>{r.passed ? ar.results.passed : ar.results.failed}</span>}
            <span className="chip">{ar.results.status[r.status]}</span>
          </button>
        ))}
      </div>
    </main>
  );
}

function describeResponse(q: Question, response: unknown): string {
  const r = response as { kind: string; value?: boolean; optionId?: string; selections?: (string | null)[]; x?: number; y?: number };
  const text = (id: string | null | undefined, opts: { id: string; text: string }[]) => opts.find((o) => o.id === id)?.text ?? ar.common.none;
  switch (q.type) {
    case 'TF':
      return r.value ? ar.editor.true : ar.editor.false;
    case 'MCQ':
      return text(r.optionId, q.data.options);
    case 'LIST':
      return (r.selections ?? [])
        .map((id, i) => text(id, q.data.shared ? q.data.options : q.data.slots[i]?.options ?? []))
        .join('، ');
    case 'SKILL':
      return (r.selections ?? []).map((id, i) => `${q.data.items[i]?.label}: ${text(id, q.data.options)}`).join('، ');
    case 'HOTSPOT':
      return `${ar.results.clickAt} (${fmt((r.x ?? 0) * 100)}٪، ${fmt((r.y ?? 0) * 100)}٪)`;
  }
}

function correctText(q: Question): string {
  const t = (id: string | null, opts: { id: string; text: string }[]) => opts.find((o) => o.id === id)?.text ?? '';
  switch (q.type) {
    case 'TF':
      return q.data.correct ? ar.editor.true : ar.editor.false;
    case 'MCQ':
      return t(q.data.correctId, q.data.options);
    case 'LIST':
      return q.data.ordered
        ? q.data.slots.map((s) => t(s.correctId, q.data.shared ? q.data.options : s.options)).join('، ')
        : q.data.correctIds.map((id) => t(id, q.data.options)).join('، ');
    case 'SKILL':
      return q.data.items.map((it) => `${it.label}: ${t(it.correctId, q.data.options)}`).join('، ');
    case 'HOTSPOT':
      return '';
  }
}

function ResultDetailView({ detail, onBack }: { detail: ResultDetail; onBack: () => void }) {
  const { toast } = useFeedback();
  return (
    <main className="page printable">
      <PageHeader title={`${detail.traineeName} — ${detail.examTitle}`} onBack={onBack}>
        <button className="btn no-print" onClick={() => window.print()}>
          {ar.results.print}
        </button>
        <button
          className="btn no-print"
          onClick={async () => {
            const r = await api.results.grantExtra(detail.attemptId);
            toast(r.ok ? ar.results.granted : r.error, r.ok ? 'ok' : 'error');
          }}
        >
          {ar.results.grantExtra}
        </button>
      </PageHeader>
      <section className="card row gap wrap center">
        <span>{formatDate(detail.startedAt)}</span>
        <strong className="score-sm">
          {fmt(detail.score)} / {fmt(detail.maxScore)}
        </strong>
        {detail.percent !== null && <span>{fmt(detail.percent)}٪</span>}
        {detail.passed !== null && (
          <span className={`chip ${detail.passed ? 'chip-ok' : 'chip-bad'}`}>{detail.passed ? ar.results.passed : ar.results.failed}</span>
        )}
        <span className="chip">{ar.results.status[detail.status]}</span>
      </section>
      <div className="stack">
        {detail.questions.map((item) => {
          const q = item.question;
          const clicks = item.tries
            .map((t) => ({ r: t.response as { x?: number; y?: number }, ok: t.correct }))
            .filter((c) => c.r?.x !== undefined);
          return (
            <section key={item.position} className="card stack-sm avoid-break">
              <div className="row gap center between">
                <span>
                  <span className="chip">{item.position + 1}</span> <span className={`chip type-chip type-${q.type}`}>{ar.questionTypes[q.type]}</span>
                </span>
                <strong>
                  {ar.results.earned}: {fmt(item.earned ?? 0)} / {fmt(item.points)}
                </strong>
              </div>
              <p className="question-text">{q.text}</p>
              {item.tries.length === 0 && <p className="muted">{ar.results.noAnswer}</p>}
              {item.tries.map((t) => (
                <p key={t.tryNumber} className={t.correct ? 'ok-text' : 'bad-text'}>
                  {t.correct ? '✔' : '✘'} {ar.results.tryN(t.tryNumber)}: {describeResponse(q, t.response)}
                </p>
              ))}
              {q.type !== 'HOTSPOT' && (
                <p className="muted">
                  {ar.trainee.correctAnswer} {correctText(q)}
                </p>
              )}
              {q.type === 'HOTSPOT' && q.imageId && (
                <HotspotReview imageId={q.imageId} regions={q.data.regions} clicks={clicks.map((c) => ({ x: c.r.x!, y: c.r.y!, ok: c.ok }))} />
              )}
            </section>
          );
        })}
      </div>
    </main>
  );
}

function HotspotReview({ imageId, regions, clicks }: { imageId: string; regions: Region[]; clicks: { x: number; y: number; ok: boolean }[] }) {
  const images = useApi(useCallback(() => api.images.list(), []));
  const img = images.data?.find((i) => i.id === imageId);
  if (!img) return null;
  return (
    <ImageStage
      src={traineeApi.imageUrl(imageId)}
      natural={img}
      height={320}
      overlay={
        <>
          {regions.map((r, i) => (
            <RegionShape key={i} r={r} className="region-reveal" />
          ))}
          {clicks.map((c, i) => (
            <ClickMark key={i} x={c.x} y={c.y} ok={c.ok} aspect={img.width / img.height} />
          ))}
        </>
      }
    />
  );
}
