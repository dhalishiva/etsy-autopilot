/**
 * Generate every template with default params into ./samples-out so you can
 * open the files and eyeball them. Usage: npm run samples [-- --brand "Kriosity"]
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { TEMPLATES, generateProductFiles, ruleBasedCopy, validateListing } from '../src/index.ts';

const brandIdx = process.argv.indexOf('--brand');
const brand = brandIdx > -1 ? process.argv[brandIdx + 1] ?? '' : 'Kriosity';
const out = join(process.cwd(), 'samples-out');
await mkdir(out, { recursive: true });

for (const t of TEMPLATES) {
  const spec = t.build({ brand });
  const files = await generateProductFiles(spec);
  const dir = join(out, t.id);
  await mkdir(dir, { recursive: true });
  for (const f of files) await writeFile(join(dir, f.name), f.bytes);
  const copy = ruleBasedCopy(t.seed({ brand }), t.suggestedPriceUsd);
  await writeFile(join(dir, 'listing.json'), JSON.stringify({ ...copy, issues: validateListing(copy) }, null, 2));
  console.log(`✓ ${t.id}: ${files.map((f) => `${f.name} (${Math.round(f.bytes.byteLength / 1024)} KB)`).join(', ')}`);
}
console.log(`\nWrote samples to ${out}`);
