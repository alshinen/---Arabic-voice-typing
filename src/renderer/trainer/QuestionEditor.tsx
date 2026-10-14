import { useCallback, useEffect, useState } from 'react';
import { ar } from '../../shared/i18n/ar';
import type { ImageInfo, ReadyList } from '../../shared/types/api';
import { TRIES_BY_LEVEL, type TriesLevel } from '../../shared/types/domain';
import {
  questionMaxPoints,
  questionSchema,
  validateQuestionLogic,
  type ListData,
  type Question,
  type QuestionOf,
  type SkillData,
} from '../../shared/types/question';
import { api, traineeApi } from '../api';
import { OptionsEditor } from './OptionsEditor';
import { HotspotEditor } from './HotspotEditor';
import { QuestionTester } from './QuestionTester';
import { ChoiceButtons, Modal, NumberInput, PageHeader, useFeedback } from '../components/ui';
import { cleanQuestion, opt } from './questionDraft';
import { fmt, readImageFile } from '../util';

const POINT_CHOICES = [0.25, 0.5, 1, 2].map((v) => ({ value: v, label: ({ 0.25: '¼', 0.5: '½', 1: '1', 2: '2' } as Record<number, string>)[v]! }));
const LEVELS: TriesLevel[] = ['beginner', 'intermediate', 'advanced'];

