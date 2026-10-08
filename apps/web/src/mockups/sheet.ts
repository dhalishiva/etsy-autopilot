import type { SheetPreview, Theme } from '@autopilot/core';

/**
 * Draw a spreadsheet tab the way it looks in Excel/Sheets (title band, header
 * row, zebra rows, totals, dashboard cards). Used for previews and Etsy images.
 */

export const SHEET_W = 1600;
export const SHEET_H = 1000;
const FONT = '"Instrument Sans", "Segoe UI", Arial, sans-serif';

function fitText(ctx: CanvasRenderingContext2D, text: string, max: number): string {
  if (ctx.measureText(text).width <= max) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + '…').width > max) t = t.slice(0, -1);
  return t + '…';
}

function chrome(ctx: CanvasRenderingContext2D, tabs: string[], active: string, theme: Theme) {
  // Spreadsheet-app frame: column letters strip on top and tabs at the bottom.
  ctx.fillStyle = '#F3F4F6';
  ctx.fillRect(0, 0, SHEET_W, 34);
  ctx.fillStyle = '#9AA1AB';
  ctx.font = `500 15px ${FONT}`;
  'ABCDEFGHIJKLMN'.split('').forEach((l, i) => ctx.fillText(l, 60 + i * 112, 23));
  ctx.fillStyle = '#F3F4F6';
  ctx.fillRect(0, SHEET_H - 46, SHEET_W, 46);
  let x = 20;
  ctx.font = `600 15px ${FONT}`;
  for (const t of tabs) {
    const w = ctx.measureText(t).width + 36;
    const on = t === active;
    ctx.fillStyle = on ? '#FFFFFF' : '#E7E9EC';
    ctx.fillRect(x, SHEET_H - 40, w, 34);
    if (on) {
      ctx.fillStyle = theme.primary;
      ctx.fillRect(x, SHEET_H - 9, w, 3);
    }
    ctx.fillStyle = on ? theme.ink : '#6B7280';
    ctx.fillText(t, x + 18, SHEET_H - 17);
    x += w + 6;
  }
}

function band(ctx: CanvasRenderingContext2D, theme: Theme, title: string, subtitle?: string) {
  ctx.fillStyle = theme.primary;
  ctx.fillRect(0, 34, SHEET_W, 86);
  ctx.fillStyle = theme.onPrimary;
  ctx.font = `700 40px ${FONT}`;
  ctx.fillText(fitText(ctx, title, SHEET_W - 80), 40, 92);
  if (subtitle) {
    ctx.fillStyle = theme.muted;
    ctx.font = `italic 400 19px ${FONT}`;
    ctx.fillText(fitText(ctx, subtitle, SHEET_W - 80), 40, 150);
  }
}

export function drawSheet(ctx: CanvasRenderingContext2D, sheet: SheetPreview, theme: Theme, tabs: string[]) {
  ctx.save();
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, SHEET_W, SHEET_H);
  chrome(ctx, tabs, sheet.name, theme);
  band(ctx, theme, sheet.title, sheet.kind === 'guide' ? undefined : sheet.subtitle);

  if (sheet.kind === 'table') drawTable(ctx, sheet, theme);
  else if (sheet.kind === 'summary') drawSummary(ctx, sheet, theme);
  else drawGuide(ctx, sheet, theme);
  ctx.restore();
}

function drawTable(ctx: CanvasRenderingContext2D, s: Extract<SheetPreview, { kind: 'table' }>, theme: Theme) {
  const top = 176;
  const left = 30;
  const avail = SHEET_W - left * 2;
  const totalW = s.columns.reduce((a, c) => a + Math.max(7, c.width), 0);
  // Show as many columns as fit legibly; spreadsheets often scroll sideways.
  const scale = Math.max(avail / totalW, 9);
  const widths: number[] = [];
  let used = 0;
  for (const c of s.columns) {
    const w = Math.max(7, c.width) * scale;
    if (used + w > avail + 1) break;
    widths.push(w);
    used += w;
  }
  const n = widths.length;
  const rowH = 44;

  // Header
  ctx.fillStyle = theme.ink;
  ctx.fillRect(left, top, used, 54);
  ctx.font = `700 17px ${FONT}`;
  let x = left;
  for (let i = 0; i < n; i++) {
    const c = s.columns[i]!;
    ctx.fillStyle = '#FFFFFF';
    const label = fitText(ctx, c.header, widths[i]! - 16);
    const tw = ctx.measureText(label).width;
    ctx.fillText(label, x + (widths[i]! - tw) / 2, top + 34);
    x += widths[i]!;
  }
  ctx.fillStyle = theme.accent;
  ctx.fillRect(left, top + 52, used, 2);

  const bodyTop = top + 54;
  const visibleRows = Math.floor((SHEET_H - 46 - bodyTop - 70) / rowH);
  for (let r = 0; r < visibleRows; r++) {
    const y = bodyTop + r * rowH;
    if (r % 2 === 1) {
      ctx.fillStyle = theme.surface;
      ctx.fillRect(left, y, used, rowH);
    }
    ctx.fillStyle = '#E6E8EB';
    ctx.fillRect(left, y + rowH - 1, used, 1);
    const row = s.rows[r];
    if (!row) continue;
    x = left;
    for (let i = 0; i < n; i++) {
      const c = s.columns[i]!;
      const v = row[i] ?? '';
      ctx.font = `${c.computed ? 600 : 400} 17px ${FONT}`;
      ctx.fillStyle = c.computed ? theme.primary : theme.ink;
      const text = fitText(ctx, v, widths[i]! - 18);
      const tw = ctx.measureText(text).width;
      const tx = c.align === 'right' ? x + widths[i]! - tw - 10 : c.align === 'center' ? x + (widths[i]! - tw) / 2 : x + 10;
      ctx.fillText(text, tx, y + 28);
      x += widths[i]!;
    }
  }
  // Column rules
  ctx.fillStyle = '#ECEEF1';
  x = left;
  for (let i = 0; i <= n; i++) {
    ctx.fillRect(x, bodyTop, 1, visibleRows * rowH);
    x += widths[i] ?? 0;
  }
  if (s.totals) {
    const y = bodyTop + visibleRows * rowH;
    ctx.fillStyle = theme.surface;
    ctx.fillRect(left, y, used, 50);
    ctx.fillStyle = theme.primary;
    ctx.fillRect(left, y, used, 3);
    x = left;
    ctx.font = `700 17px ${FONT}`;
    for (let i = 0; i < n; i++) {
      const v = s.totals[i] ?? '';
      ctx.fillStyle = theme.ink;
      const text = fitText(ctx, v, widths[i]! - 18);
      const tw = ctx.measureText(text).width;
      ctx.fillText(text, i === 0 ? x + 10 : x + widths[i]! - tw - 10, y + 33);
      x += widths[i]!;
    }
  }
}

