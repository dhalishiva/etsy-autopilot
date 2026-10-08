import ExcelJS from 'exceljs';
import type {
  ColumnSpec,
  GeneratedFile,
  GuideSheetSpec,
  SpreadsheetSpec,
  SummarySheetSpec,
  TableSheetSpec,
  Theme,
} from '../spec/types.ts';
import {
  FIRST_COL,
  FIRST_DATA_ROW,
  HEADER_ROW,
  colLetter,
  layoutTables,
  resolveFormula,
  type TableLayout,
} from './formula.ts';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const FONT = 'Calibri';
const DATE_FMT = 'dd-mmm-yyyy';

const argb = (hex: string) => 'FF' + hex.replace('#', '').toUpperCase();
const fill = (hex: string): ExcelJS.Fill => ({ type: 'pattern', pattern: 'solid', fgColor: { argb: argb(hex) } });
const thin = (hex: string): Partial<ExcelJS.Border> => ({ style: 'thin', color: { argb: argb(hex) } });

function numFmt(kind: string | undefined, spec: SpreadsheetSpec): string | undefined {
  switch (kind) {
    case 'currency':
      return spec.currency.excelFormat;
    case 'percent':
      return '0%';
    case 'number':
      return '#,##0.##';
    case 'date':
      return DATE_FMT;
    default:
      return undefined;
  }
}

function titleBand(ws: ExcelJS.Worksheet, theme: Theme, title: string, subtitle: string | undefined, lastCol: number) {
  ws.getColumn(1).width = 2.5;
  const end = colLetter(Math.max(lastCol, FIRST_COL + 3));
  ws.mergeCells(`B1:${end}1`);
  const t = ws.getCell('B1');
  t.value = title;
  t.font = { name: FONT, size: 18, bold: true, color: { argb: argb(theme.onPrimary) } };
  t.alignment = { vertical: 'middle', indent: 1 };
  for (let c = 1; c <= Math.max(lastCol, FIRST_COL + 3); c++) ws.getCell(1, c).fill = fill(theme.primary);
  ws.getRow(1).height = 38;

  ws.mergeCells(`B2:${end}2`);
  const s = ws.getCell('B2');
  s.value = subtitle ?? '';
  s.font = { name: FONT, size: 10, italic: true, color: { argb: argb(theme.muted) } };
  s.alignment = { vertical: 'middle', indent: 1 };
  ws.getRow(2).height = 22;
  ws.getRow(3).height = 8;
}

function renderTable(
  ws: ExcelJS.Worksheet,
  sheet: TableSheetSpec,
  layout: TableLayout,
  tables: Map<string, TableLayout>,
  spec: SpreadsheetSpec,
) {
  const { theme } = spec;
  const lastCol = FIRST_COL + sheet.columns.length - 1;
  titleBand(ws, theme, sheet.title, sheet.subtitle, lastCol);

  // Header row
  const header = ws.getRow(HEADER_ROW);
  header.height = 26;
  sheet.columns.forEach((col, i) => {
    const c = header.getCell(FIRST_COL + i);
    c.value = col.header;
    c.font = { name: FONT, bold: true, size: 11, color: { argb: argb(theme.onPrimary) } };
    c.fill = fill(theme.ink);
    c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    c.border = { bottom: thin(theme.accent) };
    if (col.note) c.note = col.note;
    ws.getColumn(FIRST_COL + i).width = col.width ?? defaultWidth(col);
  });

  // Data rows
  for (let r = layout.firstRow; r <= layout.lastRow; r++) {
    const row = ws.getRow(r);
    row.height = 20;
    const sample = sheet.sampleRows?.[r - layout.firstRow];
    const zebra = (r - layout.firstRow) % 2 === 1;
    sheet.columns.forEach((col, i) => {
      const cell = row.getCell(FIRST_COL + i);
      cell.font = { name: FONT, size: 10.5, color: { argb: argb(theme.ink) } };
      cell.border = { bottom: thin('#E3E3E3') };
      if (zebra) cell.fill = fill(theme.surface);
      cell.alignment = { vertical: 'middle', horizontal: alignFor(col) };

      const fmt = numFmt(col.type === 'formula' ? col.resultFormat : col.type, spec);
      // Formula columns return 0 for empty rows; hide those zeros so the sheet looks clean.
      if (fmt) cell.numFmt = col.type === 'formula' && col.resultFormat !== 'date' ? `${fmt};-${fmt};""` : fmt;

      if (col.type === 'formula' && col.formula) {
        cell.value = { formula: resolveFormula(col.formula, { tables, current: layout, row: r }) };
        cell.font = { ...cell.font, color: { argb: argb(theme.primary) } };
      } else if (sample && sample[col.key] !== undefined && sample[col.key] !== null) {
        cell.value = sampleValue(sample[col.key] as string | number | boolean, col);
      }

      if (col.type === 'select' && col.options?.length) {
        cell.dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [`"${col.options.join(',')}"`],
          showErrorMessage: false,
        };
      }
      if (col.type === 'checkbox') {
        cell.dataValidation = { type: 'list', allowBlank: true, formulae: ['"✓"'] };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      }
      if (col.type === 'date') {
        cell.dataValidation = {
          type: 'date',
          operator: 'greaterThan',
          allowBlank: true,
          formulae: [new Date(1990, 0, 1)],
          showErrorMessage: true,
          errorTitle: 'Date expected',
          error: 'Please enter a valid date, e.g. 15-Jan-2027',
        };
      }
    });
  }

  // Checkbox columns: green tick fill.
  sheet.columns.forEach((col, i) => {
    if (col.type !== 'checkbox') return;
    const L = colLetter(FIRST_COL + i);
    ws.addConditionalFormatting({
      ref: `${L}${layout.firstRow}:${L}${layout.lastRow}`,
      rules: [
        {
          type: 'containsText',
          operator: 'containsText',
          text: '✓',
          priority: 1,
          style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: argb(theme.accent) } } },
        },
      ],
    });
  });

  // Totals row
  if (sheet.totals) {
    const tr = ws.getRow(layout.lastRow + 1);
    tr.height = 24;
    const label = tr.getCell(FIRST_COL);
    label.value = 'TOTAL';
    sheet.columns.forEach((col, i) => {
      const cell = tr.getCell(FIRST_COL + i);
      cell.font = { name: FONT, bold: true, size: 11, color: { argb: argb(theme.ink) } };
      cell.fill = fill(theme.surface);
      cell.border = { top: { style: 'medium', color: { argb: argb(theme.primary) } } };
      const agg = sheet.totals?.[col.key];
      if (!agg) return;
      const L = layout.letters[col.key]!;
      const fn = agg === 'sum' ? 'SUM' : agg === 'average' ? 'AVERAGE' : 'COUNTA';
      const range = `${L}${layout.firstRow}:${L}${layout.lastRow}`;
      cell.value = { formula: agg === 'average' ? `IFERROR(AVERAGE(${range}),0)` : `${fn}(${range})` };
      const fmt = agg === 'count' ? '0' : numFmt(col.type === 'formula' ? col.resultFormat : col.type, spec);
      if (fmt) cell.numFmt = fmt;
      cell.alignment = { horizontal: 'right' };
    });
  }

  ws.views = [{ state: 'frozen', ySplit: HEADER_ROW, xSplit: 0, showGridLines: false }];
  ws.autoFilter = {
    from: { row: HEADER_ROW, column: FIRST_COL },
    to: { row: HEADER_ROW, column: lastCol },
  };
  ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 };
}

