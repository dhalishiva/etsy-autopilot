import { DESCRIPTION_MAX, TITLE_MAX, getTemplate, validateListing, type ListingCopy } from '@autopilot/core';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { StageRail } from '../components/StageRail';
import { TagEditor } from '../components/TagEditor';
import { TaxonomyPicker } from '../components/TaxonomyPicker';
import { useToast } from '../components/Toast';
import { buildSpec, generateAndSave } from '../lib/build';
import { isCloud, store } from '../lib/store';
import { etsy } from '../lib/supabase';
import type { EtsyConnection, Product, StoredAsset } from '../lib/types';
import { downloadAsset, timeAgo, useAssetUrl } from '../lib/useAsset';

function Thumb({ asset, active, onClick }: { asset: StoredAsset; active: boolean; onClick: () => void }) {
  const url = useAssetUrl(asset);
  return (
    <button onClick={onClick} className={`overflow-hidden rounded-md border-2 ${active ? 'border-ink' : 'border-transparent'}`} aria-label={asset.alt ?? asset.name}>
      {url ? <img src={url} alt="" className="aspect-[5/4] w-full object-cover" /> : <div className="aspect-[5/4] bg-mist" />}
    </button>
  );
}

function Gallery({ images }: { images: StoredAsset[] }) {
  const [i, setI] = useState(0);
  const main = useAssetUrl(images[i]);
  if (!images.length) return <div className="grid aspect-[5/4] place-items-center rounded-xl border border-dashed border-rule text-slate">No images yet</div>;
  return (
    <div>
      <div className="overflow-hidden rounded-xl border border-rule bg-mist">
        {main ? <img src={main} alt={images[i]?.alt ?? ''} className="aspect-[5/4] w-full object-cover" /> : <div className="aspect-[5/4]" />}
      </div>
      <div className="mt-2 grid grid-cols-5 gap-2">
        {images.map((a, n) => (
          <Thumb key={a.path} asset={a} active={n === i} onClick={() => setI(n)} />
        ))}
      </div>
    </div>
  );
}

