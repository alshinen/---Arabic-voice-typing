import { useCallback, useEffect, useMemo, useState } from 'react';
import { ar } from '../../shared/i18n/ar';
import type { AttemptOutcome, AttemptState } from '../../shared/types/attempt';
import type { Course } from '../../shared/types/api';
import type { ExamType, QuestionType } from '../../shared/types/domain';
import {
  defaultQuestionMode,
  defaultSettings,
  type ExamInput,
  type ExamSummary,
} from '../../shared/types/exam';
import type { QuestionSummary } from '../../shared/types/question';
import { api } from '../api';
import { ChoiceButtons, ErrorText, Loading, NumberInput, PageHeader, useFeedback } from '../components/ui';
import { ExamRunner } from '../trainee/ExamRunner';
import { ResultScreen } from '../trainee/TraineeApp';
import { useApi } from '../useApi';
import { fmt, newId } from '../util';

const TYPES: ExamType[] = ['course', 'promotion', 'quick', 'surprise'];
const QTYPES: QuestionType[] = ['TF', 'MCQ', 'LIST', 'SKILL', 'HOTSPOT'];
const GRADES = ['grade-4to3', 'grade-3to2', 'grade-2to1'].map((id) => ({ id, label: ar.examEditor.grades[id]! }));

export function ExamsScreen({ onBack }: { onBack: () => void }) {
  const { confirm, toast } = useFeedback();
  const exams = useApi(useCallback(() => api.exams.list(), []));
  const [editing, setEditing] = useState<{ exam: ExamInput; isNew: boolean } | null>(null);
  const [preview, setPreview] = useState<AttemptState | null>(null);
  const [previewOutcome, setPreviewOutcome] = useState<AttemptOutcome | null>(null);

  if (editing)
    return (
      <ExamEditor
        initial={editing.exam}
        isNew={editing.isNew}
        onDone={() => {
          setEditing(null);
          void exams.reload();
        }}
      />
    );

  const endPreview = async () => {
    if (preview) await api.exams.previewDiscard(preview.attemptId);
    setPreview(null);
    setPreviewOutcome(null);
  };
  if (preview && previewOutcome)
    return <ResultScreen outcome={previewOutcome} state={preview} onDone={() => void endPreview()} doneLabel={ar.trainee.exitPreview} />;
  if (preview) return <ExamRunner initial={preview} onFinished={setPreviewOutcome} onExitPreview={() => void endPreview()} />;

  const act = async (p: Promise<{ ok: boolean; error?: string }>) => {
    const r = await p;
    if (!r.ok) toast((r as { error: string }).error, 'error');
    void exams.reload();
  };

  const newExam = (type: ExamType): ExamInput => ({
    id: newId(),
    title: '',
    examType: type,
    courseId: null,
    gradeId: type === 'promotion' ? 'grade-4to3' : null,
    lessonId: null,
    questionMode: defaultQuestionMode(type),
    identifyMode: 'pick_list',
    settings: defaultSettings(type),
    questions: [],
    drawRules: [],
  });

  const edit = async (s: ExamSummary) => {
    const r = await api.exams.get(s.id);
    if (r.ok) setEditing({ exam: r.data, isNew: false });
    else toast(r.error, 'error');
  };

  return (
    <main className="page">
      <PageHeader title={ar.exams.title} onBack={onBack}>
        {TYPES.map((t) => (
          <button key={t} className="btn btn-primary" onClick={() => setEditing({ exam: newExam(t), isNew: true })}>
            + {ar.exams.newOf(ar.examTypes[t])}
          </button>
        ))}
      </PageHeader>
      {exams.loading && <Loading />}
      <ErrorText error={exams.error} />
      {TYPES.map((t) => {
        const list = exams.data?.filter((e) => e.examType === t) ?? [];
        return (
          <section key={t} className="section">
            <h2>{ar.examTypes[t]}</h2>
            {list.length === 0 && <p className="muted">{ar.exams.empty}</p>}
            <div className="table">
              {list.map((e) => (
                <div key={e.id} className="table-row">
                  <button className="link grow" onClick={() => void edit(e)}>
                    <strong>{e.title}</strong>
                    {e.subtitle && <span className="muted"> · {e.subtitle}</span>}
                  </button>
                  <span className="muted nowrap">{ar.exams.summary(e.questionCount, fmt(e.totalPoints))}</span>
                  <span className={`chip status-${e.status}`}>{ar.exams.status[e.status]}</span>
                  {e.status === 'published' && <span className={`chip ${e.isOpen ? 'chip-ok' : ''}`}>{e.isOpen ? ar.exams.open : ar.exams.closed}</span>}
                  <span className="muted nowrap">{ar.exams.attempts(e.attempts)}</span>
                  <div className="row gap-sm wrap">
                    {e.status === 'draft' && (
                      <button className="btn btn-sm btn-primary" onClick={() => void act(api.exams.setStatus(e.id, 'published'))}>
                        {ar.exams.publish}
                      </button>
                    )}
                    {e.status === 'published' && (
                      <button className={`btn btn-sm ${e.isOpen ? '' : 'btn-primary'}`} onClick={() => void act(api.exams.setOpen(e.id, !e.isOpen))}>
                        {e.isOpen ? ar.exams.closeNow : e.examType === 'surprise' ? ar.exams.openSurprise : ar.exams.openNow}
                      </button>
                    )}
                    <button
                      className="btn btn-sm"
                      onClick={async () => {
                        const r = await api.exams.previewStart(e.id);
                        if (r.ok) setPreview(r.data);
                        else toast(r.error, 'error');
                      }}
                    >
                      ▶ {ar.exams.preview}
                    </button>
                    <button className="btn btn-sm" onClick={() => void edit(e)}>
                      {ar.common.edit}
                    </button>
                    {e.status === 'published' && (
                      <button className="btn btn-sm" onClick={() => void act(api.exams.setStatus(e.id, 'draft'))}>
                        {ar.exams.unpublish}
                      </button>
                    )}
                    <button
                      className="btn btn-sm btn-danger"
                      title={ar.exams.deleteHint}
                      onClick={async () => {
                        if (await confirm(`${ar.common.confirmDelete}\n${ar.exams.deleteHint}`)) void act(api.exams.remove(e.id));
                      }}
                    >
                      {ar.common.delete}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </main>
  );
}

type Tab = 'basics' | 'questions' | 'settings';

function ExamEditor({ initial, isNew, onDone }: { initial: ExamInput; isNew: boolean; onDone: () => void }) {
  const { toast } = useFeedback();
  const [e, setE] = useState<ExamInput>(initial);
  const [tab, setTab] = useState<Tab>('basics');
  const [error, setError] = useState<string | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [bankQs, setBankQs] = useState<QuestionSummary[]>([]);
  const [available, setAvailable] = useState<Record<QuestionType, number> | null>(null);
  const update = (patch: Partial<ExamInput>) => setE((cur) => ({ ...cur, ...patch }));

  useEffect(() => {
    void api.courses.list().then((r) => r.ok && setCourses(r.data));
  }, []);
  useEffect(() => {
    void api.exams.bankQuestions(e.examType, e.gradeId).then((r) => r.ok && setBankQs(r.data));
    void api.exams.availability(e.examType, e.gradeId).then((r) => r.ok && setAvailable(r.data));
  }, [e.examType, e.gradeId]);

  const structure = useMemo(
    () =>
      e.questionMode === 'fixed'
        ? { count: e.questions.length, total: e.questions.reduce((a, q) => a + q.points, 0) }
        : { count: e.drawRules.reduce((a, r) => a + r.count, 0), total: e.drawRules.reduce((a, r) => a + r.count * r.points, 0) },
    [e],
  );

  const save = async (publish: boolean) => {
    setError(null);
    const r = await api.exams.save(e);
    if (!r.ok) return setError(r.error);
    if (publish) {
      const p = await api.exams.setStatus(e.id, 'published');
      if (!p.ok) return setError(`${ar.exams.problemsTitle}\n${p.error}`);
    }
    toast(ar.common.saved);
    onDone();
  };

  const lessons = courses.flatMap((c) => c.lessons.map((l) => ({ ...l, course: c })));
  const bankName =
    e.examType === 'promotion' ? ar.examEditor.promotionBank(ar.examEditor.grades[e.gradeId ?? ''] ?? '') : ar.examEditor.generalBank;

  return (
    <main className="page">
      <PageHeader title={isNew ? ar.examEditor.newTitle(ar.examTypes[e.examType]) : ar.examEditor.editTitle} onBack={onDone}>
        <button className="btn" onClick={() => void save(false)}>
          {ar.examEditor.saveDraft}
        </button>
        <button className="btn btn-primary" onClick={() => void save(true)}>
          {ar.examEditor.saveAndPublish}
        </button>
      </PageHeader>
      <div className="tabs">
        {(['basics', 'questions', 'settings'] as Tab[]).map((t) => (
          <button key={t} className={`tab ${tab === t ? 'tab-on' : ''}`} onClick={() => setTab(t)}>
            {ar.examEditor.tabs[t]}
          </button>
        ))}
      </div>
      <div className="summary-bar">{ar.examEditor.summaryBar(structure.count, fmt(structure.total))}</div>
      <ErrorText error={error} />

      {tab === 'basics' && (
        <section className="card stack">
          <label className="field">
            {ar.examEditor.title}
            <input className="input" value={e.title} onChange={(ev) => update({ title: ev.target.value })} autoFocus />
          </label>
          {e.examType === 'course' && (
            <label className="field">
              {ar.examEditor.course}
              <select className="input" value={e.courseId ?? ''} onChange={(ev) => update({ courseId: ev.target.value || null })}>
                <option value="">{ar.examEditor.chooseCourse}</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.courseNumber} — {c.courseName}
                  </option>
                ))}
              </select>
            </label>
          )}
          {e.examType === 'promotion' && (
            <div className="field">
              {ar.examEditor.grade}
              <ChoiceButtons
                options={GRADES.map((g) => ({ value: g.id, label: g.label }))}
                value={e.gradeId}
                onChange={(gradeId) => update({ gradeId, questions: [] })}
              />
            </div>
          )}
          {e.examType === 'quick' && (
            <label className="field">
              {ar.examEditor.lesson}
              <select
                className="input"
                value={e.lessonId ?? ''}
                onChange={(ev) => {
                  const l = lessons.find((x) => x.id === ev.target.value);
                  update({ lessonId: ev.target.value || null, courseId: l?.courseId ?? e.courseId });
                }}
              >
                <option value="">{ar.examEditor.noLesson}</option>
                {lessons.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.course.courseNumber} — {ar.courses.lessonNumber} {l.lessonNumber ?? ''}: {l.title}
                  </option>
                ))}
              </select>
            </label>
          )}
          {e.examType === 'surprise' && (
            <label className="field">
              {ar.examEditor.course} {ar.common.optional}
              <select className="input" value={e.courseId ?? ''} onChange={(ev) => update({ courseId: ev.target.value || null })}>
                <option value="">{ar.examEditor.noCourse}</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.courseNumber} — {c.courseName}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="field">
            {ar.examEditor.identify}
            <div className="stack-sm">
              {(['pick_list', 'number_lookup', 'number_and_name', 'name'] as const).map((m) => (
                <label key={m} className="check">
                  <input type="radio" checked={e.identifyMode === m} onChange={() => update({ identifyMode: m })} />
                  {ar.examEditor.identifyModes[m]}
                </label>
              ))}
            </div>
          </div>
        </section>
      )}

      {tab === 'questions' && (
        <section className="card stack">
          <p className="muted">{ar.examEditor.bankLabel(bankName)}</p>
          {e.examType === 'promotion' && (
            <div className="field">
              {ar.examEditor.mode}
              <ChoiceButtons
                options={(['random_draw', 'fixed'] as const).map((m) => ({ value: m, label: ar.examEditor.modes[m] }))}
                value={e.questionMode}
                onChange={(questionMode) => update({ questionMode })}
              />
            </div>
          )}
          {e.questionMode === 'fixed' ? (
            <FixedPicker exam={e} bankQs={bankQs} onChange={(questions) => update({ questions })} />
          ) : (
            <DrawRules exam={e} available={available} onChange={(drawRules) => update({ drawRules })} />
          )}
        </section>
      )}

      {tab === 'settings' && <SettingsTab exam={e} total={structure.total} onChange={(settings) => update({ settings })} />}
    </main>
  );
}

const POINT_CHOICES = [0.25, 0.5, 1, 2].map((v) => ({ value: v, label: ({ 0.25: '¼', 0.5: '½', 1: '1', 2: '2' } as Record<number, string>)[v]! }));

/** اختيار الأسئلة يدويًا (design.md 1.4ب): مربع اختيار لكل سؤال، ودرجة لكل نوع. */
function FixedPicker({ exam, bankQs, onChange }: { exam: ExamInput; bankQs: QuestionSummary[]; onChange: (q: ExamInput['questions']) => void }) {
  const selected = new Map(exam.questions.map((q) => [q.questionId, q.points]));
  const [typePoints, setTypePoints] = useState<Record<QuestionType, number>>({ TF: 0.5, MCQ: 1, LIST: 1, SKILL: 1, HOTSPOT: 1 });

  const toggle = (q: QuestionSummary) => {
    if (selected.has(q.id)) onChange(exam.questions.filter((x) => x.questionId !== q.id));
    else onChange([...exam.questions, { questionId: q.id, points: q.points }]);
  };

  return (
    <div className="stack">
      {QTYPES.map((t) => {
        const qs = bankQs.filter((q) => q.type === t);
        const chosen = qs.filter((q) => selected.has(q.id));
        const sum = chosen.reduce((a, q) => a + (selected.get(q.id) ?? 0), 0);
        return (
          <details key={t} className="type-group" open={qs.length > 0 && qs.length <= 30}>
            <summary>
              <strong>{ar.questionTypes[t]}</strong>
              <span className="muted">
                {' '}
                — {ar.examEditor.selected(chosen.length)} / {qs.length}
                {chosen.length > 0 && ` — ${fmt(sum)} ${ar.common.points}`}
              </span>
            </summary>
            {qs.length === 0 ? (
              <p className="muted">{ar.examEditor.noneInBank}</p>
            ) : (
              <>
                <div className="row gap center wrap">
                  <button
                    className="btn btn-sm"
                    onClick={() => onChange([...exam.questions, ...qs.filter((q) => !selected.has(q.id)).map((q) => ({ questionId: q.id, points: q.points }))])}
                  >
                    {ar.examEditor.selectAll}
                  </button>
                  <span className="muted">{ar.examEditor.typePoints}:</span>
                  <ChoiceButtons options={POINT_CHOICES} value={typePoints[t]} onChange={(v) => setTypePoints({ ...typePoints, [t]: v })} />
                  <NumberInput value={typePoints[t]} onChange={(v) => v !== null && setTypePoints({ ...typePoints, [t]: v })} className="w-sm" />
                  <button
                    className="btn btn-sm"
                    onClick={() =>
                      onChange(exam.questions.map((x) => (qs.some((q) => q.id === x.questionId) ? { ...x, points: typePoints[t] } : x)))
                    }
                  >
                    {ar.examEditor.applyToType}
                  </button>
                </div>
                <div className="table">
                  {qs.map((q) => (
                    <label key={q.id} className={`table-row pick-row ${selected.has(q.id) ? 'picked' : ''}`}>
                      <input type="checkbox" checked={selected.has(q.id)} onChange={() => toggle(q)} />
                      <span className="grow">{q.text}</span>
                      {!q.tested && <span className="chip chip-warn">{ar.banks.notTested}</span>}
                      {selected.has(q.id) ? (
                        <NumberInput
                          value={selected.get(q.id) ?? 0}
                          onChange={(v) => v !== null && onChange(exam.questions.map((x) => (x.questionId === q.id ? { ...x, points: v } : x)))}
                          className="w-sm"
                        />
                      ) : (
                        <span className="muted">{fmt(q.points)}</span>
                      )}
                    </label>
                  ))}
                </div>
              </>
            )}
          </details>
        );
      })}
    </div>
  );
}

/** قالب السحب العشوائي (design.md 1.5): لكل نوع العدد ودرجة السؤال، مع المتوفر في البنك. */
function DrawRules({
  exam,
  available,
  onChange,
}: {
  exam: ExamInput;
  available: Record<QuestionType, number> | null;
  onChange: (r: ExamInput['drawRules']) => void;
}) {
  const rule = (t: QuestionType) => exam.drawRules.find((r) => r.type === t) ?? { type: t, count: 0, points: t === 'TF' ? 0.5 : 1 };
  const set = (t: QuestionType, patch: Partial<{ count: number; points: number }>) => {
    const others = exam.drawRules.filter((r) => r.type !== t);
    const next = { ...rule(t), ...patch };
    onChange([...others, next].sort((a, b) => QTYPES.indexOf(a.type) - QTYPES.indexOf(b.type)));
  };
  return (
    <div className="draw-table">
      <div className="draw-row draw-head">
        <span>{ar.examEditor.ruleType}</span>
        <span>{ar.examEditor.ruleCount}</span>
        <span>{ar.examEditor.rulePoints}</span>
        <span>{ar.examEditor.ruleAvailable}</span>
        <span>{ar.examEditor.ruleTotal}</span>
      </div>
      {QTYPES.map((t) => {
        const r = rule(t);
        const avail = available?.[t] ?? 0;
        return (
          <div key={t} className={`draw-row ${r.count > avail ? 'draw-bad' : ''}`}>
            <strong>{ar.questionTypes[t]}</strong>
            <NumberInput value={r.count} step={1} onChange={(v) => v !== null && Number.isInteger(v) && set(t, { count: v })} className="w-sm" />
            <div className="row gap-sm center">
              <ChoiceButtons options={POINT_CHOICES} value={r.points} onChange={(points) => set(t, { points })} />
              <NumberInput value={r.points} onChange={(v) => v !== null && set(t, { points: v })} className="w-sm" />
            </div>
            <span>{avail}</span>
            <span>{fmt(r.count * r.points)}</span>
          </div>
        );
      })}
    </div>
  );
}

function SettingsTab({ exam, total, onChange }: { exam: ExamInput; total: number; onChange: (s: ExamInput['settings']) => void }) {
  const s = exam.settings;
  const pass = s.pass;
  return (
    <section className="card stack">
      <div className="field">
        {ar.examEditor.pass}
        <ChoiceButtons
          options={(['percent', 'points', 'none'] as const).map((m) => ({ value: m, label: ar.examEditor.passModes[m] }))}
          value={pass.mode}
          onChange={(mode) =>
            onChange({ ...s, pass: mode === 'none' ? { mode } : { mode, value: mode === 'percent' ? 70 : Math.min(3, total || 3) } })
          }
        />
        {pass.mode === 'percent' && (
          <div className="row gap center wrap">
            <ChoiceButtons
              options={[60, 70, 80].map((v) => ({ value: v, label: `${v}٪` }))}
              value={pass.value}
              onChange={(value) => onChange({ ...s, pass: { mode: 'percent', value } })}
            />
            <NumberInput value={pass.value} step={1} onChange={(v) => v !== null && v <= 100 && onChange({ ...s, pass: { mode: 'percent', value: v } })} className="w-sm" />
            {total > 0 && <span className="muted">{ar.examEditor.passEquivalent(fmt(pass.value), fmt((pass.value / 100) * total), fmt(total))}</span>}
          </div>
        )}
        {pass.mode === 'points' && (
          <div className="row gap center wrap">
            <NumberInput value={pass.value} onChange={(v) => v !== null && onChange({ ...s, pass: { mode: 'points', value: v } })} className="w-sm" />
            <span className="muted">
              {ar.common.of} {fmt(total)}
              {total > 0 && ` (${fmt((pass.value / total) * 100)}٪)`}
            </span>
          </div>
        )}
      </div>
      <div className="field">
        {ar.examEditor.time}
        <div className="row gap center">
          <label className="check">
            <input type="checkbox" checked={s.timeLimitMinutes === null} onChange={(ev) => onChange({ ...s, timeLimitMinutes: ev.target.checked ? null : 30 })} />
            {ar.examEditor.noTime}
          </label>
          {s.timeLimitMinutes !== null && (
            <>
              <NumberInput value={s.timeLimitMinutes} step={1} min={1} onChange={(v) => v && Number.isInteger(v) && onChange({ ...s, timeLimitMinutes: v })} className="w-sm" />
              <span>{ar.examEditor.minutes}</span>
            </>
          )}
        </div>
      </div>
      <label className="check">
        <input type="checkbox" checked={s.showCorrectAfterTries} onChange={(ev) => onChange({ ...s, showCorrectAfterTries: ev.target.checked })} />
        {ar.examEditor.showCorrect}
      </label>
      <div className="field">
        {ar.examEditor.maxAttempts}
        <div className="row gap center">
          <label className="check">
            <input
              type="checkbox"
              checked={s.maxAttemptsPerTrainee === null}
              onChange={(ev) => onChange({ ...s, maxAttemptsPerTrainee: ev.target.checked ? null : 1 })}
            />
            {ar.examEditor.unlimited}
          </label>
          {s.maxAttemptsPerTrainee !== null && (
            <NumberInput value={s.maxAttemptsPerTrainee} step={1} min={1} onChange={(v) => v && Number.isInteger(v) && onChange({ ...s, maxAttemptsPerTrainee: v })} className="w-sm" />
          )}
        </div>
      </div>
    </section>
  );
}