function renderSummary(
  ws: ExcelJS.Worksheet,
  sheet: SummarySheetSpec,
  tables: Map<string, TableLayout>,
  spec: SpreadsheetSpec,
) {
  const { theme } = spec;
  const lastCol = FIRST_COL + 3; // B..E
  titleBand(ws, theme, sheet.title, sheet.subtitle, lastCol);
  ws.getColumn(2).width = 30;
  ws.getColumn(3).width = 22;
  ws.getColumn(4).width = 22;
  ws.getColumn(5).width = 36;

  let r = HEADER_ROW;
  // Metric cards: label (B), value (C:D merged), hint (E)
  for (const m of sheet.metrics) {
    const row = ws.getRow(r);
    row.height = 30;
    const label = row.getCell(2);
    label.value = m.label.toUpperCase();
    label.font = { name: FONT, size: 9.5, bold: true, color: { argb: argb(theme.muted) } };
    label.alignment = { vertical: 'middle', indent: 1 };
    ws.mergeCells(r, 3, r, 4);
    const v = row.getCell(3);
    v.value = { formula: resolveFormula(m.formula, { tables }) };
    v.font = { name: FONT, size: 16, bold: true, color: { argb: argb(theme.primary) } };
    v.alignment = { vertical: 'middle', horizontal: 'left' };
    const fmt = numFmt(m.format, spec);
    if (fmt) v.numFmt = fmt;
    const hint = row.getCell(5);
    hint.value = m.hint ?? '';
    hint.font = { name: FONT, size: 9, italic: true, color: { argb: argb(theme.muted) } };
    hint.alignment = { vertical: 'middle', wrapText: true };
    for (let c = 2; c <= 5; c++) {
      const cell = row.getCell(c);
      cell.fill = fill(theme.surface);
      cell.border = { bottom: thin('#FFFFFF') };
    }
    r += 1;
  }

  for (const b of sheet.breakdowns ?? []) {
    r += 1;
    const titleRow = ws.getRow(r);
    titleRow.getCell(2).value = b.title;
    titleRow.getCell(2).font = { name: FONT, size: 13, bold: true, color: { argb: argb(theme.ink) } };
    titleRow.height = 26;
    r += 1;
    const head = ws.getRow(r);
    const headers = [b.labelHeader ?? 'Category', b.valueHeader ?? 'Amount', b.secondary?.header];
    headers.forEach((h, i) => {
      if (!h) return;
      const cell = head.getCell(2 + i);
      cell.value = h;
      cell.font = { name: FONT, bold: true, color: { argb: argb(theme.onPrimary) } };
      cell.fill = fill(theme.ink);
      cell.alignment = { horizontal: i === 0 ? 'left' : 'right', indent: i === 0 ? 1 : 0 };
    });
    r += 1;
    const start = r;
    for (const cat of b.categories) {
      const row = ws.getRow(r);
      const labelCell = row.getCell(2);
      labelCell.value = cat;
      labelCell.alignment = { indent: 1 };
      labelCell.font = { name: FONT, color: { argb: argb(theme.ink) } };
      const vars = { label: `$B${r}` };
      const val = row.getCell(3);
      val.value = { formula: resolveFormula(b.valueFormula, { tables, vars }) };
      val.numFmt = numFmt(b.format, spec) ?? '';
      if (b.secondary) {
        const sec = row.getCell(4);
        sec.value = { formula: resolveFormula(b.secondary.valueFormula, { tables, vars }) };
        sec.numFmt = numFmt(b.secondary.format, spec) ?? '';
      }
      for (let c = 2; c <= (b.secondary ? 4 : 3); c++) row.getCell(c).border = { bottom: thin('#E6E6E6') };
      r += 1;
    }
    if (b.dataBar && b.categories.length) {
      ws.addConditionalFormatting({
        ref: `C${start}:C${r - 1}`,
        rules: [
          {
            type: 'dataBar',
            priority: 1,
            cfvo: [{ type: 'min' }, { type: 'max' }],
            color: { argb: argb(theme.accent) },
          } as unknown as ExcelJS.ConditionalFormattingRule,
        ],
      });
    }
  }

  ws.views = [{ showGridLines: false }];
  ws.pageSetup = { orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 };
}