function drawSummary(ctx: CanvasRenderingContext2D, s: Extract<SheetPreview, { kind: 'summary' }>, theme: Theme) {
  const top = 180;
  const left = 40;
  // Metric cards in a 2-column grid on the left
  const cardW = 340;
  const cardH = 92;
  const gap = 14;
  s.metrics.slice(0, 8).forEach((m, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = left + col * (cardW + gap);
    const y = top + row * (cardH + gap);
    ctx.fillStyle = theme.surface;
    ctx.fillRect(x, y, cardW, cardH);
    ctx.fillStyle = theme.primary;
    ctx.fillRect(x, y, 5, cardH);
    ctx.fillStyle = theme.muted;
    ctx.font = `700 14px ${FONT}`;
    ctx.fillText(fitText(ctx, m.label.toUpperCase(), cardW - 40), x + 22, y + 32);
    ctx.fillStyle = theme.primary;
    ctx.font = `700 32px ${FONT}`;
    ctx.fillText(fitText(ctx, m.value || '—', cardW - 40), x + 22, y + 72);
  });

  const b = s.breakdowns[0];
  if (!b) return;
  const bx = left + cardW * 2 + gap * 2 + 30;
  const bw = SHEET_W - bx - 40;
  ctx.fillStyle = theme.ink;
  ctx.font = `700 24px ${FONT}`;
  ctx.fillText(b.title, bx, top + 22);
  const head = top + 44;
  ctx.fillStyle = theme.ink;
  ctx.fillRect(bx, head, bw, 40);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `700 15px ${FONT}`;
  ctx.fillText(b.labelHeader, bx + 14, head + 26);
  const vh = b.valueHeader;
  ctx.fillText(vh, bx + bw - (b.secondaryHeader ? 230 : 20) - ctx.measureText(vh).width, head + 26);
  if (b.secondaryHeader) ctx.fillText(b.secondaryHeader, bx + bw - 20 - ctx.measureText(b.secondaryHeader).width, head + 26);
  const max = Math.max(1, ...b.rows.map((r) => r.raw));
  const rowH = Math.min(46, (SHEET_H - 60 - head - 40) / b.rows.length);
  b.rows.forEach((r, i) => {
    const y = head + 40 + i * rowH;
    const barW = (bw - 260) * (r.raw / max);
    if (barW > 0) {
      ctx.fillStyle = theme.accent;
      ctx.globalAlpha = 0.45;
      ctx.fillRect(bx + 190, y + 8, barW, rowH - 16);
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = '#E6E8EB';
    ctx.fillRect(bx, y + rowH - 1, bw, 1);
    ctx.fillStyle = theme.ink;
    ctx.font = `400 17px ${FONT}`;
    ctx.fillText(fitText(ctx, r.label, 170), bx + 14, y + rowH / 2 + 6);
    ctx.font = `600 17px ${FONT}`;
    const vx = bx + bw - (b.secondaryHeader ? 230 : 20);
    ctx.fillText(r.value, vx - ctx.measureText(r.value).width, y + rowH / 2 + 6);
    if (r.secondary !== undefined) ctx.fillText(r.secondary, bx + bw - 20 - ctx.measureText(r.secondary).width, y + rowH / 2 + 6);
  });
}

function drawGuide(ctx: CanvasRenderingContext2D, s: Extract<SheetPreview, { kind: 'guide' }>, theme: Theme) {
  let y = 200;
  const left = 50;
  const max = SHEET_W - 120;
  for (const sec of s.sections) {
    if (y > SHEET_H - 120) break;
    ctx.fillStyle = theme.primary;
    ctx.font = `700 26px ${FONT}`;
    ctx.fillText(sec.heading, left, y);
    y += 40;
    ctx.fillStyle = theme.ink;
    ctx.font = `400 19px ${FONT}`;
    for (const para of sec.body) {
      const words = para.split(' ');
      let line = '';
      for (const w of words) {
        const next = line ? `${line} ${w}` : w;
        if (ctx.measureText(next).width > max) {
          ctx.fillText(line, left, y);
          y += 30;
          line = w;
        } else line = next;
      }
      if (line) {
        ctx.fillText(line, left, y);
        y += 30;
      }
      y += 6;
      if (y > SHEET_H - 90) break;
    }
    y += 22;
  }
}
