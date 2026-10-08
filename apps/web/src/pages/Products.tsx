import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { StageRail } from '../components/StageRail';
import { store } from '../lib/store';
import type { EventRow, Product, ProductStatus } from '../lib/types';
import { timeAgo, useAssetUrl } from '../lib/useAsset';

const FILTERS: { key: 'all' | ProductStatus; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'draft', label: 'Draft' },
  { key: 'ready', label: 'Ready' },
  { key: 'on_etsy', label: 'On Etsy' },
  { key: 'live', label: 'Live' },
];

export function nextStepLabel(p: Product): string {
  switch (p.status) {
    case 'draft':
      return p.files.length ? 'Fix the listing' : 'Generate files';
    case 'ready':
      return 'Send to Etsy';
    case 'pushing':
      return 'Uploading…';
    case 'on_etsy':
      return 'Review and publish';
    case 'live':
      return 'Live';
    case 'error':
      return 'See what went wrong';
  }
}

function Row({ p }: { p: Product }) {
  const thumb = useAssetUrl(p.images[0]);
  const price = p.listing?.price;
  return (
    <li>
      <Link to={`/p/${p.id}`} className="grid grid-cols-[72px_1fr] items-center gap-4 rounded-xl px-3 py-3 hover:bg-card sm:grid-cols-[96px_1fr_auto_160px]">
        <div className="aspect-[5/4] overflow-hidden rounded-lg border border-rule bg-mist">
          {thumb && <img src={thumb} alt="" className="h-full w-full object-cover" />}
        </div>
        <div className="min-w-0">
          <p className="truncate font-semibold">{p.name}</p>
          <p className="truncate text-sm text-slate">
            {price ? `Price ${price.toFixed(2)}` : 'No price'}, updated {timeAgo(p.updated_at)}
          </p>
          <div className="mt-2 sm:hidden">
            <StageRail status={p.status} compact />
          </div>
        </div>
        <div className="hidden sm:block">
          <StageRail status={p.status} />
        </div>
        <p className={`hidden text-right text-sm font-semibold sm:block ${p.status === 'error' ? 'text-danger' : p.status === 'live' ? 'text-live' : 'text-ink'}`}>
          {nextStepLabel(p)}
        </p>
      </Link>
    </li>
  );
}

export function Products() {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['key']>('all');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    store.listProducts().then(setProducts).catch((e) => setError(e.message));
    store.listEvents(12).then(setEvents).catch(() => {});
  }, []);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: products?.length ?? 0 };
    for (const p of products ?? []) c[p.status === 'pushing' ? 'ready' : p.status] = (c[p.status] ?? 0) + 1;
    return c;
  }, [products]);
  const shown = (products ?? []).filter((p) => filter === 'all' || p.status === filter);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-10">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold md:text-4xl">Products</h1>
          <p className="mt-1 text-slate">Each product moves from draft to live. Nothing goes live until you publish it.</p>
        </div>
        <Link to="/new" className="btn-primary hidden sm:inline-flex">
          New product
        </Link>
      </header>

      {error && <p className="mt-6 rounded-lg bg-[#fbeeeb] p-3 text-sm text-danger">{error}</p>}

      <div className="mt-8 lg:grid lg:grid-cols-[1fr_280px] lg:gap-10">
        <section>
          <div className="flex gap-2 overflow-x-auto pb-2" role="tablist">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                role="tab"
                aria-selected={filter === f.key}
                onClick={() => setFilter(f.key)}
                className={`shrink-0 rounded-full px-3 py-1 text-sm ${filter === f.key ? 'bg-ink text-white' : 'border border-rule bg-card text-ink hover:bg-mist'}`}
              >
                {f.label} <span className="opacity-60">{counts[f.key] ?? 0}</span>
              </button>
            ))}
          </div>

          {products === null ? (
            <p className="mt-6 text-slate">Loading products…</p>
          ) : products.length === 0 ? (
            <div className="mt-6 rounded-xl border border-dashed border-rule p-8 text-center">
              <h2 className="text-xl font-bold">Make your first product</h2>
              <p className="mx-auto mt-2 max-w-sm text-slate">Pick a template, choose colours and currency, and the files, listing images and Etsy copy are made for you.</p>
              <Link to="/new" className="btn-primary mt-5">
                Choose a template
              </Link>
            </div>
          ) : shown.length === 0 ? (
            <p className="mt-6 text-slate">No products in this stage.</p>
          ) : (
            <ul className="mt-3 -mx-3 divide-y divide-rule">
              {shown.map((p) => (
                <Row key={p.id} p={p} />
              ))}
            </ul>
          )}
        </section>

        <aside className="mt-10 lg:mt-0">
          <h2 className="text-lg font-bold">Recent activity</h2>
          {events.length === 0 ? (
            <p className="mt-2 text-sm text-slate">Generated files, Etsy uploads and publishes will show up here.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {events.map((e) => (
                <li key={e.id} className="text-sm">
                  <p>{e.message}</p>
                  <p className="text-xs text-slate">{timeAgo(e.created_at)}</p>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </div>
  );
}
