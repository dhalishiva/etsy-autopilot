import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type RGB } from 'pdf-lib';
import type { GeneratedFile, PageSpec, PaperSize, PrintableSpec, Theme } from '../spec/types.ts';

const SIZES: Record<PaperSize, [number, number]> = {
  A4: [595.28, 841.89],
  Letter: [612, 792],
};
const M = 40; // page margin

function hex(h: string): RGB {
  const n = parseInt(h.replace('#', ''), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

interface Ctx {
  page: PDFPage;
  w: number;
  h: number;
  theme: Theme;
  regular: PDFFont;
  bold: PDFFont;
  brand?: string;
}

function header(ctx: Ctx, title: string): number {
  const { page, h, theme, bold } = ctx;
  const size = 22;
  page.drawText(title, { x: M, y: h - M - size, size, font: bold, color: hex(theme.primary) });
  page.drawRectangle({ x: M, y: h - M - size - 12, width: 56, height: 3, color: hex(theme.accent) });
  footer(ctx);
  return h - M - size - 30; // y where content can start
}

function footer(ctx: Ctx) {
  if (!ctx.brand) return;
  const size = 8;
  const width = ctx.regular.widthOfTextAtSize(ctx.brand, size);
  ctx.page.drawText(ctx.brand, {
    x: ctx.w - M - width,
    y: M / 2,
    size,
    font: ctx.regular,
    color: hex(ctx.theme.muted),
  });
}

function fit(font: PDFFont, text: string, size: number, max: number): string {
  if (font.widthOfTextAtSize(text, size) <= max) return text;
  let t = text;
  while (t.length > 1 && font.widthOfTextAtSize(t + '…', size) > max) t = t.slice(0, -1);
  return t + '…';
}

function line(page: PDFPage, x1: number, y1: number, x2: number, y2: number, color: RGB, thickness = 0.6) {
  page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness, color });
}

function box(ctx: Ctx, x: number, y: number, w: number, h: number, label?: string, lines = 0) {
  const { page, theme, bold } = ctx;
  page.drawRectangle({ x, y, width: w, height: h, borderColor: hex(theme.muted), borderWidth: 0.7 });
  let top = y + h;
  if (label) {
    page.drawRectangle({ x, y: top - 20, width: w, height: 20, color: hex(theme.surface) });
    page.drawText(fit(bold, label.toUpperCase(), 9, w - 12), {
      x: x + 8,
      y: top - 14,
      size: 9,
      font: bold,
      color: hex(theme.primary),
    });
    top -= 20;
  }
  if (lines > 0) {
    const gap = (top - y) / (lines + 1);
    for (let i = 1; i <= lines; i++) line(page, x + 8, top - gap * i, x + w - 8, top - gap * i, hex('#D9D9D9'));
  }
}

/* -------------------------------- Pages -------------------------------- */

function cover(ctx: Ctx, p: Extract<PageSpec, { type: 'cover' }>) {
  const { page, w, h, theme, bold, regular } = ctx;
  page.drawRectangle({ x: 0, y: h * 0.38, width: w, height: h * 0.62, color: hex(theme.primary) });
  page.drawRectangle({ x: M, y: h * 0.38 - 6, width: 90, height: 6, color: hex(theme.accent) });
  const size = 34;
  const words = p.title.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const word of words) {
    const next = cur ? `${cur} ${word}` : word;
    if (bold.widthOfTextAtSize(next, size) > w - M * 2) {
      lines.push(cur);
      cur = word;
    } else cur = next;
  }
  if (cur) lines.push(cur);
  let y = h * 0.38 + 40 + (lines.length - 1) * (size + 6);
  for (const l of lines) {
    page.drawText(l, { x: M, y, size, font: bold, color: hex(theme.onPrimary) });
    y -= size + 6;
  }
  if (p.subtitle) {
    page.drawText(fit(regular, p.subtitle, 13, w - M * 2), {
      x: M,
      y: h * 0.38 - 40,
      size: 13,
      font: regular,
      color: hex(theme.ink),
    });
  }
  if (ctx.brand) {
    page.drawText(ctx.brand, { x: M, y: M, size: 10, font: bold, color: hex(theme.muted) });
  }
}

