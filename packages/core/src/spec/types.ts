/**
 * Product specs are plain, serialisable data. Templates build them from user
 * params; generators turn them into files. Keeping them as JSON means the web
 * app, edge functions and (later) the Android app all speak the same language,
 * and a spec can be stored in Postgres and regenerated at any time.
 */

export interface Theme {
  id: string;
  name: string;
  /** Header bands, primary buttons. */
  primary: string;
  /** Text drawn on top of `primary`. */
  onPrimary: string;
  /** Highlights, totals, chips. */
  accent: string;
  /** Soft background for alternating rows / panels. */
  surface: string;
  /** Body text. */
  ink: string;
  /** Secondary text, grid lines. */
  muted: string;
}

export interface CurrencyFormat {
  code: string;
  symbol: string;
  /** Excel number format, e.g. `"₹"#,##0.00`. */
  excelFormat: string;
}

/* ----------------------------- Spreadsheets ----------------------------- */

export type ColumnType =
  | 'text'
  | 'number'
  | 'currency'
  | 'percent'
  | 'date'
  | 'checkbox'
  | 'select'
  | 'formula';

export interface ColumnSpec {
  key: string;
  header: string;
  type: ColumnType;
  /** Approximate width in characters. */
  width?: number;
  /** Dropdown values for `select`. */
  options?: string[];
  /**
   * For `formula` columns. `[key]` refers to the same-row cell of another
   * column; `{{Sheet.key}}` refers to the full data range of a column on any
   * sheet. Example: `IF([qty]="","",[qty]*[rate])`.
   */
  formula?: string;
  /** How a formula column's result should be displayed. */
  resultFormat?: 'currency' | 'number' | 'percent' | 'text' | 'date';
  /** Shown as a cell comment on the header. */
  note?: string;
}

export type SampleValue = string | number | boolean | null | undefined;

export interface TableSheetSpec {
  kind: 'table';
  name: string;
  title: string;
  subtitle?: string;
  columns: ColumnSpec[];
  /** Number of blank, pre-formatted data rows. */
  rows: number;
  /** Example rows the buyer can delete. Filled from the top. */
  sampleRows?: Record<string, SampleValue>[];
  /** Totals row under the table. */
  totals?: Record<string, 'sum' | 'average' | 'count'>;
}

export interface MetricSpec {
  label: string;
  /** Excel formula without `=`. Supports `{{Sheet.key}}`. */
  formula: string;
  format: 'currency' | 'number' | 'percent' | 'text';
  hint?: string;
}

export interface BreakdownSpec {
  title: string;
  categories: string[];
  /** Formula per category. `{label}` resolves to the category's label cell. */
  valueFormula: string;
  format: 'currency' | 'number' | 'percent';
  /** Second value column, e.g. "Budget" next to "Spent". */
  secondary?: { header: string; valueFormula: string; format: 'currency' | 'number' | 'percent' };
  valueHeader?: string;
  /** Header for the label column (default "Category"). */
  labelHeader?: string;
  /** Adds an in-cell data bar on the main value column. */
  dataBar?: boolean;
}

export interface SummarySheetSpec {
  kind: 'summary';
  name: string;
  title: string;
  subtitle?: string;
  metrics: MetricSpec[];
  breakdowns?: BreakdownSpec[];
}

export interface GuideSheetSpec {
  kind: 'guide';
  name: string;
  title: string;
  sections: { heading: string; body: string[] }[];
}

export type SheetSpec = TableSheetSpec | SummarySheetSpec | GuideSheetSpec;

export interface SpreadsheetSpec {
  kind: 'spreadsheet';
  title: string;
  fileBase: string;
  brand?: string;
  currency: CurrencyFormat;
  theme: Theme;
  sheets: SheetSpec[];
}

/* ------------------------------ Printables ------------------------------ */

export type PaperSize = 'A4' | 'Letter';

export type PageSpec =
  | { type: 'cover'; title: string; subtitle?: string }
  | { type: 'habit-tracker'; title: string; rows: number; days: number }
  | { type: 'weekly-planner'; title: string }
  | { type: 'monthly-calendar'; title: string }
  | { type: 'checklist'; title: string; items?: string[]; blankLines: number }
  | { type: 'notes'; title: string; style: 'lined' | 'dot' | 'grid' }
  | { type: 'table'; title: string; columns: { header: string; weight: number }[]; rows: number }
  | { type: 'goals'; title: string; boxes: string[] };

export interface PrintableSpec {
  kind: 'printable';
  title: string;
  fileBase: string;
  brand?: string;
  theme: Theme;
  paperSizes: PaperSize[];
  pages: PageSpec[];
}

export type ProductSpec = SpreadsheetSpec | PrintableSpec;

export interface GeneratedFile {
  name: string;
  mime: string;
  bytes: Uint8Array;
}
