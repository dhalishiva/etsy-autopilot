import { CURRENCIES } from '@autopilot/core';
import { useEffect, useState } from 'react';
import { useToast } from '../components/Toast';
import { store } from '../lib/store';
import { DEFAULT_SETTINGS, type Settings } from '../lib/types';

export function SettingsPage() {
  const [s, setS] = useState<Settings>(DEFAULT_SETTINGS);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  useEffect(() => {
    store.getSettings().then(setS).catch((e) => toast(e.message, 'error'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await store.saveSettings(s);
      toast('Settings saved');
    } catch (err) {
      toast((err as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 md:px-8 md:py-10">
      <h1 className="text-3xl font-extrabold md:text-4xl">Settings</h1>
      <p className="mt-1 text-slate">Defaults for new products. Each product can still be changed on its own page.</p>
      <form onSubmit={save} className="mt-8 space-y-6">
        <div>
          <label className="label" htmlFor="brand">
            Shop / brand name
          </label>
          <input id="brand" className="field" value={s.brand} maxLength={40} onChange={(e) => setS({ ...s, brand: e.target.value })} />
          <p className="mt-1 text-xs text-slate">Printed on files and listing images.</p>
        </div>
        <div>
          <label className="label" htmlFor="cur">
            Default currency in spreadsheets
          </label>
          <select id="cur" className="field" value={s.default_currency} onChange={(e) => setS({ ...s, default_currency: e.target.value })}>
            {Object.values(CURRENCIES).map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} ({c.symbol})
              </option>
            ))}
          </select>
        </div>
        <label className="flex items-start gap-3">
          <input type="checkbox" className="mt-1 h-4 w-4" checked={s.ai_disclosure} onChange={(e) => setS({ ...s, ai_disclosure: e.target.checked })} />
          <span>
            <span className="font-medium">Mention AI and software tools in descriptions</span>
            <span className="block text-sm text-slate">Etsy asks sellers to be open about how items are made. Recommended.</span>
          </span>
        </label>
        <button className="btn-primary" disabled={busy}>
          {busy ? 'Saving…' : 'Save settings'}
        </button>
      </form>
    </div>
  );
}
