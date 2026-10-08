import type { ListingCopy } from '../listing/index.ts';
import type { EtsyClient } from './client.ts';

export interface PushAsset {
  name: string;
  blob: Blob;
  altText?: string;
}

export interface PushInput {
  shopId: number;
  copy: ListingCopy;
  taxonomyId: number;
  images: PushAsset[];
  files: PushAsset[];
  /** Update this draft instead of creating a new one (re-push after edits). */
  existingListingId?: number | null;
  onProgress?: (step: string) => void;
}

export interface PushResult {
  listingId: number;
  imageIds: number[];
  fileIds: number[];
}

/**
 * Create (or refresh) an Etsy *draft* for a digital product. Never publishes —
 * going live is a separate, explicit step so a human always reviews first.
 * Re-running is safe: existing images/files on the draft are replaced.
 */
export async function pushDraft(client: EtsyClient, input: PushInput): Promise<PushResult> {
  const { shopId, copy } = input;
  const log = input.onProgress ?? (() => {});
  if (!input.images.length) throw new Error('At least one listing image is required');
  if (input.images.length > 10) throw new Error('Etsy allows at most 10 images per listing');
  if (!input.files.length) throw new Error('At least one digital file is required');
  if (input.files.length > 5) throw new Error('Etsy allows at most 5 digital files per listing');

  let listingId = input.existingListingId ?? null;
  if (listingId) {
    log('Updating Etsy draft');
    await client.updateListing(shopId, listingId, {
      title: copy.title,
      description: copy.description,
      tags: copy.tags,
      taxonomy_id: input.taxonomyId,
      type: 'download',
    });
    await client.updatePrice(listingId, copy.price);
    const [imgs, files] = await Promise.all([client.getListingImages(listingId), client.getListingFiles(shopId, listingId)]);
    for (const i of imgs.results) await client.deleteListingImage(shopId, listingId, i.listing_image_id);
    for (const f of files.results) await client.deleteListingFile(shopId, listingId, f.listing_file_id);
  } else {
    log('Creating Etsy draft');
    const created = await client.createDraftListing(shopId, {
      title: copy.title,
      description: copy.description,
      price: copy.price,
      tags: copy.tags,
      taxonomyId: input.taxonomyId,
    });
    listingId = created.listing_id;
    // Some accounts ignore `type` on create; make sure it's a digital listing.
    if (created.type && created.type !== 'download') {
      await client.updateListing(shopId, listingId, { type: 'download' });
    }
  }

  const imageIds: number[] = [];
  for (const [i, img] of input.images.entries()) {
    log(`Uploading image ${i + 1}/${input.images.length}`);
    const r = await client.uploadListingImage(shopId, listingId, img.blob, { name: img.name, rank: i + 1, altText: img.altText });
    imageIds.push(r.listing_image_id);
  }

  const fileIds: number[] = [];
  for (const [i, f] of input.files.entries()) {
    log(`Uploading file ${i + 1}/${input.files.length}`);
    const r = await client.uploadListingFile(shopId, listingId, f.blob, { name: f.name, rank: i + 1 });
    fileIds.push(r.listing_file_id);
  }

  log('Draft ready on Etsy');
  return { listingId, imageIds, fileIds };
}

export async function publishListing(client: EtsyClient, shopId: number, listingId: number) {
  return client.updateListing(shopId, listingId, { state: 'active' });
}
