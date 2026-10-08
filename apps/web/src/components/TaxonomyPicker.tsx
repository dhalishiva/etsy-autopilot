import { useEffect, useState } from 'react';
import { etsy } from '../lib/supabase';

const SUGGESTED = ['templates', 'planners', 'calendars', 'stationery'];

export function TaxonomyPicker({ value, onChange }: { value: number | null; onChange: (id: number, path: string) => void }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<{ id: number; path: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setBusy(true);
      setError(null);
      try {
        setResults((await etsy.taxonomy(q)).results);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div>
      {value && <p className="mb-2 text-sm text-slate">Category #{value} selected. Search to change it.</p>}
      <input className="field" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search Etsy categories, e.g. templates" />
      {!q && (
        <div className="mt-2 flex flex-wrap gap-2">
          {SUGGESTED.map((s) => (
            <button key={s} type="button" className="rounded-full border border-rule px-3 py-1 text-sm hover:bg-mist" onClick={() => setQ(s)}>
              {s}
            </button>
          ))}
        </div>
      )}
      {busy && <p className="mt-2 text-sm text-slate">Searching…</p>}
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      {results.length > 0 && (
        <ul className="mt-2 max-h-64 overflow-auto rounded-lg border border-rule bg-card">
          {results.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                className={`w-full px-3 py-2 text-left text-sm hover:bg-mist ${r.id === value ? 'font-semibold' : ''}`}
                onClick={() => {
                  onChange(r.id, r.path);
                  setQ('');
                }}
              >
                {r.path}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