export function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [p, setP] = useState<Product | null>(null);
  const [copy, setCopy] = useState<ListingCopy | null>(null);
  const [params, setParams] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [conn, setConn] = useState<EtsyConnection | null | undefined>(isCloud ? undefined : null);
  const [taxLabel, setTaxLabel] = useState<string | null>(null);

  useEffect(() => {
    store.getProduct(id!).then((x) => {
      setP(x);
      if (x) {
        setCopy(x.listing);
        setParams(x.params);
      }
    });
    if (isCloud) etsy.status().then((s) => setConn(s.connection)).catch(() => setConn(null));
  }, [id]);

  const issues = useMemo(() => (copy ? validateListing(copy) : []), [copy]);
  const errors = issues.filter((i) => i.severity === 'error');
  const dirty = !!p && !!copy && JSON.stringify(copy) !== JSON.stringify(p.listing);
  const paramsDirty = !!p && JSON.stringify(params) !== JSON.stringify(p.params);
  const staleOnEtsy = !!p?.pushed_at && new Date(p.updated_at).getTime() - new Date(p.pushed_at).getTime() > 5000 && p.status !== 'live';

  if (p === null && !busy) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <p className="text-slate">Loading…</p>
      </div>
    );
  }
  if (!p || !copy) return null;
  const template = getTemplate(p.template_id);

  async function run<T>(label: string, fn: () => Promise<T>, done?: string): Promise<T | undefined> {
    setBusy(label);
    try {
      const r = await fn();
      if (done) toast(done);
      return r;
    } catch (e) {
      toast((e as Error).message, 'error');
      const fresh = await store.getProduct(p!.id);
      if (fresh) setP(fresh);
    } finally {
      setBusy(null);
    }
  }

  async function saveListing(): Promise<Product> {
    const ok = validateListing(copy!).every((i) => i.severity !== 'error');
    const status = p!.status === 'draft' && ok && p!.files.length ? 'ready' : p!.status;
    const next = await store.updateProduct(p!.id, { listing: copy!, status });
    setP(next);
    return next;
  }

  const regenerate = () =>
    run(
      'Regenerating',
      async () => {
        const spec = buildSpec(p.template_id, params);
        const updated = await store.updateProduct(p.id, { params, spec });
        setP(await generateAndSave(updated, setBusy));
      },
      'Files and images updated',
    );

  const writeWithAi = () =>
    run(
      'Writing with AI',
      async () => {
        if (dirty) await saveListing();
        const r = await etsy.aiCopy(p.id);
        setCopy({ ...r.copy, price: copy.price });
      },
      'New copy drafted — review it, then save',
    );

  const pushToEtsy = () =>
    run(
      'Sending to Etsy',
      async () => {
        await saveListing();
        await etsy.push(p.id);
        setP(await store.getProduct(p.id));
      },
      'Draft is on Etsy — review it there, then publish',
    );

  const publish = () => {
    if (!window.confirm('Publish this listing on Etsy? It becomes visible to buyers and Etsy charges its $0.20 listing fee.')) return;
    return run(
      'Publishing',
      async () => {
        await etsy.publish(p.id);
        setP(await store.getProduct(p.id));
      },
      'Published on Etsy',
    );
  };

  const unpublish = () =>
    run(
      'Unpublishing',
      async () => {
        await etsy.unpublish(p.id);
        setP(await store.getProduct(p.id));
      },
      'Listing deactivated on Etsy',
    );

  const remove = () => {
    const extra = p.etsy_listing_id ? ' The Etsy listing itself is not deleted.' : '';
    if (!window.confirm(`Delete “${p.name}” and its files?${extra}`)) return;
    return run('Deleting', async () => {
      await store.deleteProduct(p.id);
      navigate('/');
    });
  };

  const setTaxonomy = (taxId: number, path: string) =>
    run('Saving category', async () => {
      setTaxLabel(path);
      setP(await store.updateProduct(p.id, { taxonomy_id: taxId }));
    });

  /* The single next action for this product. */
  let primary: { label: string; onClick?: () => void; href?: string; tone?: 'live' } | null = null;
  if (errors.length) primary = { label: 'Fix the listing below' };
  else if (!p.files.length) primary = { label: 'Generate files', onClick: regenerate };
  else if (!isCloud) primary = { label: 'Download listing images', onClick: () => p.images.forEach((a) => downloadAsset(a)) };
  else if (conn === null) primary = { label: 'Connect your Etsy shop', href: '/shop' };
  else if (!p.taxonomy_id) primary = { label: 'Pick an Etsy category below' };
  else if (p.status === 'ready' || p.status === 'error' || p.status === 'draft' || staleOnEtsy) primary = { label: p.etsy_listing_id ? 'Update the Etsy draft' : 'Send to Etsy as a draft', onClick: pushToEtsy };
  else if (p.status === 'on_etsy') primary = { label: 'Publish on Etsy', onClick: publish, tone: 'live' };
  else if (p.status === 'live' && p.etsy_url) primary = { label: 'View on Etsy', href: p.etsy_url };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-10">
      <Link to="/" className="text-sm text-slate hover:text-ink">
        ← Products
      </Link>

      <header className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold md:text-4xl">{p.name}</h1>
          <div className="mt-4">
            <StageRail status={busy === 'Sending to Etsy' ? 'pushing' : p.status} />
          </div>
        </div>
        {primary &&
          (primary.href ? (
            primary.href.startsWith('http') ? (
              <a className="btn-live" href={primary.href} target="_blank" rel="noreferrer">
                {primary.label}
              </a>
            ) : (
              <Link className="btn-primary" to={primary.href}>
                {primary.label}
              </Link>
            )
          ) : (
            <button className={primary.tone === 'live' ? 'btn-live' : 'btn-primary'} disabled={!!busy || !primary.onClick} onClick={primary.onClick}>
              {busy ? `${busy}…` : primary.label}
            </button>
          ))}
      </header>

      {p.status === 'error' && p.last_error && (
        <p className="mt-4 rounded-lg bg-[#fbeeeb] p-3 text-sm text-danger">Last Etsy upload failed: {p.last_error}</p>
      )}
      {staleOnEtsy && p.status === 'on_etsy' && (
        <p className="mt-4 rounded-lg bg-[#fdf4e2] p-3 text-sm">You changed this product after sending it. Update the Etsy draft so Etsy has the latest version.</p>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        {/* Left: what the buyer sees and gets */}
        <section className="space-y-6">
          <Gallery images={p.images} />

          <div className="panel p-4">
            <h2 className="text-lg font-bold">Files the buyer downloads</h2>
            <ul className="mt-2 divide-y divide-rule">
              {p.files.map((f) => (
                <li key={f.path} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="truncate">{f.name}</span>
                  <span className="flex shrink-0 items-center gap-3 text-slate">
                    {Math.round(f.size / 1024)} KB
                    <button className="font-semibold text-ink hover:underline" onClick={() => downloadAsset(f)}>
                      Download
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="panel p-4">
            <h2 className="text-lg font-bold">Customise</h2>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              {template.params.map((f) => (
                <div key={f.key}>
                  <label className="label" htmlFor={`p-${f.key}`}>
                    {f.label}
                  </label>
                  {f.type === 'select' ? (
                    <select id={`p-${f.key}`} className="field" value={params[f.key] ?? f.default} onChange={(e) => setParams({ ...params, [f.key]: e.target.value })}>
                      {f.options!.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input id={`p-${f.key}`} className="field" value={params[f.key] ?? ''} onChange={(e) => setParams({ ...params, [f.key]: e.target.value })} />
                  )}
                </div>
              ))}
            </div>
            <button className="btn-quiet mt-4" disabled={!!busy} onClick={regenerate}>
              {paramsDirty ? 'Apply and regenerate' : 'Regenerate files and images'}
            </button>
          </div>
        </section>

        {/* Right: the Etsy listing */}
        <section className="space-y-6">
          <div className="panel p-4 md:p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-bold">Etsy listing</h2>
              {isCloud && (
                <button className="btn-quiet" disabled={!!busy} onClick={writeWithAi}>
                  Write with AI
                </button>
              )}
            </div>

            <div className="mt-4">
              <div className="flex items-baseline justify-between">
                <label className="label" htmlFor="title">
                  Title
                </label>
                <span className={`text-xs ${copy.title.length > TITLE_MAX ? 'text-danger' : 'text-slate'}`}>
                  {copy.title.length}/{TITLE_MAX}
                </span>
              </div>
              <textarea id="title" rows={2} className="field resize-none" value={copy.title} onChange={(e) => setCopy({ ...copy, title: e.target.value })} />
            </div>

            <div className="mt-4 max-w-[200px]">
              <label className="label" htmlFor="price">
                Price {conn?.currency_code ? `(${conn.currency_code})` : ''}
              </label>
              <input
                id="price"
                type="number"
                min={0.2}
                step={0.01}
                className="field"
                value={copy.price}
                onChange={(e) => setCopy({ ...copy, price: Number(e.target.value) })}
              />
            </div>

            <div className="mt-4">
              <span className="label">Tags ({copy.tags.length}/13)</span>
              <TagEditor tags={copy.tags} onChange={(tags) => setCopy({ ...copy, tags })} />
            </div>

            <div className="mt-4">
              <div className="flex items-baseline justify-between">
                <label className="label" htmlFor="desc">
                  Description
                </label>
                <span className="text-xs text-slate">
                  {copy.description.length.toLocaleString()}/{DESCRIPTION_MAX.toLocaleString()}
                </span>
              </div>
              <textarea id="desc" rows={14} className="field font-sans text-sm" value={copy.description} onChange={(e) => setCopy({ ...copy, description: e.target.value })} />
            </div>

            {issues.length > 0 && (
              <ul className="mt-4 space-y-1 text-sm">
                {issues.map((i, n) => (
                  <li key={n} className={i.severity === 'error' ? 'text-danger' : 'text-slate'}>
                    {i.severity === 'error' ? 'Must fix: ' : 'Tip: '}
                    {i.message}
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-5 flex gap-2">
              <button className="btn-primary" disabled={!dirty || !!busy} onClick={() => run('Saving', saveListing, 'Listing saved')}>
                Save listing
              </button>
              {dirty && (
                <button className="btn-quiet" onClick={() => setCopy(p.listing)}>
                  Discard changes
                </button>
              )}
            </div>
          </div>

          {isCloud ? (
            <div className="panel p-4 md:p-5">
              <h2 className="text-lg font-bold">On Etsy</h2>
              {conn === null && (
                <p className="mt-2 text-sm text-slate">
                  <Link to="/shop" className="font-semibold text-ink underline">
                    Connect your Etsy shop
                  </Link>{' '}
                  to send this product as a draft.
                </p>
              )}
              <div className="mt-3">
                <span className="label">Category</span>
                {taxLabel && <p className="mb-2 text-sm">{taxLabel}</p>}
                <TaxonomyPicker value={p.taxonomy_id} onChange={setTaxonomy} />
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
                <dt className="text-slate">Etsy listing</dt>
                <dd>{p.etsy_listing_id ? `#${p.etsy_listing_id}` : 'Not sent yet'}</dd>
                <dt className="text-slate">Etsy state</dt>
                <dd>{p.etsy_state ?? '—'}</dd>
                <dt className="text-slate">Last sent</dt>
                <dd>{p.pushed_at ? timeAgo(p.pushed_at) : '—'}</dd>
              </dl>
              <div className="mt-4 flex flex-wrap gap-2">
                {p.etsy_url && (
                  <a className="btn-quiet" href={p.etsy_url} target="_blank" rel="noreferrer">
                    Open on Etsy
                  </a>
                )}
                {p.etsy_listing_id && (
                  <button
                    className="btn-quiet"
                    disabled={!!busy}
                    onClick={() =>
                      run('Checking Etsy', async () => {
                        await etsy.sync(p.id);
                        setP(await store.getProduct(p.id));
                      }, 'Status updated from Etsy')
                    }
                  >
                    Refresh status
                  </button>
                )}
                {p.status === 'live' && (
                  <button className="btn-quiet" disabled={!!busy} onClick={unpublish}>
                    Unpublish
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="panel p-4 text-sm text-slate md:p-5">
              <h2 className="text-lg font-bold text-ink">Sending to Etsy</h2>
              <p className="mt-2">
                You’re in local mode, so this product only lives in this browser. Connect the app to Supabase (see the README) to sign in, link your Etsy shop and send
                listings as drafts. Until then, download the files and images and list them by hand.
              </p>
            </div>
          )}

          <button className="btn-danger" onClick={remove} disabled={!!busy}>
            Delete product
          </button>
        </section>
      </div>
    </div>
  );
}
