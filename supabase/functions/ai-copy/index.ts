// Write Etsy listing copy with Claude.
// POST { productId }  → { copy, issues } (does not save; the app shows it for review)
import { getTemplate } from '../_shared/core/templates/index.ts';
import { DIGITAL_NOTICE, buildCopyPrompt, parseAiCopy, ruleBasedCopy, validateListing, type ListingCopy } from '../_shared/core/listing/index.ts';
import { HttpError, admin, env, handle, json, requireUser } from '../_shared/http.ts';

const MODEL = Deno.env.get('AI_MODEL') ?? 'claude-sonnet-5-5';

Deno.serve(
  handle(async (req) => {
    if (req.method !== 'POST') return json({ error: 'Use POST' }, 405);
    const user = await requireUser(req);
    const db = admin();
    const { productId } = (await req.json().catch(() => ({}))) as { productId?: string };
    const { data: p } = await db.from('products').select('*').eq('id', productId ?? '').eq('user_id', user.id).maybeSingle();
    if (!p) throw new HttpError(404, 'Product not found');

    const { data: settings } = await db.from('user_settings').select('*').eq('user_id', user.id).maybeSingle();
    const template = getTemplate(p.template_id);
    const seed = template.seed(p.params ?? {});
    const current = (p.listing as ListingCopy)?.title ? (p.listing as ListingCopy) : undefined;
    const price = current?.price ?? template.suggestedPriceUsd;

    const { system, user: prompt } = buildCopyPrompt(seed, current);
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': env('ANTHROPIC_API_KEY'),
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ model: MODEL, max_tokens: 2000, system, messages: [{ role: 'user', content: prompt }] }),
    });
    const data = await res.json();
    if (!res.ok) throw new HttpError(502, `AI request failed: ${data?.error?.message ?? res.status}`);
    const text = (data.content ?? []).map((c: { type: string; text?: string }) => (c.type === 'text' ? c.text : '')).join('');

    let copy: ListingCopy;
    try {
      copy = parseAiCopy(text, price);
    } catch {
      // Never leave the user empty-handed: fall back to the rule-based writer.
      copy = ruleBasedCopy(seed, price, { aiDisclosure: settings?.ai_disclosure ?? true });
    }
    if ((settings?.ai_disclosure ?? true) && !/AI tools/i.test(copy.description)) {
      copy.description += '\n• This design was created with the help of software and AI tools, then reviewed by me.';
    }
    if (!copy.description.includes(DIGITAL_NOTICE) && !/digital download/i.test(copy.description)) {
      copy.description += `\n\n${DIGITAL_NOTICE}`;
    }
    await db.from('events').insert({ user_id: user.id, product_id: p.id, kind: 'copy', message: 'AI listing copy drafted' });
    return json({ copy, issues: validateListing(copy) });
  }),
);
