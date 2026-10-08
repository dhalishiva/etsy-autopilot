import type { ColumnSpec, CurrencyFormat, SpreadsheetSpec, TableSheetSpec } from '../spec/types.ts';
import { evaluate, toSerial, type Scalar } from './evaluate.ts';

export interface TablePreview {
  kind: 'table';
  name: string;
  title: string;
  subtitle?: string;
  columns: { header: string; align: 'left' | 'right' | 'center'; computed: boolean; width: number }[];
  rows: string[][];
  totals?: string[];
}

export interface SummaryPreview {
  kind: 'summary';
  name: string;
  title: string;
  subtitle?: string;
  metrics: { label: string; value: string; raw: number | null; hint?: string }[];
  breakdowns: {
    title: string;
    labelHeader: string;
    valueHeader: string;
    secondaryHeader?: string;
    rows: { label: string; value: string; raw: number; secondary?: string }[];
  }[];
}

export interface GuidePreview {
  kind: 'guide';
  name: string;
  title: string;
  sections: { heading: string; body: string[] }[];
}

export type SheetPreview = TablePreview | SummaryPreview | GuidePreview;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatValue(v: Scalar, format: string | undefined, cur: CurrencyFormat, hideZero = false): string {
  if (v === null || v === '') return '';
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  if (typeof v === 'string') return v;
  if (hideZero && v === 0) return '';
  switch (format) {
    case 'currency': {
      const locale = cur.code === 'INR' ? 'en-IN' : 'en-US';
      const s = new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(v));
      return `${v < 0 ? '-' : ''}${cur.symbol}${s}`;
    }
    case 'percent':
      return `${Math.round(v * 100)}%`;
    case 'date': {
      const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(v) * 86400000);
      return `${String(d.getUTCDate()).padStart(2, '0')}-${MONTHS[d.getUTCMonth()]}-${d.getUTCFullYear()}`;
    }
    case 'number':
      return Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/\.?0+$/, '');
    default:
      return String(v);
  }
}

function align(col: ColumnSpec): 'left' | 'right' | 'center' {
  const t = col.type === 'formula' ? col.resultFormat : col.type;
  if (t === 'currency' || t === 'number' || t === 'percent') return 'right';
  if (t === 'checkbox' || t === 'date') return 'center';
  return 'left';
}

function rawSample(v: Scalar | undefined, col: ColumnSpec): Scalar {
  if (v === undefined || v === null) return null;
  if (col.type === 'date' && typeof v === 'string') return toSerial(v);
  if (col.type === 'select' && typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  return v;
}

/** Compute every table's sample rows (including formula columns). */
export function computeTables(spec: SpreadsheetSpec, today: number): Map<string, Record<string, Scalar>[]> {
  const out = new Map<string, Record<string, Scalar>[]>();
  const tables = spec.sheets.filter((s): s is TableSheetSpec => s.kind === 'table');
  const column = (sheet: string, key: string): Scalar[] => (out.get(sheet) ?? []).map((r) => r[key] ?? null);
  for (const t of tables) {
    const rows: Record<string, Scalar>[] = [];
    for (const sample of t.sampleRows ?? []) {
      const row: Record<string, Scalar> = {};
      for (const col of t.columns) {
        if (col.type === 'formula' && col.formula) {
          try {
            const v = evaluate(col.formula, { row, column, today });
            row[col.key] = Array.isArray(v) ? null : v;
          } catch {
            row[col.key] = null;
          }
        } else row[col.key] = rawSample(sample[col.key], col);
      }
      rows.push(row);
    }
    out.set(t.name, rows);
  }
  return out;
}

export function previewSpreadsheet(spec: SpreadsheetSpec, opts: { today?: number } = {}): SheetPreview[] {
  const today = opts.today ?? toSerial(new Date().toISOString().slice(0, 10));
  const data = computeTables(spec, today);
  const column = (sheet: string, key: string): Scalar[] => (data.get(sheet) ?? []).map((r) => r[key] ?? null);
  const cur = spec.currency;

  return spec.sheets.map((sheet): SheetPreview => {
    if (sheet.kind === 'guide') return { kind: 'guide', name: sheet.name, title: sheet.title, sections: sheet.sections };

    if (sheet.kind === 'table') {
      const rows = data.get(sheet.name) ?? [];
      const fmtOf = (c: ColumnSpec) => (c.type === 'formula' ? c.resultFormat : c.type);
      return {
        kind: 'table',
        name: sheet.name,
        title: sheet.title,
        subtitle: sheet.subtitle,
        columns: sheet.columns.map((c) => ({ header: c.header, align: align(c), computed: c.type === 'formula', width: c.width ?? 14 })),
        rows: rows.map((r) => sheet.columns.map((c) => formatValue(r[c.key] ?? null, fmtOf(c), cur, c.type === 'formula'))),
        totals: sheet.totals
          ? sheet.columns.map((c, i) => {
              const agg = sheet.totals?.[c.key];
              if (!agg) return i === 0 ? 'TOTAL' : '';
              const vals = rows.map((r) => r[c.key]).filter((v): v is number => typeof v === 'number');
              const v = agg === 'sum' ? vals.reduce((s, x) => s + x, 0) : agg === 'count' ? vals.length : vals.length ? vals.reduce((s, x) => s + x, 0) / vals.length : 0;
              return formatValue(v, agg === 'count' ? 'number' : fmtOf(c), cur);
            })
          : undefined,
      };
    }

    // summary
    const cells: Record<string, Scalar> = {};
    const metrics = sheet.metrics.map((m, i) => {
      let raw: Scalar = null;
      try {
        const v = evaluate(m.formula, { column, cells, today });
        raw = Array.isArray(v) ? null : v;
      } catch {
        raw = null;
      }
      cells[`C${4 + i}`] = raw;
      return { label: m.label, value: formatValue(raw, m.format, cur), raw: typeof raw === 'number' ? raw : null, hint: m.hint };
    });
    const breakdowns = (sheet.breakdowns ?? []).map((b) => ({
      title: b.title,
      labelHeader: b.labelHeader ?? 'Category',
      valueHeader: b.valueHeader ?? 'Amount',
      secondaryHeader: b.secondary?.header,
      rows: b.categories.map((label) => {
        const one = (f: string): Scalar => {
          try {
            const v = evaluate(f, { column, vars: { label }, today });
            return Array.isArray(v) ? null : v;
          } catch {
            return null;
          }
        };
        const v = one(b.valueFormula);
        const s = b.secondary ? one(b.secondary.valueFormula) : undefined;
        return {
          label,
          value: formatValue(v ?? 0, b.format, cur),
          raw: typeof v === 'number' ? v : 0,
          secondary: b.secondary ? formatValue(s ?? 0, b.secondary.format, cur) : undefined,
        };
      }),
    }));
    return { kind: 'summary', name: sheet.name, title: sheet.title, subtitle: sheet.subtitle, metrics, breakdowns };
  });
}
