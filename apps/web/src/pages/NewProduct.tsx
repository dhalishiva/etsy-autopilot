import { TEMPLATES, THEMES, defaults, getTemplate, type Template } from '@autopilot/core';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../components/Toast';
import { buildSpec, generateAndSave, initialListing, renderPages } from '../lib/build';
import { store } from '../lib/store';
import { DEFAULT_SETTINGS, type Settings } from '../lib/types';

function Swatch({ themeId }: { themeId: string }) {
  const t = THEMES[themeId] ?? THEMES.sage!;
  return (
    <span className="inline-flex overflow-hidden rounded-full border border-rule" aria-hidden>
      {[t.primary, t.accent, t.surface].map((c) => (
        <span key={c} className="h-3 w-3" style={{ background: c }} />
      ))}
    </span>
  );
}

function TemplateCard({ t, onPick }: { t: Template; onPick: () => void }) {
  const theme = THEMES[t.params.find((p) => p.key === 'theme')?.default ?? 'sage'] ?? THEMES.sage!;
  return (
    <button onClick={onPick} className="panel group flex flex-col overflow-hidden text-left transition-colors hover:border-ink">
      {/* A miniature of the product's own look: its theme band and a hint of its format. */}
      <div className="h-24 p-3" style={{ background: theme.surface }}>
        <div className="h-5 rounded-sm" style={{ background: theme.primary }} />
        {t.kind === 'spreadsheet' ? (
          <div className="mt-2 grid grid-cols-4 gap-[3px]">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="h-2.5 rounded-[1px]" style={{ background: i < 4 ? theme.ink : i % 2 ? '#fff' : theme.muted, opacity: i < 4 ? 0.85 : 0.35 }} />
            ))}
          </div>
        ) : (
          <div className="mt-2 grid grid-cols-7 gap-[3px]">
            {Array.from({ length: 21 }).map((_, i) => (
              <div key={i} className="h-2.5 rounded-[1px] border" style={{ borderColor: theme.muted, opacity: 0.5 }} />
            ))}
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <p className="text-xs text-slate">
          {t.category} {t.kind === 'spreadsheet' ? 'spreadsheet' : 'printable PDF'}
        </p>
        <h3 className="mt-1 text-lg font-bold leading-tight">{t.name}</h3>
        <p className="mt-2 flex-1 text-sm text-slate">{t.blurb}</p>
        <p className="mt-3 text-sm font-semibold">Suggested price ${t.suggestedPriceUsd.toFixed(2)}</p>
      </div>
    </button>
  );
}

export function NewProduct() {
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [params, setParams] = useState<Record<string, string>>({});
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [previews, setPreviews] = useState<{ label: string; url: string }[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const toast = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    store.getSettings().then(setSettings).catch(() => {});
  }, []);

  const template = templateId ? getTemplate(templateId) : null;

  function pick(t: Template) {
    const seeded: Record<string, string> = {};
    if (settings.brand) seeded.brand = settings.brand;
    if (t.params.some((p) => p.key === 'currency')) seeded.currency = settings.default_currency;
    setParams(defaults(t.params, seeded));
    setTemplateId(t.id);
    window.scrollTo({ top: 0 });
  }

  const spec = useMemo(() => (template ? buildSpec(template.id, params) : null), [template, params]);

  // Live preview, debounced so typing a brand name doesn't re-render on every key.
  useEffect(() => {
    if (!spec) return;
    let alive = true;
    const t = setTimeout(async () => {
      const pages = await renderPages(spec);
      if (!alive) return;
      setPreviews(pages.slice(0, 4).map((p) => ({ label: p.label, url: p.canvas.toDataURL('image/jpeg', 0.8) })));
    }, 250);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [spec]);

  async function create() {
    if (!template || !spec) return;
    try {
      setBusy('Creating product');
      const product = await store.createProduct({
        template_id: template.id,
        name: template.name,
        params,
        spec,
        listing: initialListing(template.id, params, settings),
        taxonomy_id: settings.default_taxonomy_id,
      });
      const saved = await generateAndSave(product, setBusy);
      toast('Product created — review the listing next');
      navigate(`/p/${saved.id}`);
    } catch (e) {
      toast((e as Error).message, 'error');
      setBusy(null);
    }
  }

  if (!template) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-10">
        <h1 className="text-3xl font-extrabold md:text-4xl">New product</h1>
        <p className="mt-1 text-slate">Start from a template. You can change colours, currency and branding next.</p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TEMPLATES.map((t) => (
            <TemplateCard key={t.id} t={t} onPick={() => pick(t)} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-10">
      <button className="text-sm text-slate hover:text-ink" onClick={() => setTemplateId(null)}>
        ← All templates
      </button>
      <h1 className="mt-2 text-3xl font-extrabold md:text-4xl">{template.name}</h1>
      <p className="mt-1 max-w-2xl text-slate">{template.blurb}</p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[340px_1fr]">
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            create();
          }}
        >
          {template.params.map((f) => (
            <div key={f.key}>
              <label className="label" htmlFor={f.key}>
                {f.label}
              </label>
              {f.type === 'select' ? (
                <div className="flex items-center gap-3">
                  <select id={f.key} className="field" value={params[f.key]} onChange={(e) => setParams({ ...params, [f.key]: e.target.value })}>
                    {f.options!.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  {f.key === 'theme' && <Swatch themeId={params.theme ?? ''} />}
                </div>
              ) : (
                <input id={f.key} className="field" value={params[f.key] ?? ''} maxLength={40} onChange={(e) => setParams({ ...params, [f.key]: e.target.value })} />
              )}
              {f.help && <p className="mt-1 text-xs text-slate">{f.help}</p>}
            </div>
          ))}
          <button className="btn-primary w-full" disabled={!!busy}>
            {busy ? `${busy}…` : 'Create product'}
          </button>
          <p className="text-xs text-slate">Creates the files, 5 listing images and a first draft of the Etsy listing. Nothing is sent to Etsy yet.</p>
        </form>

        <section aria-label="Preview">
          {previews[0] && <img src={previews[0].url} alt={`${previews[0].label} preview`} className="w-full rounded-lg border border-rule bg-white" />}
          <div className="mt-3 grid grid-cols-3 gap-3">
            {previews.slice(1).map((p) => (
              <figure key={p.label}>
                <img src={p.url} alt="" className="w-full rounded-md border border-rule bg-white" />
                <figcaption className="mt-1 truncate text-xs text-slate">{p.label}</figcaption>
              </figure>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