function habitTracker(ctx: Ctx, p: Extract<PageSpec, { type: 'habit-tracker' }>) {
  const { page, w, theme, bold, regular } = ctx;
  let top = header(ctx, p.title);
  page.drawText('Month: ____________________', { x: M, y: top, size: 10, font: regular, color: hex(theme.ink) });
  top -= 22;
  const nameW = 120;
  const gridW = w - M * 2 - nameW;
  const cell = gridW / p.days;
  const rowH = Math.min(26, (top - M * 1.5) / (p.rows + 1));
  // Day header
  for (let d = 0; d < p.days; d++) {
    const x = M + nameW + d * cell;
    page.drawRectangle({ x, y: top - rowH, width: cell, height: rowH, color: hex(theme.primary) });
    const label = String(d + 1);
    const tw = bold.widthOfTextAtSize(label, 7);
    page.drawText(label, { x: x + (cell - tw) / 2, y: top - rowH / 2 - 3, size: 7, font: bold, color: hex(theme.onPrimary) });
  }
  page.drawRectangle({ x: M, y: top - rowH, width: nameW, height: rowH, color: hex(theme.primary) });
  page.drawText('HABIT', { x: M + 8, y: top - rowH / 2 - 3, size: 8, font: bold, color: hex(theme.onPrimary) });
  for (let r = 1; r <= p.rows; r++) {
    const y = top - rowH * (r + 1);
    if (r % 2 === 0) page.drawRectangle({ x: M, y, width: w - M * 2, height: rowH, color: hex(theme.surface) });
    line(page, M, y, w - M, y, hex('#D0D0D0'));
  }
  for (let d = 0; d <= p.days; d++) {
    const x = M + nameW + d * cell;
    line(page, x, top - rowH, x, top - rowH * (p.rows + 1), hex('#D0D0D0'), 0.4);
  }
  line(page, M, top - rowH, M, top - rowH * (p.rows + 1), hex('#D0D0D0'), 0.4);
}

function weeklyPlanner(ctx: Ctx, p: Extract<PageSpec, { type: 'weekly-planner' }>) {
  const { w } = ctx;
  const top = header(ctx, p.title);
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday', 'Notes & priorities'];
  const gap = 10;
  const colW = (w - M * 2 - gap) / 2;
  const rowH = (top - M * 1.2 - gap * 3) / 4;
  days.forEach((d, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    box(ctx, M + col * (colW + gap), top - (row + 1) * rowH - row * gap, colW, rowH, d, 5);
  });
}

function monthlyCalendar(ctx: Ctx, p: Extract<PageSpec, { type: 'monthly-calendar' }>) {
  const { page, w, theme, bold, regular } = ctx;
  let top = header(ctx, p.title);
  page.drawText('Month: ______________     Year: ________', { x: M, y: top, size: 10, font: regular, color: hex(theme.ink) });
  top -= 22;
  const days = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
  const cw = (w - M * 2) / 7;
  const hh = 20;
  days.forEach((d, i) => {
    page.drawRectangle({ x: M + i * cw, y: top - hh, width: cw, height: hh, color: hex(theme.primary) });
    const tw = bold.widthOfTextAtSize(d, 9);
    page.drawText(d, { x: M + i * cw + (cw - tw) / 2, y: top - 14, size: 9, font: bold, color: hex(theme.onPrimary) });
  });
  const rh = (top - hh - M * 1.2) / 6;
  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 7; c++) {
      const x = M + c * cw;
      const y = top - hh - (r + 1) * rh;
      page.drawRectangle({
        x,
        y,
        width: cw,
        height: rh,
        borderColor: hex(theme.muted),
        borderWidth: 0.5,
        color: c >= 5 ? hex(theme.surface) : undefined,
      });
      page.drawRectangle({ x: x + 5, y: y + rh - 17, width: 14, height: 12, borderColor: hex('#CFCFCF'), borderWidth: 0.5 });
    }
  }
}

function checklist(ctx: Ctx, p: Extract<PageSpec, { type: 'checklist' }>) {
  const { page, w, theme, regular } = ctx;
  let y = header(ctx, p.title);
  const items = [...(p.items ?? []), ...Array<string>(p.blankLines).fill('')];
  const step = Math.min(40, (y - M * 1.2) / Math.max(items.length, 1));
  for (const item of items) {
    page.drawRectangle({ x: M, y: y - 12, width: 11, height: 11, borderColor: hex(theme.primary), borderWidth: 0.9 });
    if (item) {
      page.drawText(fit(regular, item, 11, w - M * 2 - 24), { x: M + 20, y: y - 10, size: 11, font: regular, color: hex(theme.ink) });
    }
    line(page, M + 20, y - 14, w - M, y - 14, hex('#DADADA'));
    y -= step;
  }
}

