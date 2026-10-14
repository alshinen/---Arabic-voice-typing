import { useCallback, useState } from 'react';
import { ar } from '../../shared/i18n/ar';
import type { Course, ReadyList, Trainee } from '../../shared/types/api';
import { api, traineeApi } from '../api';
import { ErrorText, Loading, Modal, NumberInput, PageHeader, useFeedback } from '../components/ui';
import { useApi } from '../useApi';
import { readImageFile } from '../util';

/** القوائم الجاهزة لأسئلة «اذكر» والمهارات. */
export function ReadyListsScreen({ onBack }: { onBack: () => void }) {
  const { confirm, toast } = useFeedback();
  const lists = useApi(useCallback(() => api.readyLists.list(), []));
  const [editing, setEditing] = useState<{ id: string | null; name: string; text: string } | null>(null);
  const edit = (l?: ReadyList) => setEditing({ id: l?.id ?? null, name: l?.name ?? '', text: l?.items.join('\n') ?? '' });

  return (
    <main className="page">
      <PageHeader title={ar.readyLists.title} onBack={onBack}>
        <button className="btn btn-primary" onClick={() => edit()}>
          + {ar.readyLists.new}
        </button>
      </PageHeader>
      <p className="muted">{ar.readyLists.hint}</p>
      <ErrorText error={lists.error} />
      {lists.data?.length === 0 && <p className="card empty-state">{ar.readyLists.empty}</p>}
      <div className="grid">
        {lists.data?.map((l) => (
          <div key={l.id} className="card">
            <span className="card-title">{l.name}</span>
            <span className="muted">{ar.readyLists.count(l.items.length)}</span>
            <p className="muted clamp">{l.items.join('، ')}</p>
            <div className="row gap">
              <button className="btn btn-sm" onClick={() => edit(l)}>
                {ar.common.edit}
              </button>
              <button
                className="btn btn-sm btn-danger"
                onClick={async () => {
                  if (await confirm(ar.common.confirmDelete)) {
                    await api.readyLists.remove(l.id);
                    void lists.reload();
                  }
                }}
              >
                {ar.common.delete}
              </button>
            </div>
          </div>
        ))}
      </div>
      {editing && (
        <Modal title={editing.id ? ar.common.edit : ar.readyLists.new} onClose={() => setEditing(null)}>
          <label className="field">
            {ar.editor.readyListName}
            <input className="input" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} autoFocus />
          </label>
          <label className="field">
            {ar.readyLists.items}
            <textarea className="input textarea" rows={14} value={editing.text} onChange={(e) => setEditing({ ...editing, text: e.target.value })} />
          </label>
          <div className="row gap end">
            <button
              className="btn btn-primary"
              onClick={async () => {
                const items = editing.text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
                const r = await api.readyLists.save({ id: editing.id, name: editing.name, items });
                if (r.ok) {
                  setEditing(null);
                  void lists.reload();
                } else toast(r.error, 'error');
              }}
            >
              {ar.common.save}
            </button>
          </div>
        </Modal>
      )}
    </main>
  );
}

