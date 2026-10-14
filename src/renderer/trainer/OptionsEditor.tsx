import { useState } from 'react';
import { ar } from '../../shared/i18n/ar';
import type { ReadyList } from '../../shared/types/api';
import { RECOMMENDED_LIST_SIZE, type Option } from '../../shared/types/question';
import { api } from '../api';
import { Modal, useFeedback } from '../components/ui';
import { opt } from './questionDraft';

/**
 * محرر قائمة خيارات: إضافة وحذف وترتيب، ولصق عدة خيارات، والاستيراد من قائمة جاهزة.
 * mark: «صحيح» لكل خيار (دائرة لخيار واحد، أو مربع لعدة خيارات).
 */
export function OptionsEditor({
  options,
  onChange,
  mark,
  warnSmall,
  readyLists,
}: {
  options: Option[];
  onChange: (o: Option[]) => void;
  mark?: { kind: 'radio' | 'checkbox'; isOn: (id: string) => boolean; toggle: (id: string) => void };
  warnSmall?: boolean;
  readyLists?: ReadyList[];
}) {
  const { toast } = useFeedback();
  const [paste, setPaste] = useState<string | null>(null);
  const [pick, setPick] = useState(false);
  const [saveAs, setSaveAs] = useState<string | null>(null);
  const filled = options.filter((o) => o.text.trim());

  const addLines = (text: string) => {
    const existing = new Set(options.map((o) => o.text.trim()));
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !existing.has(l));
    onChange([...options.filter((o) => o.text.trim()), ...[...new Set(lines)].map((l) => opt(l))]);
  };

  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= options.length) return;
    const next = [...options];
    [next[i], next[j]] = [next[j]!, next[i]!];
    onChange(next);
  };

  return (
    <div className="options-editor">
      {options.map((o, i) => (
        <div key={o.id} className="option-row">
          {mark && (
            <label className="correct-mark" title={ar.editor.correct}>
              <input type={mark.kind} checked={mark.isOn(o.id)} onChange={() => mark.toggle(o.id)} name={mark.kind === 'radio' ? 'correct' : undefined} />
              <span>{ar.editor.correct}</span>
            </label>
          )}
          <input
            className="input grow"
            value={o.text}
            placeholder={ar.editor.optionPlaceholder}
            onChange={(e) => onChange(options.map((x) => (x.id === o.id ? { ...x, text: e.target.value } : x)))}
          />
          <button type="button" className="btn btn-icon" onClick={() => move(i, -1)} aria-label={ar.common.up}>
            ▲
          </button>
          <button type="button" className="btn btn-icon" onClick={() => move(i, 1)} aria-label={ar.common.down}>
            ▼
          </button>
          <button type="button" className="btn btn-icon" onClick={() => onChange(options.filter((x) => x.id !== o.id))} aria-label={ar.common.delete}>
            ✕
          </button>
        </div>
      ))}
      <div className="row gap wrap">
        <button type="button" className="btn" onClick={() => onChange([...options, opt()])}>
          + {ar.editor.addOption}
        </button>
        <button type="button" className="btn" onClick={() => setPaste('')}>
          {ar.editor.paste}
        </button>
        {readyLists && (
          <button type="button" className="btn" onClick={() => setPick(true)} disabled={!readyLists.length}>
            {ar.editor.fromReadyList}
          </button>
        )}
        {readyLists && filled.length > 1 && (
          <button type="button" className="btn" onClick={() => setSaveAs('')}>
            {ar.editor.saveAsReadyList}
          </button>
        )}
      </div>
      {warnSmall && filled.length < RECOMMENDED_LIST_SIZE && (
        <p className="warn">{ar.editor.listTooSmall(filled.length, RECOMMENDED_LIST_SIZE)}</p>
      )}

      {paste !== null && (
        <Modal title={ar.editor.paste} onClose={() => setPaste(null)}>
          <p className="muted">{ar.editor.pasteHint}</p>
          <textarea className="input textarea" rows={10} value={paste} onChange={(e) => setPaste(e.target.value)} autoFocus />
          <div className="row gap end">
            <button
              className="btn btn-primary"
              onClick={() => {
                addLines(paste);
                setPaste(null);
              }}
            >
              {ar.editor.pasteApply}
            </button>
          </div>
        </Modal>
      )}
      {pick && readyLists && (
        <Modal title={ar.editor.fromReadyList} onClose={() => setPick(false)}>
          <div className="stack">
            {readyLists.map((l) => (
              <button
                key={l.id}
                className="btn list-pick"
                onClick={() => {
                  addLines(l.items.join('\n'));
                  setPick(false);
                }}
              >
                <strong>{l.name}</strong>
                <span className="muted">{ar.readyLists.count(l.items.length)}</span>
              </button>
            ))}
          </div>
        </Modal>
      )}
      {saveAs !== null && (
        <Modal title={ar.editor.saveAsReadyList} onClose={() => setSaveAs(null)}>
          <label className="field">
            {ar.editor.readyListName}
            <input className="input" value={saveAs} onChange={(e) => setSaveAs(e.target.value)} autoFocus />
          </label>
          <div className="row gap end">
            <button
              className="btn btn-primary"
              onClick={async () => {
                const r = await api.readyLists.save({ id: null, name: saveAs, items: filled.map((o) => o.text.trim()) });
                if (r.ok) {
                  toast(ar.common.saved);
                  setSaveAs(null);
                } else toast(r.error, 'error');
              }}
            >
              {ar.common.save}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
