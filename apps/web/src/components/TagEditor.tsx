import { TAGS_MAX, TAG_MAX, cleanTag } from '@autopilot/core';
import { useState } from 'react';

export function TagEditor({ tags, onChange }: { tags: string[]; onChange: (t: string[]) => void }) {
  const [draft, setDraft] = useState('');

  function add(raw: string) {
    const parts = raw.split(',').map((p) => cleanTag(p)).filter((p): p is string => !!p);
    const next = [...tags];
    for (const p of parts) if (!next.includes(p) && next.length < TAGS_MAX) next.push(p);
    onChange(next);
    setDraft('');
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {tags.map((t) => (
          <span key={t} className="inline-flex items-center gap-1 rounded-full border border-rule bg-mist py-1 pl-3 pr-1 text-sm">
            {t}
            <span className={`text-xs ${t.length > TAG_MAX ? 'text-danger' : 'text-slate'}`}>{t.length}</span>
            <button
              type="button"
              className="ml-1 grid h-6 w-6 place-items-center rounded-full text-slate hover:bg-rule hover:text-ink"
              aria-label={`Remove tag ${t}`}
              onClick={() => onChange(tags.filter((x) => x !== t))}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      {tags.length < TAGS_MAX && (
        <input
          className="field mt-2"
          value={draft}
          placeholder={`Add a tag (${TAGS_MAX - tags.length} left) — press Enter`}
          maxLength={40}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault();
              if (draft.trim()) add(draft);
            }
          }}
          onBlur={() => draft.trim() && add(draft)}
        />
      )}
    </div>
  );
}