/** محرر السؤال (design.md 2.3): الإعدادات المشتركة ثم محرر خاص بكل نوع، وزر «تجربة». */
export function QuestionEditor({ initial, isNew, onDone }: { initial: Question; isNew: boolean; onDone: () => void }) {
  const { toast, confirm } = useFeedback();
  const [q, setQ] = useState<Question>(initial);
  const [dirty, setDirty] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [testing, setTesting] = useState<Question | null>(null);
  const [images, setImages] = useState<ImageInfo[]>([]);
  const [readyLists, setReadyLists] = useState<ReadyList[]>([]);

  useEffect(() => {
    void api.readyLists.list().then((r) => r.ok && setReadyLists(r.data));
    void api.images.list().then((r) => r.ok && setImages(r.data));
  }, []);

  const update = useCallback((patch: Partial<Question>) => {
    setQ((cur) => ({ ...cur, ...patch }) as Question);
    setDirty(true);
  }, []);
  const setData = <T extends Question>(data: T['data']) => update({ data } as Partial<Question>);

  const validate = (): Question | null => {
    const cleaned = cleanQuestion(q);
    const parsed = questionSchema.safeParse(cleaned);
    const errs = parsed.success ? validateQuestionLogic(parsed.data) : parsed.error.issues.map((i) => i.message);
    setErrors([...new Set(errs)]);
    return errs.length ? null : (parsed.data as Question);
  };

  const save = async (tested: boolean) => {
    const valid = validate();
    if (!valid) return;
    const r = await api.questions.save(valid, tested);
    if (r.ok) {
      toast(ar.common.saved);
      setDirty(false);
      onDone();
    } else setErrors([r.error]);
  };

  const back = async () => {
    if (!dirty || (await confirm(ar.editor.unsaved))) onDone();
  };

  const image = q.imageId ? images.find((i) => i.id === q.imageId) ?? null : null;
  const typeLabel = ar.questionTypes[q.type];

  return (
    <main className="page">
      <PageHeader title={isNew ? ar.editor.newTitle(typeLabel) : ar.editor.editTitle(typeLabel)} onBack={() => void back()}>
        <button
          className="btn"
          onClick={() => {
            const v = validate();
            if (v) setTesting(v);
          }}
        >
          ▶ {ar.editor.test}
        </button>
        <button className="btn btn-primary" onClick={() => void save(false)}>
          {ar.editor.save}
        </button>
      </PageHeader>

      <section className="card stack">
        <label className="field">
          {ar.editor.text}
          <textarea
            className="input textarea"
            rows={2}
            value={q.text}
            placeholder={q.type === 'HOTSPOT' ? ar.editor.textHintHotspot : ''}
            onChange={(e) => update({ text: e.target.value })}
          />
        </label>

        <div className="grid-2">
          <div className="field">
            {ar.editor.points}
            {(q.type === 'LIST' || q.type === 'SKILL') && q.data.scoring === 'per_item' ? (
              <span className="muted">{ar.editor.totalPoints(fmt(questionMaxPoints(q)))}</span>
            ) : (
              <div className="row gap center wrap">
                <ChoiceButtons
                  options={POINT_CHOICES}
                  value={POINT_CHOICES.some((c) => c.value === q.points) ? q.points : null}
                  onChange={(points) => update({ points })}
                />
                <NumberInput value={q.points} onChange={(v) => v !== null && update({ points: v })} className="w-sm" />
              </div>
            )}
          </div>
          <div className="field">
            {ar.editor.tries}
            <div className="row gap center wrap">
              <ChoiceButtons
                options={LEVELS.map((l) => ({ value: l, label: ar.editor.levels[l] }))}
                value={q.level}
                onChange={(level) => update({ level, maxTries: TRIES_BY_LEVEL[level] })}
              />
              <NumberInput value={q.maxTries} step={1} min={1} onChange={(v) => v && Number.isInteger(v) && v <= 10 && update({ maxTries: v, level: null })} className="w-sm" />
            </div>
          </div>
        </div>

        {q.maxTries > 1 && (
          <div className="field">
            {ar.editor.lateScoring}
            <div className="stack-sm">
              {(['decreasing', 'full', 'first_only'] as const).map((m) => (
                <label key={m} className="check">
                  <input type="radio" name="late" checked={q.lateTryScoring === m} onChange={() => update({ lateTryScoring: m })} />
                  {ar.editor.lateModes[m]}
                </label>
              ))}
            </div>
            {q.type === 'TF' && q.lateTryScoring !== 'first_only' && <p className="warn">{ar.editor.tfWarning}</p>}
          </div>
        )}

        {(q.type === 'MCQ' || q.type === 'LIST' || q.type === 'SKILL') && (
          <label className="check">
            <input type="checkbox" checked={q.shuffleOptions} onChange={(e) => update({ shuffleOptions: e.target.checked })} />
            {ar.editor.shuffle}
          </label>
        )}
      </section>

      <section className="card stack">
        {q.type === 'TF' && (
          <div className="field">
            {ar.editor.tfCorrect}
            <ChoiceButtons
              options={[
                { value: 'true', label: ar.editor.true },
                { value: 'false', label: ar.editor.false },
              ]}
              value={q.data.correct ? 'true' : 'false'}
              onChange={(v) => setData<QuestionOf<'TF'>>({ correct: v === 'true' })}
            />
          </div>
        )}

        {q.type === 'MCQ' && (
          <div className="field">
            {ar.editor.options}
            <OptionsEditor
              options={q.data.options}
              onChange={(options) => setData<QuestionOf<'MCQ'>>({ ...q.data, options })}
              mark={{ kind: 'radio', isOn: (id) => id === q.data.correctId, toggle: (id) => setData<QuestionOf<'MCQ'>>({ ...q.data, correctId: id }) }}
            />
          </div>
        )}

        {q.type === 'LIST' && <ListEditor data={q.data} onChange={(d) => setData<QuestionOf<'LIST'>>(d)} readyLists={readyLists} />}
        {q.type === 'SKILL' && <SkillEditor data={q.data} onChange={(d) => setData<QuestionOf<'SKILL'>>(d)} readyLists={readyLists} />}

        {q.type === 'HOTSPOT' && (
          <>
            <ImagePicker
              images={images}
              value={q.imageId}
              onChange={(id) => update({ imageId: id, data: { ...q.data, regions: id === q.imageId ? q.data.regions : [] } } as Partial<Question>)}
              onUploaded={(img) => {
                setImages((list) => [img, ...list]);
                update({ imageId: img.id, data: { ...q.data, regions: [] } } as Partial<Question>);
              }}
            />
            {image && (
              <>
                <HotspotEditor
                  src={traineeApi.imageUrl(image.id)}
                  natural={image}
                  regions={q.data.regions}
                  tolerance={q.data.tolerance}
                  onChange={(regions) => setData<QuestionOf<'HOTSPOT'>>({ ...q.data, regions })}
                />
                <label className="field">
                  {ar.editor.tolerance}: {Math.round(q.data.tolerance * 100)}٪
                  <input
                    type="range"
                    min={0}
                    max={0.05}
                    step={0.005}
                    value={q.data.tolerance}
                    onChange={(e) => setData<QuestionOf<'HOTSPOT'>>({ ...q.data, tolerance: Number(e.target.value) })}
                  />
                </label>
              </>
            )}
          </>
        )}
      </section>

      {errors.length > 0 && (
        <section className="card errors">
          {errors.map((e, i) => (
            <p key={i} className="error pre-line">
              {e}
            </p>
          ))}
        </section>
      )}

      {testing && (
        <QuestionTester
          question={testing}
          image={image}
          onClose={() => setTesting(null)}
          onApprove={() => {
            setTesting(null);
            void save(true);
          }}
        />
      )}
    </main>
  );
}

