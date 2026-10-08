import { useEffect, useState } from 'react';
import { store } from './store';
import type { StoredAsset } from './types';

/** Object URL for a stored asset (revoked on change/unmount). */
export function useAssetUrl(asset: StoredAsset | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!asset) {
      setUrl(null);
      return;
    }
    let alive = true;
    let made: string | null = null;
    store
      .assetBlob(asset)
      .then((b) => {
        if (!alive) return;
        made = URL.createObjectURL(b);
        setUrl(made);
      })
      .catch(() => alive && setUrl(null));
    return () => {
      alive = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [asset?.path, asset?.size]);
  return url;
}

export async function downloadAsset(asset: StoredAsset) {
  const blob = await store.assetBlob(asset);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = asset.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function timeAgo(iso: string | null): string {
  if (!iso) return '';
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}
