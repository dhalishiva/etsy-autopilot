import {
  generateProductFiles,
  getTemplate,
  previewSpreadsheet,
  ruleBasedCopy,
  validateListing,
  type GeneratedFile,
  type ProductSpec,
} from '@autopilot/core';
import { composeListingImages, type ListingImage } from '../mockups/compose';
import { renderPdfPages } from '../mockups/pdf';
import { SHEET_H, SHEET_W, drawSheet } from '../mockups/sheet';
import { store } from './store';
import type { Product, Settings } from './types';

export interface RenderedPage {
  label: string;
  canvas: HTMLCanvasElement;
}

/** Draw each tab / page of a product as a canvas (for previews and mockups). */
export async function renderPages(spec: ProductSpec, files?: GeneratedFile[]): Promise<RenderedPage[]> {
  await document.fonts.ready;
  if (spec.kind === 'spreadsheet') {
    const previews = previewSpreadsheet(spec);
    const tabs = previews.map((p) => p.name);
    return previews.map((p) => {
      const c = document.createElement('canvas');
      c.width = SHEET_W;
      c.height = SHEET_H;
      drawSheet(c.getContext('2d')!, p, spec.theme, tabs);
      return { label: p.name, canvas: c };
    });
  }
  const pdf = files?.[0] ?? (await generateProductFiles(spec))[0]!;
  const canvases = await renderPdfPages(pdf.bytes, 1100);
  return canvases.map((canvas, i) => {
    const p = spec.pages[i];
    return { label: p ? ('title' in p ? p.title : `Page ${i + 1}`) : `Page ${i + 1}`, canvas };
  });
}

export function buildSpec(templateId: string, params: Record<string, string>): ProductSpec {
  return getTemplate(templateId).build(params);
}

export function initialListing(templateId: string, params: Record<string, string>, settings: Settings) {
  const t = getTemplate(templateId);
  return ruleBasedCopy(t.seed(params), t.suggestedPriceUsd, { aiDisclosure: settings.ai_disclosure });
}

export interface BuildResult {
  files: GeneratedFile[];
  pages: RenderedPage[];
  images: ListingImage[];
}

/** Generate the deliverable files and the 5 listing images. */
export async function buildAssets(product: Pick<Product, 'template_id' | 'params' | 'spec'>, onStep?: (s: string) => void): Promise<BuildResult> {
  onStep?.('Generating files');
  const files = await generateProductFiles(product.spec);
  onStep?.('Rendering pages');
  const pages = await renderPages(product.spec, files);
  onStep?.('Composing listing images');
  const seed = getTemplate(product.template_id).seed(product.params);
  const images = await composeListingImages({ spec: product.spec, seed, pages });
  return { files, pages, images };
}

/** Build everything and save it to the store, replacing previous assets. */
export async function generateAndSave(product: Product, onStep?: (s: string) => void): Promise<Product> {
  const { files, images } = await buildAssets(product, onStep);
  onStep?.('Saving');
  await store.removeAssets([...product.files, ...product.images]);
  const storedFiles = [];
  for (const f of files) {
    storedFiles.push(await store.putAsset(product.id, 'files', f.name, new Blob([f.bytes as BlobPart], { type: f.mime })));
  }
  const storedImages = [];
  for (const img of images) {
    storedImages.push({ ...(await store.putAsset(product.id, 'images', img.name, img.blob)), alt: img.alt });
  }
  const ready = validateListing(product.listing).every((i) => i.severity !== 'error');
  const updated = await store.updateProduct(product.id, {
    files: storedFiles,
    images: storedImages,
    status: product.status === 'draft' || product.status === 'error' ? (ready ? 'ready' : 'draft') : product.status,
    last_error: null,
  });
  await store.logEvent(product.id, 'generated', `Generated ${files.length} file(s) and ${images.length} images`);
  return updated;
}
