// Authenticated Etsy actions for the signed-in user.
// POST { action, ... }:
//   status                        → connection summary
//   taxonomy   { q? }             → leaf categories matching q
//   push       { productId }      → create/refresh the Etsy *draft* (never publishes)
//   publish    { productId }      → make the draft live (explicit human step)
//   unpublish  { productId }      → deactivate a live listing
//   sync       { productId }      → pull the listing state from Etsy
//   orders     { limit? }         → recent receipts
//   disconnect                    → forget tokens
import type { SupabaseClient } from '@supabase/supabase-js';
import { flattenTaxonomy, publishListing, pushDraft, type PushAsset } from '../_shared/core/etsy/index.ts';
import { autoFix, validateListing, type ListingCopy } from '../_shared/core/listing/index.ts';
import { baseClient, clientFor } from '../_shared/etsy.ts';
import { HttpError, admin, handle, json, requireUser } from '../_shared/http.ts';

let taxonomyCache: { id: number; path: string }[] | null = null;

interface StoredAsset {
  path: string;
  name: string;
  mime?: string;
  alt?: string;
}

async function loadProduct(db: SupabaseClient, userId: string, productId: string) {
  const { data, error } = await db.from('products').select('*').eq('id', productId).eq('user_id', userId).maybeSingle();
  if (error) throw new HttpError(500, error.message);
  if (!data) throw new HttpError(404, 'Product not found');
  return data;
}

async function download(db: SupabaseClient, userId: string, a: StoredAsset): Promise<PushAsset> {
  if (!a.path.startsWith(`${userId}/`)) throw new HttpError(403, 'Asset outside your folder');
  const { data, error } = await db.storage.from('products').download(a.path);
  if (error || !data) throw new HttpError(500, `Could not read ${a.name}: ${error?.message ?? 'missing'}`);
  return { name: a.name, blob: data, altText: a.alt };
}

async function log(db: SupabaseClient, userId: string, productId: string | null, kind: string, message: string) {
  await db.from('events').insert({ user_id: userId, product_id: productId, kind, message });
}

Deno.serve(
  handle(async (req) => {
    if (req.method !== 'POST') return json({ error: 'Use POST' }, 405);
    const user = await requireUser(req);
    const db = admin();
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const action = String(body.action ?? '');
    const productId = typeof body.productId === 'string' ? body.productId : '';

    switch (action) {
      case 'status': {
        const { data } = await db.from('etsy_connections').select('*').eq('user_id', user.id).maybeSingle();
        return json({ connected: !!data, connection: data });
      }

      case 'taxonomy': {
        taxonomyCache ??= flattenTaxonomy(await baseClient().getSellerTaxonomy());
        const q = String(body.q ?? '').toLowerCase().trim();
        const words = q.split(/\s+/).filter(Boolean);
        const hits = words.length ? taxonomyCache.filter((t) => words.every((w) => t.path.toLowerCase().includes(w))) : taxonomyCache;
        return json({ results: hits.slice(0, 50), total: hits.length });
      }

      case 'push': {
        const p = await loadProduct(db, user.id, productId);
        if (!p.taxonomy_id) throw new HttpError(422, 'Pick an Etsy category first');
        const copy = autoFix(p.listing as ListingCopy);
        const errors = validateListing(copy).filter((i) => i.severity === 'error');
        if (errors.length) throw new HttpError(422, errors.map((e) => e.message).join('; '));
        const images = (p.images as StoredAsset[]) ?? [];
        const files = (p.files as StoredAsset[]) ?? [];
        if (!images.length || !files.length) throw new HttpError(422, 'Generate the files and mockups first');

        await db.from('products').update({ status: 'pushing', last_error: null }).eq('id', p.id);
        try {
          const { client, shopId } = await clientFor(db, user.id);
          const result = await pushDraft(client, {
            shopId,
            copy,
            taxonomyId: Number(p.taxonomy_id),
            images: await Promise.all(images.map((a) => download(db, user.id, a))),
            files: await Promise.all(files.map((a) => download(db, user.id, a))),
            existingListingId: p.etsy_listing_id ? Number(p.etsy_listing_id) : null,
          });
          const update = {
            status: 'on_etsy',
            etsy_listing_id: result.listingId,
            etsy_state: 'draft',
            etsy_url: `https://www.etsy.com/your/shops/me/listing-editor/edit/${result.listingId}`,
            listing: copy,
            pushed_at: new Date().toISOString(),
          };
          await db.from('products').update(update).eq('id', p.id);
          await log(db, user.id, p.id, 'pushed', `Draft ready on Etsy (#${result.listingId})`);
          return json({ ok: true, ...update });
        } catch (e) {
          const message = (e as Error).message;
          await db.from('products').update({ status: 'error', last_error: message }).eq('id', p.id);
          await log(db, user.id, p.id, 'error', message.slice(0, 500));
          throw e instanceof HttpError ? e : new HttpError(502, message);
        }
      }

      case 'publish': {
        const p = await loadProduct(db, user.id, productId);
        if (!p.etsy_listing_id) throw new HttpError(409, 'Push the draft to Etsy first');
        const { client, shopId } = await clientFor(db, user.id);
        const listing = await publishListing(client, shopId, Number(p.etsy_listing_id));
        const update = {
          status: 'live',
          etsy_state: listing.state ?? 'active',
          etsy_url: listing.url ?? `https://www.etsy.com/listing/${p.etsy_listing_id}`,
          published_at: new Date().toISOString(),
        };
        await db.from('products').update(update).eq('id', p.id);
        await log(db, user.id, p.id, 'published', 'Listing is live on Etsy');
        return json({ ok: true, ...update });
      }

      case 'unpublish': {
        const p = await loadProduct(db, user.id, productId);
        if (!p.etsy_listing_id) throw new HttpError(409, 'Not on Etsy');
        const { client, shopId } = await clientFor(db, user.id);
        await client.updateListing(shopId, Number(p.etsy_listing_id), { state: 'inactive' });
        await db.from('products').update({ status: 'on_etsy', etsy_state: 'inactive' }).eq('id', p.id);
        await log(db, user.id, p.id, 'unpublished', 'Listing deactivated');
        return json({ ok: true });
      }

      case 'sync': {
        const p = await loadProduct(db, user.id, productId);
        if (!p.etsy_listing_id) return json({ ok: true, state: null });
        const { client } = await clientFor(db, user.id);
        const l = await client.getListing(Number(p.etsy_listing_id));
        const status = l.state === 'active' ? 'live' : 'on_etsy';
        await db.from('products').update({ etsy_state: l.state, status, etsy_url: l.url ?? p.etsy_url }).eq('id', p.id);
        return json({ ok: true, state: l.state, status });
      }

      case 'orders': {
        const { client, shopId } = await clientFor(db, user.id);
        const r = await client.getShopReceipts(shopId, Math.min(Number(body.limit ?? 25), 100));
        return json(r);
      }

      case 'disconnect': {
        await db.from('etsy_tokens').delete().eq('user_id', user.id);
        await db.from('etsy_connections').delete().eq('user_id', user.id);
        await log(db, user.id, null, 'disconnected', 'Etsy shop disconnected');
        return json({ ok: true });
      }

      default:
        throw new HttpError(400, `Unknown action "${action}"`);
    }
  }),
);