function renderGuide(ws: ExcelJS.Worksheet, sheet: GuideSheetSpec, spec: SpreadsheetSpec) {
  const { theme } = spec;
  titleBand(ws, theme, sheet.title, spec.brand ? `by ${spec.brand}` : undefined, FIRST_COL + 3);
  ws.getColumn(2).width = 110;
  let r = HEADER_ROW;
  for (const s of sheet.sections) {
    const h = ws.getCell(r, 2);
    h.value = s.heading;
    h.font = { name: FONT, size: 13, bold: true, color: { argb: argb(theme.primary) } };
    ws.getRow(r).height = 24;
    r += 1;
    for (const line of s.body) {
      const c = ws.getCell(r, 2);
      c.value = line;
      c.font = { name: FONT, size: 11, color: { argb: argb(theme.ink) } };
      c.alignment = { wrapText: true, vertical: 'top' };
      ws.getRow(r).height = Math.max(18, Math.ceil(line.length / 105) * 16);
      r += 1;
    }
    r += 1;
  }
  ws.views = [{ showGridLines: false }];
}

function defaultWidth(col: ColumnSpec): number {
  switch (col.type) {
    case 'date':
      return 14;
    case 'currency':
    case 'formula':
      return 15;
    case 'number':
    case 'percent':
      return 11;
    case 'checkbox':
      return 8;
    case 'select':
      return 18;
    default:
      return Math.max(14, Math.min(40, col.header.length + 6));
  }
}

function alignFor(col: ColumnSpec): ExcelJS.Alignment['horizontal'] {
  if (col.type === 'currency' || col.type === 'number' || col.type === 'percent') return 'right';
  if (col.type === 'formula') return col.resultFormat === 'text' ? 'left' : 'right';
  if (col.type === 'checkbox' || col.type === 'date') return 'center';
  return 'left';
}

function sampleValue(v: string | number | boolean, col: ColumnSpec): ExcelJS.CellValue {
  if (col.type === 'date' && typeof v === 'string') {
    const d = new Date(v + 'T00:00:00Z');
    return Number.isNaN(d.getTime()) ? v : d;
  }
  if (typeof v === 'string' && v.startsWith('=')) return { formula: v.slice(1) };
  return v as ExcelJS.CellValue;
}

export async function buildWorkbook(spec: SpreadsheetSpec): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  wb.creator = spec.brand ?? 'Etsy Autopilot';
  wb.title = spec.title;
  wb.created = new Date(Date.UTC(2026, 0, 1));
  wb.calcProperties = { fullCalcOnLoad: true };

  const tables = layoutTables(spec.sheets);
  for (const sheet of spec.sheets) {
    const ws = wb.addWorksheet(sheet.name, {
      properties: { tabColor: { argb: argb(sheet.kind === 'guide' ? spec.theme.accent : spec.theme.primary) } },
    });
    if (sheet.kind === 'table') renderTable(ws, sheet, tables.get(sheet.name)!, tables, spec);
    else if (sheet.kind === 'summary') renderSummary(ws, sheet, tables, spec);
    else renderGuide(ws, sheet, spec);
  }
  return wb;
}

export async function generateXlsx(spec: SpreadsheetSpec): Promise<GeneratedFile> {
  const wb = await buildWorkbook(spec);
  const buf = await wb.xlsx.writeBuffer();
  return {
    name: `${spec.fileBase}.xlsx`,
    mime: XLSX_MIME,
    bytes: new Uint8Array(buf as ArrayBuffer),
  };
}

export { FIRST_DATA_ROW };