/** مكتبة الصور. */
export function ImagesScreen({ onBack }: { onBack: () => void }) {
  const { confirm, toast } = useFeedback();
  const images = useApi(useCallback(() => api.images.list(), []));
  const [rename, setRename] = useState<{ id: string; title: string } | null>(null);

  const upload = async (files: FileList | null) => {
    for (const file of Array.from(files ?? [])) {
      try {
        const { bytes, width, height } = await readImageFile(file);
        const r = await api.images.add({ bytes, fileName: file.name, title: '', width, height });
        if (!r.ok) toast(r.error, 'error');
      } catch {
        toast(ar.images.readError, 'error');
      }
    }
    void images.reload();
  };

  return (
    <main className="page">
      <PageHeader title={ar.images.title} onBack={onBack}>
        <label className="btn btn-primary">
          + {ar.images.upload}
          <input type="file" accept="image/*" multiple hidden onChange={(e) => void upload(e.target.files)} />
        </label>
      </PageHeader>
      <ErrorText error={images.error} />
      {images.data?.length === 0 && <p className="card empty-state">{ar.images.empty}</p>}
      <div className="grid">
        {images.data?.map((img) => (
          <div key={img.id} className="card image-card">
            <img src={traineeApi.imageUrl(img.id)} alt="" />
            <span className="card-title">{img.title}</span>
            <span className="muted">
              {img.width}×{img.height} · {ar.images.usedBy(img.usedBy)}
            </span>
            <div className="row gap">
              <button className="btn btn-sm" onClick={() => setRename({ id: img.id, title: img.title })}>
                {ar.images.rename}
              </button>
              <button
                className="btn btn-sm btn-danger"
                disabled={img.usedBy > 0}
                onClick={async () => {
                  if (!(await confirm(ar.common.confirmDelete))) return;
                  const r = await api.images.remove(img.id);
                  if (r.ok) void images.reload();
                  else toast(r.error, 'error');
                }}
              >
                {ar.common.delete}
              </button>
            </div>
          </div>
        ))}
      </div>
      {rename && (
        <Modal title={ar.images.rename} onClose={() => setRename(null)}>
          <input className="input" value={rename.title} onChange={(e) => setRename({ ...rename, title: e.target.value })} autoFocus />
          <div className="row gap end">
            <button
              className="btn btn-primary"
              onClick={async () => {
                const r = await api.images.rename(rename.id, rename.title);
                if (r.ok) {
                  setRename(null);
                  void images.reload();
                } else toast(r.error, 'error');
              }}
            >
              {ar.common.save}
            </button>
          </div>
        </Modal>
      )}
    </main>
  );
}