function notes(ctx: Ctx, p: Extract<PageSpec, { type: 'notes' }>) {
  const { page, w } = ctx;
  const top = header(ctx, p.title);
  const gap = 18;
  const c = hex('#D3D3D3');
  if (p.style === 'lined') {
    for (let y = top - gap; y > M; y -= gap * 1.25) line(page, M, y, w - M, y, c);
  } else if (p.style === 'grid') {
    const g = 14;
    for (let y = top; y > M; y -= g) line(page, M, y, w - M, y, c, 0.35);
    for (let x = M; x <= w - M; x += g) line(page, x, top, x, M, c, 0.35);
  } else {
    const g = 14;
    for (let y = top; y > M; y -= g) for (let x = M; x <= w - M; x += g) page.drawCircle({ x, y, size: 0.7, color: hex('#A9A9A9') });
  }
}

function table(ctx: Ctx, p: Extract<PageSpec, { type: 'table' }>) {
  const { page, w, theme, bold } = ctx;
  const top = header(ctx, p.title);
  const total = p.columns.reduce((s, c) => s + c.weight, 0);
  const tw = w - M * 2;
  const hh = 22;
  let x = M;
  const xs: number[] = [];
  for (const col of p.columns) {
    const cw = (col.weight / total) * tw;
    page.drawRectangle({ x, y: top - hh, width: cw, height: hh, color: hex(theme.primary) });
    page.drawText(fit(bold, col.header.toUpperCase(), 8, cw - 10), { x: x + 6, y: top - 14, size: 8, font: bold, color: hex(theme.onPrimary) });
    xs.push(x);
    x += cw;
  }
  xs.push(M + tw);
  const rh = Math.min(60, (top - hh - M * 1.2) / p.rows);
  for (let r = 0; r < p.rows; r++) {
    const y = top - hh - (r + 1) * rh;
    if (r % 2 === 1) page.drawRectangle({ x: M, y, width: tw, height: rh, color: hex(theme.surface) });
    line(page, M, y, M + tw, y, hex('#D6D6D6'));
  }
  for (const xx of xs) line(page, xx, top - hh, xx, top - hh - p.rows * rh, hex('#D6D6D6'), 0.4);
}

function goals(ctx: Ctx, p: Extract<PageSpec, { type: 'goals' }>) {
  const { w } = ctx;
  const top = header(ctx, p.title);
  const gap = 10;
  const n = p.boxes.length;
  const bh = (top - M * 1.2 - gap * (n - 1)) / n;
  p.boxes.forEach((label, i) => box(ctx, M, top - (i + 1) * bh - i * gap, w - M * 2, bh, label, Math.max(1, Math.floor(bh / 26) - 1)));
}

/* ------------------------------- Builder ------------------------------- */

export async function buildPdf(spec: PrintableSpec, size: PaperSize): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(spec.title);
  doc.setAuthor(spec.brand ?? 'Etsy Autopilot');
  doc.setCreator('Etsy Autopilot');
  doc.setProducer('Etsy Autopilot');
  doc.setCreationDate(new Date(Date.UTC(2026, 0, 1)));
  doc.setModificationDate(new Date(Date.UTC(2026, 0, 1)));
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const [w, h] = SIZES[size];

  for (const p of spec.pages) {
    // Wide grids read better in landscape.
    const landscape = p.type === 'habit-tracker';
    const [pw, ph] = landscape ? [h, w] : [w, h];
    const page = doc.addPage([pw, ph]);
    const ctx: Ctx = { page, w: pw, h: ph, theme: spec.theme, regular, bold, brand: spec.brand };
    switch (p.type) {
      case 'cover':
        cover(ctx, p);
        break;
      case 'habit-tracker':
        habitTracker(ctx, p);
        break;
      case 'weekly-planner':
        weeklyPlanner(ctx, p);
        break;
      case 'monthly-calendar':
        monthlyCalendar(ctx, p);
        break;
      case 'checklist':
        checklist(ctx, p);
        break;
      case 'notes':
        notes(ctx, p);
        break;
      case 'table':
        table(ctx, p);
        break;
      case 'goals':
        goals(ctx, p);
        break;
    }
  }
  return doc.save();
}

export async function generatePdfs(spec: PrintableSpec): Promise<GeneratedFile[]> {
  const out: GeneratedFile[] = [];
  for (const size of spec.paperSizes) {
    out.push({
      name: `${spec.fileBase}-${size === 'Letter' ? 'US-Letter' : 'A4'}.pdf`,
      mime: 'application/pdf',
      bytes: await buildPdf(spec, size),
    });
  }
  return out;
}
