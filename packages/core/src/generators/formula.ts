import type { SheetSpec, TableSheetSpec } from '../spec/types.ts';

/** First column used by tables; column A is a narrow gutter. */
export const FIRST_COL = 2;
/** Row holding table headers. Rows 1–3 are the title band and spacing. */
export const HEADER_ROW = 4;
export const FIRST_DATA_ROW = HEADER_ROW + 1;

export function colLetter(index: number): string {
  // 1-based column index → Excel letters.
  let n = index;
  let s = '';
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

export function quoteSheet(name: string): string {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(name) ? name : `'${name.replace(/'/g, "''")}'`;
}

export interface TableLayout {
  sheet: TableSheetSpec;
  letters: Record<string, string>;
  firstRow: number;
  lastRow: number;
}

export function layoutTables(sheets: SheetSpec[]): Map<string, TableLayout> {
  const map = new Map<string, TableLayout>();
  for (const sheet of sheets) {
    if (sheet.kind !== 'table') continue;
    const letters: Record<string, string> = {};
    sheet.columns.forEach((c, i) => {
      letters[c.key] = colLetter(FIRST_COL + i);
    });
    map.set(sheet.name, {
      sheet,
      letters,
      firstRow: FIRST_DATA_ROW,
      lastRow: FIRST_DATA_ROW + sheet.rows - 1,
    });
  }
  return map;
}

export class FormulaError extends Error {}

/**
 * Resolve template formula placeholders into plain Excel references.
 *   [key]          → same-row cell on the current table
 *   {{Sheet.key}}  → absolute data range of a table column
 *   {label}        → caller-provided cell (used by breakdowns)
 */
export function resolveFormula(
  formula: string,
  ctx: {
    tables: Map<string, TableLayout>;
    current?: TableLayout;
    row?: number;
    vars?: Record<string, string>;
  },
): string {
  let out = formula.replace(/\{\{([^}.]+)\.([A-Za-z0-9_]+)\}\}/g, (_, sheetName: string, key: string) => {
    const t = ctx.tables.get(sheetName);
    const letter = t?.letters[key];
    if (!t || !letter) throw new FormulaError(`Unknown range {{${sheetName}.${key}}}`);
    return `${quoteSheet(sheetName)}!$${letter}$${t.firstRow}:$${letter}$${t.lastRow}`;
  });

  out = out.replace(/\[([A-Za-z0-9_]+)\]/g, (_, key: string) => {
    const letter = ctx.current?.letters[key];
    if (!letter || ctx.row === undefined) throw new FormulaError(`Unknown column [${key}]`);
    return `${letter}${ctx.row}`;
  });

  if (ctx.vars) {
    for (const [k, v] of Object.entries(ctx.vars)) {
      out = out.split(`{${k}}`).join(v);
    }
  }
  if (/\{\{|\}\}|\[[A-Za-z0-9_]+\]|\{[A-Za-z_][A-Za-z0-9_]*\}/.test(out.replace(/"[^"]*"/g, ''))) {
    throw new FormulaError(`Unresolved placeholder in formula: ${formula}`);
  }
  return out.startsWith('=') ? out.slice(1) : out;
}
