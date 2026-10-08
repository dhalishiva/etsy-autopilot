import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { ListingCopy, ListingIssue } from '@autopilot/core';
import { DEFAULT_SETTINGS, type EtsyConnection, type EventRow, type Product, type Store } from './types';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabase: SupabaseClient | null = url && anon ? createClient(url, anon) : null;

function sb(): SupabaseClient {
  if (!supabase) throw new Error('Cloud mode is not configured');
  return supabase;
}

async function uid(): Promise<string> {
  const { data } = await sb().auth.getUser();
  if (!data.user) throw new Error('Sign in first');
  return data.user.id;
}

function check<T>(r: { data: T; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message);
  return r.data;
}

export const cloudStore: Store = {
  mode: 'cloud',

  async listProducts() {
    return check(await sb().from('products').select('*').order('updated_at', { ascending: false })) as Product[];
  },

  async getProduct(id) {
    return check(await sb().from('products').select('*').eq('id', id).maybeSingle()) as Product | null;
  },

  async createProduct(p) {
    return check(await sb().from('products').insert(p).select('*').single()) as Product;
  },

  async updateProduct(id, patch) {
    const { id: _ignore, created_at: _c, updated_at: _u, ...rest } = patch as Product;
    return check(await sb().from('products').update(rest).eq('id', id).select('*').single()) as Product;
  },

  async deleteProduct(id) {
    const p = await this.getProduct(id);
    if (p) await this.removeAssets([...p.files, ...p.images]);
    check(await sb().from('products').delete().eq('id', id));
  },

  async putAsset(productId, folder, name, blob) {
    const path = `${await uid()}/${productId}/${folder}/${name}`;
    const { error } = await sb().storage.from('products').upload(path, blob, { upsert: true, contentType: blob.type });
    if (error) throw new Error(error.message);
    return { path, name, mime: blob.type, size: blob.size };
  },

  async removeAssets(assets) {
    if (!assets.length) return;
    await sb()
      .storage.from('products')
      .remove(assets.map((a) => a.path));
  },

  async assetBlob(asset) {
    const { data, error } = await sb().storage.from('products').download(asset.path);
    if (error || !data) throw new Error(`Could not load ${asset.name}`);
    return data;
  },

  async listEvents(limit = 30) {
    return (check(await sb().from('events').select('*').order('created_at', { ascending: false }).limit(limit)) ?? []) as EventRow[];
  },

  async logEvent(productId, kind, message) {
    await sb().from('events').insert({ product_id: productId, kind, message });
  },

  async getSettings() {
    const row = check(await sb().from('user_settings').select('*').maybeSingle());
    return { ...DEFAULT_SETTINGS, ...(row ?? {}) };
  },

  async saveSettings(s) {
    check(await sb().from('user_settings').upsert({ user_id: await uid(), ...s }));
  },
};

/* ------------------------- Edge function calls ------------------------- */

async function fn<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await sb().functions.invoke(name, { body });
  if (error) {
    // Surface the function's own error message when there is one.
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === 'function') {
      const j = await ctx.json().catch(() => null);
      if (j?.error) throw new Error(j.error);
    }
    throw new Error(error.message);
  }
  return data as T;
}

export const etsy = {
  status: () => fn<{ connected: boolean; connection: EtsyConnection | null }>('etsy-api', { action: 'status' }),
  connectUrl: (redirectTo: string) => fn<{ url: string }>('etsy-oauth', { redirectTo }),
  taxonomy: (q: string) => fn<{ results: { id: number; path: string }[]; total: number }>('etsy-api', { action: 'taxonomy', q }),
  push: (productId: string) => fn<Partial<Product>>('etsy-api', { action: 'push', productId }),
  publish: (productId: string) => fn<Partial<Product>>('etsy-api', { action: 'publish', productId }),
  unpublish: (productId: string) => fn<{ ok: true }>('etsy-api', { action: 'unpublish', productId }),
  sync: (productId: string) => fn<{ state: string | null; status: string }>('etsy-api', { action: 'sync', productId }),
  orders: () => fn<{ count: number; results: Record<string, unknown>[] }>('etsy-api', { action: 'orders', limit: 25 }),
  disconnect: () => fn<{ ok: true }>('etsy-api', { action: 'disconnect' }),
  aiCopy: (productId: string) => fn<{ copy: ListingCopy; issues: ListingIssue[] }>('ai-copy', { productId }),
};
