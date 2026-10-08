import type { ListingSeed, ProductSpec, Theme } from '@autopilot/core';

/**
 * Compose the 5 Etsy listing images from rendered product pages.
 * 2000 × 1600 (5:4) JPEGs — crisp on zoom and small enough to upload fast.
 */

export const IMG_W = 2000;
export const IMG_H = 1600;
const DISPLAY = '"Bricolage Grotesque", Georgia, serif';
const SANS = '"Instrument Sans", "Segoe UI", Arial, sans-serif';

export interface ListingImage {
  name: string;
  alt: string;
  blob: Blob;
  url: string;
}

function canvas(): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = IMG_W;
  c.height = IMG_H;
  return [c, c.getContext('2d')!];
}

function wrap(ctx: CanvasRenderingContext2D, text: string, max: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const w of text.split(' ')) {
    const next = line ? `${line} ${w}` : w;
    if (ctx.measureText(next).width > max && line) {
      lines.push(line);
      line = w;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function background(ctx: CanvasRenderingContext2D, theme: Theme) {
  ctx.fillStyle = theme.surface;
  ctx.fillRect(0, 0, IMG_W, IMG_H);
  // One quiet geometric block in the theme colour anchors every image in the set.
  ctx.fillStyle = theme.primary;
  ctx.globalAlpha = 0.08;
  ctx.beginPath();
  ctx.arc(IMG_W * 0.86, IMG_H * 0.1, 620, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function chip(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, fill: string, color: string): number {
  ctx.font = `600 34px ${SANS}`;
  const w = ctx.measureText(text).width + 56;
  ctx.fillStyle = fill;
  roundRect(ctx, x, y, w, 70, 35);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.fillText(text, x + 28, y + 47);
  return w;
}

function shadow(ctx: CanvasRenderingContext2D, blur = 60, y = 24) {
  ctx.shadowColor = 'rgba(20, 28, 40, 0.22)';
  ctx.shadowBlur = blur;
  ctx.shadowOffsetY = y;
}
function noShadow(ctx: CanvasRenderingContext2D) {
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
}

/** Laptop with `screen` fitted (cover) into a 16:10 display. Returns nothing; draws at (x, y) with width w. */
function laptop(ctx: CanvasRenderingContext2D, screen: HTMLCanvasElement, x: number, y: number, w: number) {
  const bezel = w * 0.025;
  const sw = w - bezel * 2;
  const sh = sw * 0.625;
  shadow(ctx, 80, 40);
  ctx.fillStyle = '#1C1F24';
  roundRect(ctx, x, y, w, sh + bezel * 2, w * 0.025);
  ctx.fill();
  noShadow(ctx);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x + bezel, y + bezel, sw, sh);
  ctx.clip();
  const scale = Math.max(sw / screen.width, sh / screen.height);
  ctx.drawImage(screen, x + bezel, y + bezel, screen.width * scale, screen.height * scale);
  ctx.restore();
  // Base
  const by = y + sh + bezel * 2;
  ctx.fillStyle = '#C9CDD3';
  ctx.beginPath();
  ctx.moveTo(x - w * 0.06, by);
  ctx.lineTo(x + w * 1.06, by);
  ctx.lineTo(x + w * 1.02, by + w * 0.035);
  ctx.lineTo(x - w * 0.02, by + w * 0.035);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#AEB3BA';
  ctx.fillRect(x + w * 0.42, by, w * 0.16, w * 0.012);
}

/** A sheet of paper with a soft shadow, optionally rotated around its centre. */
function paper(ctx: CanvasRenderingContext2D, page: HTMLCanvasElement, cx: number, cy: number, h: number, angle = 0) {
  const w = (page.width / page.height) * h;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  shadow(ctx, 50, 20);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(-w / 2, -h / 2, w, h);
  noShadow(ctx);
  ctx.drawImage(page, -w / 2, -h / 2, w, h);
  ctx.restore();
}

function brandMark(ctx: CanvasRenderingContext2D, theme: Theme, brand?: string) {
  if (!brand) return;
  ctx.font = `600 32px ${SANS}`;
  ctx.fillStyle = theme.muted;
  ctx.fillText(brand, 110, IMG_H - 80);
}

function heading(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, max: number, size: number, color: string): number {
  ctx.font = `800 ${size}px ${DISPLAY}`;
  ctx.fillStyle = color;
  const lines = wrap(ctx, text, max);
  lines.forEach((l, i) => ctx.fillText(l, x, y + i * size * 1.08));
  return y + lines.length * size * 1.08;
}

async function toImage(c: HTMLCanvasElement, name: string, alt: string): Promise<ListingImage> {
  const blob = await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Canvas export failed'))), 'image/jpeg', 0.9));
  return { name, alt, blob, url: URL.createObjectURL(blob) };
}

/** The table tab with the most example data and calculated columns makes the best close-up. */
function pickRichest(spec: ProductSpec, content: { label: string; canvas: HTMLCanvasElement }[], hero: { label: string }) {
  if (spec.kind !== 'spreadsheet') return content[0]!;
  let best = content.find((p) => p !== hero) ?? content[0]!;
  let score = -1;
  for (const sheet of spec.sheets) {
    if (sheet.kind !== 'table') continue;
    const sc = (sheet.sampleRows?.length ?? 0) * 2 + sheet.columns.filter((c) => c.type === 'formula').length;
    const page = content.find((p) => p.label === sheet.name);
    if (page && sc > score) {
      best = page;
      score = sc;
    }
  }
  return best;
}

export interface ComposeInput {
  spec: ProductSpec;
  seed: ListingSeed;
  /** Rendered sheets (spreadsheet) or pages (printable), in order. */
  pages: { label: string; canvas: HTMLCanvasElement }[];
}

export async function composeListingImages({ spec, seed, pages }: ComposeInput): Promise<ListingImage[]> {
  await Promise.all([
    document.fonts.load(`800 100px ${DISPLAY}`),
    document.fonts.load(`600 34px ${SANS}`),
    document.fonts.load(`400 34px ${SANS}`),
  ]).catch(() => undefined);
  await document.fonts.ready;
  const theme = spec.theme;
  const isSheet = spec.kind === 'spreadsheet';
  const content = isSheet ? pages.filter((p) => p.label !== 'Start Here') : pages;
  const hero = isSheet ? content.find((p) => /summary|dashboard|overview|insights/i.test(p.label)) ?? content[0]! : content[0]!;
  const main = isSheet ? pickRichest(spec, content, hero) : content[1] ?? content[0]!;
  const formatLabel = isSheet ? 'Excel + Google Sheets' : spec.paperSizes.length > 1 ? 'A4 + US Letter PDF' : `${spec.paperSizes[0]} PDF`;
  const out: ListingImage[] = [];

  /* 1. Hero */
  {
    const [c, ctx] = canvas();
    background(ctx, theme);
    // Measure the text block first so it can be centred vertically.
    ctx.font = `800 104px ${DISPLAY}`;
    const titleLines = wrap(ctx, seed.productName, 640);
    ctx.font = `400 40px ${SANS}`;
    const subLines = wrap(ctx, `Made for ${seed.audience}.`, 640);
    const blockH = titleLines.length * 112 + 40 + 70 + 60 + subLines.length * 54;
    let y = (IMG_H - blockH) / 2 + 90;
    y = heading(ctx, seed.productName, 110, y, 640, 104, theme.ink) + 30;
    const w = chip(ctx, formatLabel, 110, y, theme.primary, theme.onPrimary);
    ctx.font = `600 34px ${SANS}`;
    const w2 = ctx.measureText('Instant download').width + 56;
    const stacked = 110 + w + 20 + w2 > 760; // keep clear of the laptop
    chip(ctx, 'Instant download', stacked ? 110 : 110 + w + 20, stacked ? y + 90 : y, '#FFFFFF', theme.ink);
    ctx.font = `400 40px ${SANS}`;
    ctx.fillStyle = theme.ink;
    subLines.forEach((l, i) => ctx.fillText(l, 110, y + (stacked ? 260 : 170) + i * 54));
    if (isSheet) laptop(ctx, hero.canvas, 820, 420, 1120);
    else {
      // Fan out portrait pages only, clear of the title block.
      const portrait = content.filter((p) => p.canvas.height >= p.canvas.width);
      const stack = (portrait.length ? portrait : content).slice(0, 3).reverse();
      stack.forEach((p, i) => paper(ctx, p.canvas, 1370 + (i - (stack.length - 1) / 2) * 110, 800, 1080, (i - (stack.length - 1) / 2) * 0.06));
    }
    brandMark(ctx, theme, spec.brand);
    out.push(await toImage(c, '01-hero.jpg', `${seed.productName} ${formatLabel} shown ${isSheet ? 'on a laptop' : 'as printed pages'}`));
  }

  /* 2. Feature view */
  {
    const [c, ctx] = canvas();
    background(ctx, theme);
    if (isSheet) laptop(ctx, main.canvas, 90, 130, 1180);
    else paper(ctx, main.canvas, 560, 800, 1400, -0.02);
    const x = isSheet ? 1370 : 1120;
    const maxW = IMG_W - x - 90;
    let y = heading(ctx, isSheet ? 'Does the maths for you' : 'Designed to be used', x, 260, maxW, 76, theme.ink) + 30;
    ctx.font = `400 36px ${SANS}`;
    for (const f of seed.features.slice(0, 4)) {
      ctx.fillStyle = theme.accent;
      ctx.fillRect(x, y - 24, 14, 14);
      ctx.fillStyle = theme.ink;
      const lines = wrap(ctx, f, maxW - 40);
      lines.forEach((l, i) => ctx.fillText(l, x + 36, y + i * 48));
      y += lines.length * 48 + 34;
    }
    brandMark(ctx, theme, spec.brand);
    out.push(await toImage(c, '02-features.jpg', `${main.label} ${isSheet ? 'tab' : 'page'} with key features listed`));
  }

  /* 3. What's inside */
  {
    const [c, ctx] = canvas();
    background(ctx, theme);
    heading(ctx, `What’s inside: ${pages.length} ${isSheet ? 'tabs' : 'pages'}`, 110, 200, 1800, 84, theme.ink);
    const ratio0 = pages[0]!.canvas.width / pages[0]!.canvas.height;
    const areaTop = 300;
    const areaW = IMG_W - 220;
    const areaH = IMG_H - areaTop - 80;
    const gx = 60;
    let cols = 1;
    let bestW = 0;
    for (let n = 1; n <= pages.length; n++) {
      const r = Math.ceil(pages.length / n);
      const wByCols = (areaW - gx * (n - 1)) / n;
      const wByRows = ((areaH - (r - 1) * 40) / r - 64) * ratio0;
      const tw = Math.min(wByCols, wByRows);
      if (tw > bestW) {
        bestW = tw;
        cols = n;
      }
    }
    const rows = Math.ceil(pages.length / cols);
    const cellW = (areaW - gx * (cols - 1)) / cols;
    const cellH = Math.min((areaH - (rows - 1) * 40) / rows, bestW / ratio0 + 64);
    const gridH = rows * cellH + (rows - 1) * 40;
    const offsetY = (areaH - gridH) / 2;
    pages.forEach((p, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = 110 + col * (cellW + gx);
      const y = areaTop + offsetY + row * (cellH + 40);
      const thumbH = cellH - 64;
      const ratio = p.canvas.width / p.canvas.height;
      let tw = cellW;
      let th = tw / ratio;
      if (th > thumbH) {
        th = thumbH;
        tw = th * ratio;
      }
      const tx = x + (cellW - tw) / 2;
      shadow(ctx, 30, 12);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(tx, y, tw, th);
      noShadow(ctx);
      ctx.drawImage(p.canvas, tx, y, tw, th);
      ctx.font = `600 32px ${SANS}`;
      ctx.fillStyle = theme.ink;
      const lw = ctx.measureText(p.label).width;
      ctx.fillText(p.label, x + (cellW - lw) / 2, y + th + 48);
    });
    out.push(await toImage(c, '03-inside.jpg', `Overview of all ${pages.length} ${isSheet ? 'tabs' : 'pages'} included`));
  }

  /* 4. Close-up */
  {
    const [c, ctx] = canvas();
    const src = isSheet ? main.canvas : content[Math.min(2, content.length - 1)]!.canvas;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, IMG_W, IMG_H);
    // Zoom into the upper-left of the page, where the detail is.
    const sw = src.width * (isSheet ? 0.8 : 0.75);
    const sh = sw * (IMG_H / IMG_W);
    ctx.drawImage(src, 0, 0, sw, sh, 0, 0, IMG_W, IMG_H);
    const capH = 190;
    ctx.fillStyle = theme.ink;
    ctx.globalAlpha = 0.92;
    ctx.fillRect(0, IMG_H - capH, IMG_W, capH);
    ctx.globalAlpha = 1;
    ctx.font = `700 54px ${DISPLAY}`;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(wrap(ctx, seed.features[0] ?? seed.productName, IMG_W - 220)[0]!, 110, IMG_H - capH / 2 + 18);
    out.push(await toImage(c, '04-detail.jpg', `Close-up: ${seed.features[0] ?? seed.productName}`));
  }

  /* 5. How it works (a real sequence, so the steps are numbered) */
  {
    const [c, ctx] = canvas();
    background(ctx, theme);
    heading(ctx, 'How it works', 110, 240, 1600, 96, theme.ink);
    const steps = seed.howItWorks.slice(0, 3);
    const colW = (IMG_W - 220 - 80) / 3;
    steps.forEach((s, i) => {
      const x = 110 + i * (colW + 40);
      const y = 420;
      ctx.fillStyle = '#FFFFFF';
      roundRect(ctx, x, y, colW, 470, 28);
      ctx.fill();
      ctx.fillStyle = theme.primary;
      ctx.beginPath();
      ctx.arc(x + 100, y + 120, 56, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = `800 60px ${DISPLAY}`;
      ctx.fillStyle = theme.onPrimary;
      const n = String(i + 1);
      ctx.fillText(n, x + 100 - ctx.measureText(n).width / 2, y + 141);
      ctx.font = `500 40px ${SANS}`;
      ctx.fillStyle = theme.ink;
      wrap(ctx, s, colW - 120).forEach((l, j) => ctx.fillText(l, x + 60, y + 260 + j * 56));
    });
    const apps = isSheet ? ['Microsoft Excel', 'Google Sheets', 'Apple Numbers'] : ['Print at home', 'Print shop', 'GoodNotes / tablet'];
    let x = 110;
    for (const a of apps) x += chip(ctx, a, x, 1010, '#FFFFFF', theme.ink) + 20;
    ctx.font = `400 34px ${SANS}`;
    ctx.fillStyle = theme.muted;
    ctx.fillText('Digital download — nothing is shipped.', 110, 1190);
    brandMark(ctx, theme, spec.brand);
    out.push(await toImage(c, '05-how-it-works.jpg', 'Three steps: download, open, start using'));
  }

  return out;
}
