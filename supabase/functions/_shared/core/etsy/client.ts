/**
 * Minimal, typed Etsy Open API v3 client covering what a digital-product shop
 * needs. Uses only fetch/FormData/Blob, so it runs in Deno, Node and browsers.
 * Calls must come from a server: the x-api-key header carries the shared secret.
 */

export const ETSY_API = 'https://api.etsy.com/v3/application';

export type WhoMade = 'i_did' | 'someone_else' | 'collective';
export type WhenMade = 'made_to_order' | '2020_2026' | '2010_2019';

export interface DraftListingInput {
  title: string;
  description: string;
  price: number;
  taxonomyId: number;
  tags: string[];
  quantity?: number;
  whoMade?: WhoMade;
  whenMade?: WhenMade;
  isSupply?: boolean;
  shouldAutoRenew?: boolean;
  shopSectionId?: number;
}

export interface EtsyListing {
  listing_id: number;
  title: string;
  state: string;
  url?: string;
  type?: string;
  price?: { amount: number; divisor: number; currency_code: string };
  [k: string]: unknown;
}

export interface TaxonomyNode {
  id: number;
  name: string;
  level: number;
  full_path_taxonomy_ids: number[];
  children: TaxonomyNode[];
}

export class EtsyApiError extends Error {
  constructor(
    public status: number,
    public body: string,
    public path: string,
  ) {
    super(`Etsy API ${status} on ${path}: ${body.slice(0, 400)}`);
  }
}

type Body = { form?: Record<string, string | number | boolean | string[] | undefined>; multipart?: FormData; json?: unknown };

export class EtsyClient {
  private keystring: string;
  private sharedSecret: string;
  private accessToken?: string;
  private fetchImpl: typeof fetch;
  private maxRetries: number;

  constructor(opts: { keystring: string; sharedSecret: string; accessToken?: string; fetch?: typeof fetch; maxRetries?: number }) {
    this.keystring = opts.keystring;
    this.sharedSecret = opts.sharedSecret;
    this.accessToken = opts.accessToken;
    this.fetchImpl = opts.fetch ?? fetch.bind(globalThis);
    this.maxRetries = opts.maxRetries ?? 3;
  }

  withToken(accessToken: string): EtsyClient {
    return new EtsyClient({
      keystring: this.keystring,
      sharedSecret: this.sharedSecret,
      accessToken,
      fetch: this.fetchImpl,
      maxRetries: this.maxRetries,
    });
  }

  async request<T>(method: string, path: string, body: Body = {}, query?: Record<string, string | number>): Promise<T> {
    const url = new URL(ETSY_API + path);
    for (const [k, v] of Object.entries(query ?? {})) url.searchParams.set(k, String(v));

    const headers: Record<string, string> = { 'x-api-key': `${this.keystring}:${this.sharedSecret}` };
    if (this.accessToken) headers.Authorization = `Bearer ${this.accessToken}`;

    let payload: BodyInit | undefined;
    if (body.form) {
      const p = new URLSearchParams();
      for (const [k, v] of Object.entries(body.form)) {
        if (v === undefined) continue;
        p.set(k, Array.isArray(v) ? v.join(',') : String(v));
      }
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
      payload = p.toString();
    } else if (body.json !== undefined) {
      headers['Content-Type'] = 'application/json';
      payload = JSON.stringify(body.json);
    } else if (body.multipart) {
      payload = body.multipart; // fetch sets the multipart boundary
    }

    for (let attempt = 0; ; attempt++) {
      const res = await this.fetchImpl(url.toString(), { method, headers, body: payload });
      if ((res.status === 429 || res.status >= 500) && attempt < this.maxRetries) {
        const retryAfter = Number(res.headers.get('retry-after'));
        const wait = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 500 * 2 ** attempt;
        await new Promise((r) => setTimeout(r, Math.min(wait, 10_000)));
        continue;
      }
      const text = await res.text();
      if (!res.ok) throw new EtsyApiError(res.status, text, path);
      return (text ? JSON.parse(text) : {}) as T;
    }
  }

  /* ------------------------------ Account ------------------------------ */

  getMe() {
    return this.request<{ user_id: number; shop_id: number }>('GET', '/users/me');
  }

  getShop(shopId: number) {
    return this.request<{ shop_id: number; shop_name: string; currency_code: string; url: string; listing_active_count: number }>(
      'GET',
      `/shops/${shopId}`,
    );
  }

