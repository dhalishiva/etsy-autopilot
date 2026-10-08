import type { ListingCopy, ProductSpec } from '@autopilot/core';

export type ProductStatus = 'draft' | 'ready' | 'pushing' | 'on_etsy' | 'live' | 'error';

export interface StoredAsset {
  path: string;
  name: string;
  mime: string;
  size: number;
  alt?: string;
}

export interface Product {
  id: string;
  template_id: string;
  name: string;
  params: Record<string, string>;
  spec: ProductSpec;
  listing: ListingCopy;
  taxonomy_id: number | null;
  files: StoredAsset[];
  images: StoredAsset[];
  status: ProductStatus;
  etsy_listing_id: number | null;
  etsy_state: string | null;
  etsy_url: string | null;
  last_error: string | null;
  pushed_at: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface EventRow {
  id: number;
  product_id: string | null;
  kind: string;
  message: string;
  created_at: string;
}

export interface Settings {
  brand: string;
  default_currency: string;
  default_taxonomy_id: number | null;
  ai_disclosure: boolean;
}

export interface EtsyConnection {
  shop_id: number | null;
  shop_name: string | null;
  shop_url: string | null;
  currency_code: string | null;
  connected_at: string;
}

export type NewProduct = Pick<Product, 'template_id' | 'name' | 'params' | 'spec' | 'listing'> & Partial<Product>;

export interface Store {
  readonly mode: 'cloud' | 'local';
  listProducts(): Promise<Product[]>;
  getProduct(id: string): Promise<Product | null>;
  createProduct(p: NewProduct): Promise<Product>;
  updateProduct(id: string, patch: Partial<Product>): Promise<Product>;
  deleteProduct(id: string): Promise<void>;
  putAsset(productId: string, folder: 'files' | 'images', name: string, blob: Blob): Promise<StoredAsset>;
  removeAssets(assets: StoredAsset[]): Promise<void>;
  assetBlob(asset: StoredAsset): Promise<Blob>;
  listEvents(limit?: number): Promise<EventRow[]>;
  logEvent(productId: string | null, kind: string, message: string): Promise<void>;
  getSettings(): Promise<Settings>;
  saveSettings(s: Settings): Promise<void>;
}

export const DEFAULT_SETTINGS: Settings = {
  brand: '',
  default_currency: 'USD',
  default_taxonomy_id: null,
  ai_disclosure: true,
};