/** الدورات وحصصها. */
export function CoursesScreen({ onBack }: { onBack: () => void }) {
  const { confirm, toast } = useFeedback();
  const courses = useApi(useCallback(() => api.courses.list(), []));
  const [course, setCourse] = useState<{ id: string | null; courseNumber: string; courseName: string; startDate: string } | null>(null);
  const [lesson, setLesson] = useState<{ id: string | null; courseId: string | null; lessonNumber: number | null; title: string; date: string } | null>(null);

  const saveCourse = async () => {
    if (!course) return;
    const r = await api.courses.saveCourse({ ...course, startDate: course.startDate || null });
    if (r.ok) {
      setCourse(null);
      void courses.reload();
    } else toast(r.error, 'error');
  };
  const saveLesson = async () => {
    if (!lesson) return;
    const r = await api.courses.saveLesson({ ...lesson, date: lesson.date || null });
    if (r.ok) {
      setLesson(null);
      void courses.reload();
    } else toast(r.error, 'error');
  };

  const lessonButton = (c: Course) => (
    <button className="btn btn-sm" onClick={() => setLesson({ id: null, courseId: c.id, lessonNumber: c.lessons.length + 1, title: '', date: '' })}>
      + {ar.courses.newLesson}
    </button>
  );

  return (
    <main className="page">
      <PageHeader title={ar.courses.title} onBack={onBack}>
        <button className="btn btn-primary" onClick={() => setCourse({ id: null, courseNumber: '', courseName: '', startDate: '' })}>
          + {ar.courses.newCourse}
        </button>
      </PageHeader>
      <ErrorText error={courses.error} />
      {courses.loading && <Loading />}
      {courses.data?.length === 0 && <p className="card empty-state">{ar.courses.empty}</p>}
      <div className="stack">
        {courses.data?.map((c) => (
          <section key={c.id} className="card stack-sm">
            <div className="row gap center between">
              <div>
                <span className="card-title">
                  {c.courseNumber} — {c.courseName}
                </span>
                {c.startDate && <span className="muted"> · {c.startDate}</span>}
              </div>
              <div className="row gap-sm">
                {lessonButton(c)}
                <button className="btn btn-sm" onClick={() => setCourse({ id: c.id, courseNumber: c.courseNumber, courseName: c.courseName, startDate: c.startDate ?? '' })}>
                  {ar.common.edit}
                </button>
                <button
                  className="btn btn-sm btn-danger"
                  onClick={async () => {
                    if (await confirm(ar.common.confirmDelete)) {
                      await api.courses.archiveCourse(c.id);
                      void courses.reload();
                    }
                  }}
                >
                  {ar.common.delete}
                </button>
              </div>
            </div>
            <strong>{ar.courses.lessons}</strong>
            {c.lessons.length === 0 && <span className="muted">{ar.courses.noLessons}</span>}
            {c.lessons.map((l) => (
              <div key={l.id} className="row gap center lesson-row">
                <span className="chip">{l.lessonNumber ?? '—'}</span>
                <span className="grow">{l.title}</span>
                {l.date && <span className="muted">{l.date}</span>}
                <button
                  className="btn btn-sm"
                  onClick={() => setLesson({ id: l.id, courseId: l.courseId, lessonNumber: l.lessonNumber, title: l.title, date: l.date ?? '' })}
                >
                  {ar.common.edit}
                </button>
                <button
                  className="btn btn-sm btn-danger"
                  onClick={async () => {
                    if (!(await confirm(ar.common.confirmDelete))) return;
                    const r = await api.courses.removeLesson(l.id);
                    if (r.ok) void courses.reload();
                    else toast(r.error, 'error');
                  }}
                >
                  {ar.common.delete}
                </button>
              </div>
            ))}
          </section>
        ))}
      </div>
      {course && (
        <Modal title={course.id ? ar.common.edit : ar.courses.newCourse} onClose={() => setCourse(null)}>
          <div className="stack">
            <label className="field">
              {ar.courses.courseNumber}
              <input className="input" value={course.courseNumber} onChange={(e) => setCourse({ ...course, courseNumber: e.target.value })} autoFocus />
            </label>
            <label className="field">
              {ar.courses.courseName}
              <input className="input" value={course.courseName} onChange={(e) => setCourse({ ...course, courseName: e.target.value })} />
            </label>
            <label className="field">
              {ar.courses.startDate} {ar.common.optional}
              <input className="input" type="date" value={course.startDate} onChange={(e) => setCourse({ ...course, startDate: e.target.value })} />
            </label>
            <div className="row gap end">
              <button className="btn btn-primary" onClick={() => void saveCourse()}>
                {ar.common.save}
              </button>
            </div>
          </div>
        </Modal>
      )}
      {lesson && (
        <Modal title={lesson.id ? ar.common.edit : ar.courses.newLesson} onClose={() => setLesson(null)}>
          <div className="stack">
            <label className="field">
              {ar.courses.lessonNumber}
              <NumberInput value={lesson.lessonNumber} step={1} min={1} onChange={(v) => setLesson({ ...lesson, lessonNumber: v })} className="w-sm" />
            </label>
            <label className="field">
              {ar.courses.lessonTitle}
              <input className="input" value={lesson.title} onChange={(e) => setLesson({ ...lesson, title: e.target.value })} autoFocus />
            </label>
            <label className="field">
              {ar.common.date} {ar.common.optional}
              <input className="input" type="date" value={lesson.date} onChange={(e) => setLesson({ ...lesson, date: e.target.value })} />
            </label>
            <div className="row gap end">
              <button className="btn btn-primary" onClick={() => void saveLesson()}>
                {ar.common.save}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </main>
  );
}

/** المتدربون: إضافة وتعديل واستيراد من Excel. */
export function TraineesScreen({ onBack }: { onBack: () => void }) {
  const { confirm, toast } = useFeedback();
  const [showInactive, setShowInactive] = useState(false);
  const trainees = useApi(useCallback(() => api.trainees.list(showInactive), [showInactive]));
  const [editing, setEditing] = useState<(Omit<Trainee, 'id'> & { id: string | null }) | null>(null);
  const [importResult, setImportResult] = useState<string | null>(null);

  const importCsv = async (file: File | undefined) => {
    if (!file) return;
    const r = await api.trainees.importCsv(await file.text());
    if (r.ok) {
      setImportResult([ar.trainees.imported(r.data.added, r.data.updated), ...r.data.skipped].join('\n'));
      void trainees.reload();
    } else toast(r.error, 'error');
  };

  return (
    <main className="page">
      <PageHeader title={ar.trainees.title} onBack={onBack}>
        <label className="btn" title={ar.trainees.importHint}>
          {ar.trainees.importCsv}
          <input type="file" accept=".csv,text/csv" hidden onChange={(e) => void importCsv(e.target.files?.[0])} />
        </label>
        <button className="btn btn-primary" onClick={() => setEditing({ id: null, number: '', fullName: '', currentLevel: null, active: true })}>
          + {ar.trainees.add}
        </button>
      </PageHeader>
      <p className="muted">{ar.trainees.importHint}</p>
      <label className="check">
        <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
        {ar.trainees.showInactive}
      </label>
      <ErrorText error={trainees.error} />
      {importResult && <p className="card pre-line">{importResult}</p>}
      {trainees.data && <p className="muted">{ar.trainees.count(trainees.data.length)}</p>}
      {trainees.data?.length === 0 && <p className="card empty-state">{ar.trainees.empty}</p>}
      <div className="table">
        {trainees.data?.map((t) => (
          <div key={t.id} className={`table-row ${t.active ? '' : 'inactive'}`}>
            <span className="chip">{t.number ?? '—'}</span>
            <span className="grow">{t.fullName}</span>
            <span className="muted">
              {ar.trainees.level}: {t.currentLevel ? ar.trainees.levels[t.currentLevel] : ar.trainees.noLevel}
            </span>
            <button className="btn btn-sm" onClick={() => setEditing({ ...t })}>
              {ar.common.edit}
            </button>
            <button
              className="btn btn-sm btn-danger"
              onClick={async () => {
                if (await confirm(ar.common.confirmDelete)) {
                  await api.trainees.remove(t.id);
                  void trainees.reload();
                }
              }}
            >
              {ar.common.delete}
            </button>
          </div>
        ))}
      </div>
      {editing && (
        <Modal title={editing.id ? ar.common.edit : ar.trainees.add} onClose={() => setEditing(null)}>
          <div className="stack">
            <label className="field">
              {ar.common.number}
              <input className="input" inputMode="numeric" value={editing.number ?? ''} onChange={(e) => setEditing({ ...editing, number: e.target.value })} autoFocus />
            </label>
            <label className="field">
              {ar.common.name}
              <input className="input" value={editing.fullName} onChange={(e) => setEditing({ ...editing, fullName: e.target.value })} />
            </label>
            <label className="field">
              {ar.trainees.level}
              <select
                className="input"
                value={editing.currentLevel ?? ''}
                onChange={(e) => setEditing({ ...editing, currentLevel: e.target.value ? Number(e.target.value) : null })}
              >
                <option value="">{ar.trainees.noLevel}</option>
                {[4, 3, 2, 1].map((l) => (
                  <option key={l} value={l}>
                    {ar.trainees.levels[l]}
                  </option>
                ))}
              </select>
            </label>
            <label className="check">
              <input type="checkbox" checked={editing.active} onChange={(e) => setEditing({ ...editing, active: e.target.checked })} />
              {ar.trainees.active}
            </label>
            <div className="row gap end">
              <button
                className="btn btn-primary"
                onClick={async () => {
                  const r = await api.trainees.save({ ...editing, number: editing.number || null });
                  if (r.ok) {
                    setEditing(null);
                    void trainees.reload();
                  } else toast(r.error, 'error');
                }}
              >
                {ar.common.save}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </main>
  );
}