  async getSellerTaxonomy(): Promise<TaxonomyNode[]> {
    const res = await this.request<{ results: TaxonomyNode[] }>('GET', '/seller-taxonomy/nodes');
    return res.results;
  }

  /* ------------------------------ Listings ------------------------------ */

  createDraftListing(shopId: number, l: DraftListingInput) {
    return this.request<EtsyListing>('POST', `/shops/${shopId}/listings`, {
      form: {
        quantity: l.quantity ?? 999,
        title: l.title,
        description: l.description,
        price: l.price.toFixed(2),
        who_made: l.whoMade ?? 'i_did',
        when_made: l.whenMade ?? 'made_to_order',
        taxonomy_id: l.taxonomyId,
        is_supply: l.isSupply ?? false,
        type: 'download',
        tags: l.tags,
        should_auto_renew: l.shouldAutoRenew ?? true,
        shop_section_id: l.shopSectionId,
      },
    });
  }

  updateListing(
    shopId: number,
    listingId: number,
    patch: Partial<{
      title: string;
      description: string;
      tags: string[];
      taxonomy_id: number;
      state: 'active' | 'inactive' | 'draft';
      type: 'download';
      should_auto_renew: boolean;
      shop_section_id: number;
    }>,
  ) {
    return this.request<EtsyListing>('PATCH', `/shops/${shopId}/listings/${listingId}`, { form: patch });
  }

  /** Price lives on the inventory/offering, not on the listing PATCH. */
  updatePrice(listingId: number, price: number, quantity = 999) {
    return this.request<unknown>('PUT', `/listings/${listingId}/inventory`, {
      json: {
        products: [{ sku: '', property_values: [], offerings: [{ price: Number(price.toFixed(2)), quantity, is_enabled: true }] }],
      },
    });
  }

  getListing(listingId: number) {
    return this.request<EtsyListing>('GET', `/listings/${listingId}`);
  }

  deleteListing(listingId: number) {
    return this.request<unknown>('DELETE', `/listings/${listingId}`);
  }

  getListingImages(listingId: number) {
    return this.request<{ count: number; results: { listing_image_id: number; rank: number }[] }>('GET', `/listings/${listingId}/images`);
  }

  deleteListingImage(shopId: number, listingId: number, imageId: number) {
    return this.request<unknown>('DELETE', `/shops/${shopId}/listings/${listingId}/images/${imageId}`);
  }

  uploadListingImage(shopId: number, listingId: number, image: Blob, opts: { name: string; rank: number; altText?: string }) {
    const fd = new FormData();
    fd.append('image', image, opts.name);
    fd.append('rank', String(opts.rank));
    if (opts.altText) fd.append('alt_text', opts.altText.slice(0, 250));
    return this.request<{ listing_image_id: number }>('POST', `/shops/${shopId}/listings/${listingId}/images`, { multipart: fd });
  }

  getListingFiles(shopId: number, listingId: number) {
    return this.request<{ count: number; results: { listing_file_id: number; filename: string; rank: number }[] }>(
      'GET',
      `/shops/${shopId}/listings/${listingId}/files`,
    );
  }

  deleteListingFile(shopId: number, listingId: number, fileId: number) {
    return this.request<unknown>('DELETE', `/shops/${shopId}/listings/${listingId}/files/${fileId}`);
  }

  uploadListingFile(shopId: number, listingId: number, file: Blob, opts: { name: string; rank: number }) {
    const fd = new FormData();
    fd.append('file', file, opts.name);
    fd.append('name', opts.name);
    fd.append('rank', String(opts.rank));
    return this.request<{ listing_file_id: number }>('POST', `/shops/${shopId}/listings/${listingId}/files`, { multipart: fd });
  }

  getShopReceipts(shopId: number, limit = 25) {
    return this.request<{ count: number; results: Record<string, unknown>[] }>('GET', `/shops/${shopId}/receipts`, {}, { limit });
  }
}

/** Flatten the taxonomy tree into searchable "A > B > C" paths (leaves only). */
export function flattenTaxonomy(nodes: TaxonomyNode[], prefix = ''): { id: number; path: string }[] {
  const out: { id: number; path: string }[] = [];
  for (const n of nodes) {
    const path = prefix ? `${prefix} > ${n.name}` : n.name;
    if (!n.children?.length) out.push({ id: n.id, path });
    else out.push(...flattenTaxonomy(n.children, path));
  }
  return out;
}
