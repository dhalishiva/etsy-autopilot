// Server-side product generation (used by the Android app and automations;
// the web app generates in the browser for instant previews).
// POST { productId } → builds the files from the stored template + params,
// uploads them to storage and saves the paths on the product.
import { generateProductFiles } from '../_shared/core/generators/index.ts';
import { getTemplate } from '../_shared/core/templates/index.ts';
import { HttpError, admin, handle, json, requireUser } from '../_shared/http.ts';

Deno.serve(
  handle(async (req) => {
    if (req.method !== 'POST') return json({ error: 'Use POST' }, 405);
    const user = await requireUser(req);
    const db = admin();
    const { productId } = (await req.json().catch(() => ({}))) as { productId?: string };
    const { data: p } = await db.from('products').select('*').eq('id', productId ?? '').eq('user_id', user.id).maybeSingle();
    if (!p) throw new HttpError(404, 'Product not found');

    const spec = getTemplate(p.template_id).build(p.params ?? {});
    const files = await generateProductFiles(spec);
    const stored = [];
    for (const f of files) {
      const path = `${user.id}/${p.id}/files/${f.name}`;
      const { error } = await db.storage.from('products').upload(path, f.bytes, { contentType: f.mime, upsert: true });
      if (error) throw new HttpError(500, `Upload failed for ${f.name}: ${error.message}`);
      stored.push({ path, name: f.name, mime: f.mime, size: f.bytes.byteLength });
    }
    await db.from('products').update({ spec, files: stored }).eq('id', p.id);
    await db.from('events').insert({ user_id: user.id, product_id: p.id, kind: 'generated', message: `Generated ${stored.length} file(s)` });
    return json({ ok: true, files: stored });
  }),
);
