import { createStore, del, get, set } from 'idb-keyval';
import { DEFAULT_SETTINGS, type EventRow, type NewProduct, type Product, type Settings, type StoredAsset, type Store } from './types';

// Local mode: everything lives in this browser (IndexedDB). Used when no
// Supabase project is configured, so the studio works before setup.
const db = createStore('etsy-autopilot', 'kv');

const now = () => new Date().toISOString();

async function all(): Promise<Product[]> {
  return (await get<Product[]>('products', db)) ?? [];
}
async function save(list: Product[]) {
  await set('products', list, db);
}

export const localStore: Store = {
  mode: 'local',

  async listProducts() {
    return (await all()).sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  },

  async getProduct(id) {
    return (await all()).find((p) => p.id === id) ?? null;
  },

  async createProduct(p: NewProduct) {
    const product: Product = {
      taxonomy_id: null,
      files: [],
      images: [],
      status: 'draft',
      etsy_listing_id: null,
      etsy_state: null,
      etsy_url: null,
      last_error: null,
      pushed_at: null,
      published_at: null,
      ...p,
      id: crypto.randomUUID(),
      created_at: now(),
      updated_at: now(),
    };
    await save([product, ...(await all())]);
    return product;
  },

  async updateProduct(id, patch) {
    const list = await all();
    const i = list.findIndex((p) => p.id === id);
    if (i < 0) throw new Error('Product not found');
    const next = { ...list[i]!, ...patch, id, updated_at: now() };
    list[i] = next;
    await save(list);
    return next;
  },

  async deleteProduct(id) {
    const p = await this.getProduct(id);
    if (p) await this.removeAssets([...p.files, ...p.images]);
    await save((await all()).filter((x) => x.id !== id));
  },

  async putAsset(productId, folder, name, blob) {
    const path = `local/${productId}/${folder}/${name}`;
    await set(`blob:${path}`, blob, db);
    return { path, name, mime: blob.type, size: blob.size };
  },

  async removeAssets(assets: StoredAsset[]) {
    await Promise.all(assets.map((a) => del(`blob:${a.path}`, db)));
  },

  async assetBlob(asset) {
    const b = await get<Blob>(`blob:${asset.path}`, db);
    if (!b) throw new Error(`${asset.name} is missing — regenerate the product`);
    return b;
  },

  async listEvents(limit = 30) {
    return ((await get<EventRow[]>('events', db)) ?? []).slice(0, limit);
  },

  async logEvent(productId, kind, message) {
    const list = (await get<EventRow[]>('events', db)) ?? [];
    list.unshift({ id: Date.now(), product_id: productId, kind, message, created_at: now() });
    await set('events', list.slice(0, 200), db);
  },

  async getSettings() {
    return { ...DEFAULT_SETTINGS, ...((await get<Settings>('settings', db)) ?? {}) };
  },

  async saveSettings(s) {
    await set('settings', s, db);
  },
};
