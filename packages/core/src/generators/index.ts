import type { GeneratedFile, ProductSpec } from '../spec/types.ts';
import { generatePdfs } from './pdf.ts';
import { generateXlsx } from './xlsx.ts';

/** Etsy allows up to 5 files per digital listing, 20 MB each. */
export const ETSY_MAX_FILES = 5;
export const ETSY_MAX_FILE_BYTES = 20 * 1024 * 1024;

export async function generateProductFiles(spec: ProductSpec): Promise<GeneratedFile[]> {
  const files = spec.kind === 'spreadsheet' ? [await generateXlsx(spec)] : await generatePdfs(spec);
  if (files.length > ETSY_MAX_FILES) throw new Error(`Etsy allows at most ${ETSY_MAX_FILES} files per listing`);
  for (const f of files) {
    if (f.bytes.byteLength > ETSY_MAX_FILE_BYTES) throw new Error(`${f.name} is larger than 20 MB`);
  }
  return files;
}

export { generateXlsx, buildWorkbook } from './xlsx.ts';
export { generatePdfs, buildPdf } from './pdf.ts';
export { resolveFormula, layoutTables, colLetter, FormulaError } from './formula.ts';
