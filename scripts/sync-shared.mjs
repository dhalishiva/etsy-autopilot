#!/usr/bin/env node
// Copy packages/core/src into supabase/functions/_shared/core so edge functions
// (Deno) run exactly the same generators, listing rules and Etsy client as the
// web app. Run after changing core: `npm run sync:shared`.
import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'packages/core/src');
const dest = join(root, 'supabase/functions/_shared/core');

await rm(dest, { recursive: true, force: true });
await mkdir(dest, { recursive: true });
await cp(src, dest, { recursive: true });
await writeFile(
  join(dest, 'README.md'),
  '# Generated — do not edit\n\nCopied from `packages/core/src` by `npm run sync:shared`. Edit the originals.\n',
);
console.log('Synced packages/core/src → supabase/functions/_shared/core');