function ListEditor({ data, onChange, readyLists }: { data: ListData; onChange: (d: ListData) => void; readyLists: ReadyList[] }) {
  const n = data.slots.length;
  const setCount = (count: number) => {
    const slots = Array.from(
      { length: count },
      (_, i) => data.slots[i] ?? { options: data.shared ? [] : [opt(), opt()], correctId: null },
    );
    const itemPoints = data.itemPoints ? Array.from({ length: count }, (_, i) => data.itemPoints![i] ?? 0.5) : null;
    onChange({ ...data, slots, itemPoints });
  };
  const correctFilled = data.correctIds.filter((id) => data.options.some((o) => o.id === id && o.text.trim())).length;

  return (
    <div className="stack">
      <div className="grid-2">
        <label className="field">
          {ar.editor.slotsCount}
          <NumberInput value={n} step={1} min={1} onChange={(v) => v && Number.isInteger(v) && v <= 40 && setCount(v)} className="w-sm" />
        </label>
        <div className="field">
          {ar.editor.ordered}
          <ChoiceButtons
            options={[
              { value: 'no', label: ar.editor.orderedNo },
              { value: 'yes', label: ar.editor.orderedYes },
            ]}
            value={data.ordered ? 'yes' : 'no'}
            onChange={(v) => onChange({ ...data, ordered: v === 'yes', shared: v === 'yes' ? data.shared : true })}
          />
        </div>
      </div>
      <div className="field">
        {ar.editor.shared}
        <ChoiceButtons
          options={[
            { value: 'yes', label: ar.editor.sharedYes },
            { value: 'no', label: ar.editor.sharedNo },
          ]}
          value={data.shared ? 'yes' : 'no'}
          onChange={(v) =>
            data.ordered &&
            onChange({
              ...data,
              shared: v === 'yes',
              slots: data.slots.map((x) => (v === 'no' && x.options.length === 0 ? { ...x, options: [opt(), opt()] } : x)),
            })
          }
        />
        {!data.ordered && <span className="muted">{ar.editor.sharedForced}</span>}
      </div>

      {data.shared && (
        <div className="field">
          {ar.editor.options}
          <OptionsEditor
            options={data.options}
            onChange={(options) => onChange({ ...data, options })}
            warnSmall
            readyLists={readyLists}
            mark={
              data.ordered
                ? undefined
                : {
                    kind: 'checkbox',
                    isOn: (id) => data.correctIds.includes(id),
                    toggle: (id) =>
                      onChange({
                        ...data,
                        correctIds: data.correctIds.includes(id) ? data.correctIds.filter((c) => c !== id) : [...data.correctIds, id],
                      }),
                  }
            }
          />
          {!data.ordered && correctFilled < n && <p className="warn">{ar.editor.correctCount(correctFilled, n)}</p>}
        </div>
      )}

      {data.ordered && (
        <div className="stack">
          {data.slots.map((s, i) => (
            <div key={i} className="slot-edit">
              <strong>{ar.editor.slot(i + 1)}</strong>
              {data.shared ? (
                <label className="field">
                  {ar.editor.slotCorrect}
                  <select
                    className="input"
                    value={s.correctId ?? ''}
                    onChange={(e) => onChange({ ...data, slots: data.slots.map((x, j) => (j === i ? { ...x, correctId: e.target.value || null } : x)) })}
                  >
                    <option value="">{ar.editor.choose}</option>
                    {data.options
                      .filter((o) => o.text.trim())
                      .map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.text}
                        </option>
                      ))}
                  </select>
                </label>
              ) : (
                <OptionsEditor
                  options={s.options}
                  onChange={(options) => onChange({ ...data, slots: data.slots.map((x, j) => (j === i ? { ...x, options } : x)) })}
                  readyLists={readyLists}
                  mark={{
                    kind: 'radio',
                    isOn: (id) => id === s.correctId,
                    toggle: (id) => onChange({ ...data, slots: data.slots.map((x, j) => (j === i ? { ...x, correctId: id } : x)) }),
                  }}
                />
              )}
              {data.scoring === 'per_item' && (
                <label className="field">
                  {ar.editor.itemPoints}
                  <NumberInput
                    value={data.itemPoints?.[i] ?? null}
                    onChange={(v) => onChange({ ...data, itemPoints: data.slots.map((_, j) => (j === i ? v ?? 0 : data.itemPoints?.[j] ?? 0.5)) })}
                    className="w-sm"
                  />
                </label>
              )}
            </div>
          ))}
        </div>
      )}

      <ScoringChoice
        value={data.scoring}
        onChange={(scoring) => onChange({ ...data, scoring, itemPoints: scoring === 'per_item' ? data.itemPoints ?? data.slots.map(() => 0.5) : null })}
      />
      {!data.ordered && data.scoring === 'per_item' && (
        <div className="row gap wrap">
          {data.slots.map((_, i) => (
            <label key={i} className="field">
              {ar.editor.slot(i + 1)}
              <NumberInput
                value={data.itemPoints?.[i] ?? null}
                onChange={(v) => onChange({ ...data, itemPoints: data.slots.map((_, j) => (j === i ? v ?? 0 : data.itemPoints?.[j] ?? 0.5)) })}
                className="w-sm"
              />
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function ScoringChoice({ value, onChange }: { value: ListData['scoring']; onChange: (v: ListData['scoring']) => void }) {
  return (
    <div className="field">
      {ar.editor.scoring}
      <div className="stack-sm">
        {(['partial', 'all_or_nothing', 'per_item'] as const).map((m) => (
          <label key={m} className="check">
            <input type="radio" checked={value === m} onChange={() => onChange(m)} />
            {ar.editor.scoringModes[m]}
          </label>
        ))}
      </div>
    </div>
  );
}

function SkillEditor({ data, onChange, readyLists }: { data: SkillData; onChange: (d: SkillData) => void; readyLists: ReadyList[] }) {
  const [paste, setPaste] = useState<string | null>(null);
  const opts = data.options.filter((o) => o.text.trim());
  const setItem = (i: number, patch: Partial<SkillData['items'][number]>) =>
    onChange({ ...data, items: data.items.map((it, j) => (j === i ? { ...it, ...patch } : it)) });

  return (
    <div className="stack">
      <div className="field">
        {ar.editor.skillOptions}
        <OptionsEditor options={data.options} onChange={(options) => onChange({ ...data, options })} readyLists={readyLists} />
      </div>
      <div className="field">
        {ar.editor.skillItems} ({data.items.length})
        <div className="skill-table">
          {data.items.map((it, i) => (
            <div key={i} className="skill-edit-row">
              <span className="muted">{i + 1}</span>
              <input className="input grow" placeholder={ar.editor.itemLabel} value={it.label} onChange={(e) => setItem(i, { label: e.target.value })} />
              <select className="input" value={it.correctId} onChange={(e) => setItem(i, { correctId: e.target.value })}>
                <option value="">{ar.editor.choose}</option>
                {opts.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.text}
                  </option>
                ))}
              </select>
              {data.scoring === 'per_item' && (
                <NumberInput value={it.points} onChange={(v) => setItem(i, { points: v })} className="w-sm" placeholder={ar.editor.itemPoints} />
              )}
              <button type="button" className="btn btn-icon" onClick={() => onChange({ ...data, items: data.items.filter((_, j) => j !== i) })}>
                ✕
              </button>
            </div>
          ))}
        </div>
        <div className="row gap">
          <button
            type="button"
            className="btn"
            onClick={() => onChange({ ...data, items: [...data.items, { label: '', correctId: '', points: data.scoring === 'per_item' ? 0.25 : null }] })}
          >
            + {ar.editor.addItem}
          </button>
          <button type="button" className="btn" onClick={() => setPaste('')}>
            {ar.editor.pasteItems}
          </button>
        </div>
      </div>
      <ScoringChoice
        value={data.scoring}
        onChange={(scoring) => onChange({ ...data, scoring, items: data.items.map((it) => ({ ...it, points: scoring === 'per_item' ? it.points ?? 0.25 : null })) })}
      />
      {paste !== null && (
        <Modal title={ar.editor.pasteItems} onClose={() => setPaste(null)}>
          <p className="muted">{ar.editor.pasteHint}</p>
          <textarea className="input textarea" rows={10} value={paste} onChange={(e) => setPaste(e.target.value)} autoFocus />
          <div className="row gap end">
            <button
              className="btn btn-primary"
              onClick={() => {
                const lines = paste.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
                const kept = data.items.filter((it) => it.label.trim());
                onChange({ ...data, items: [...kept, ...lines.map((label) => ({ label, correctId: '', points: data.scoring === 'per_item' ? 0.25 : null }))] });
                setPaste(null);
              }}
            >
              {ar.editor.pasteApply}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function ImagePicker({
  images,
  value,
  onChange,
  onUploaded,
}: {
  images: ImageInfo[];
  value: string | null;
  onChange: (id: string) => void;
  onUploaded: (img: ImageInfo) => void;
}) {
  const { toast } = useFeedback();
  const [open, setOpen] = useState(!value);
  const upload = async (file: File | undefined) => {
    if (!file) return;
    try {
      const { bytes, width, height } = await readImageFile(file);
      const r = await api.images.add({ bytes, fileName: file.name, title: '', width, height });
      if (r.ok) {
        onUploaded(r.data);
        setOpen(false);
      } else toast(r.error, 'error');
    } catch {
      toast(ar.images.readError, 'error');
    }
  };
  const current = images.find((i) => i.id === value);
  return (
    <div className="field">
      {ar.editor.image}
      <div className="row gap center wrap">
        {current && <strong>{current.title}</strong>}
        <button type="button" className="btn" onClick={() => setOpen((o) => !o)}>
          {current ? ar.editor.changeImage : ar.editor.chooseImage}
        </button>
        <label className="btn">
          {ar.editor.uploadImage}
          <input type="file" accept="image/*" hidden onChange={(e) => void upload(e.target.files?.[0])} />
        </label>
      </div>
      {open && images.length > 0 && (
        <div className="thumbs">
          {images.map((img) => (
            <button
              key={img.id}
              type="button"
              className={`thumb ${img.id === value ? 'thumb-on' : ''}`}
              onClick={() => {
                onChange(img.id);
                setOpen(false);
              }}
            >
              <img src={traineeApi.imageUrl(img.id)} alt="" />
              <span>{img.title}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
