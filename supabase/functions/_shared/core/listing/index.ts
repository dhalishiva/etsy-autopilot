/** Raw material for listing copy, used by both the rule-based writer and the AI writer. */
export interface ListingSeed {
  productName: string;
  format: string;
  audience: string;
  /** Ordered by importance. The first ~13 that pass Etsy's tag rules become tags. */
  keywords: string[];
  features: string[];
  includes: string[];
  howItWorks: string[];
}


export interface ListingCopy {
  title: string;
  description: string;
  tags: string[];
  /** USD, or the shop currency — Etsy prices in the shop's currency. */
  price: number;
}

export interface ListingIssue {
  field: 'title' | 'description' | 'tags' | 'price';
  message: string;
  severity: 'error' | 'warning';
}

export const TITLE_MAX = 140;
export const TAG_MAX = 20;
export const TAGS_MAX = 13;
export const DESCRIPTION_MAX = 65000;

const TAG_CHARS = /^[\p{L}\p{N} '\-™©®]+$/u;
const ONCE_CHARS = ['%', ':', '&', '+'];

export const DIGITAL_NOTICE =
  'This is a digital download. No physical item will be shipped. Files are available from your Etsy Purchases page right after checkout.';

export function validateListing(copy: ListingCopy): ListingIssue[] {
  const issues: ListingIssue[] = [];
  const t = copy.title.trim();
  if (!t) issues.push({ field: 'title', message: 'Title is required', severity: 'error' });
  if (t.length > TITLE_MAX) issues.push({ field: 'title', message: `Title is ${t.length}/${TITLE_MAX} characters`, severity: 'error' });
  for (const ch of ONCE_CHARS) {
    const n = t.split(ch).length - 1;
    if (n > 1) issues.push({ field: 'title', message: `“${ch}” can appear only once in a title`, severity: 'error' });
  }
  const caps = t.split(/\s+/).filter((w) => /^[A-Z]{2,}$/.test(w.replace(/[^A-Za-z]/g, '')) && w.replace(/[^A-Za-z]/g, '').length > 1);
  if (caps.length > 3) issues.push({ field: 'title', message: 'Use no more than 3 ALL-CAPS words', severity: 'error' });
  if (t.split(/\s+/).length > 15) issues.push({ field: 'title', message: 'Etsy recommends titles under 15 words', severity: 'warning' });

  if (copy.tags.length > TAGS_MAX) issues.push({ field: 'tags', message: `Maximum ${TAGS_MAX} tags`, severity: 'error' });
  if (copy.tags.length < TAGS_MAX) issues.push({ field: 'tags', message: `Using ${copy.tags.length}/${TAGS_MAX} tags — use all 13`, severity: 'warning' });
  const seen = new Set<string>();
  for (const tag of copy.tags) {
    if (tag.length > TAG_MAX) issues.push({ field: 'tags', message: `“${tag}” is over ${TAG_MAX} characters`, severity: 'error' });
    if (!TAG_CHARS.test(tag)) issues.push({ field: 'tags', message: `“${tag}” has characters Etsy doesn’t allow`, severity: 'error' });
    const k = tag.toLowerCase();
    if (seen.has(k)) issues.push({ field: 'tags', message: `Duplicate tag “${tag}”`, severity: 'error' });
    seen.add(k);
  }

  if (!copy.description.trim()) issues.push({ field: 'description', message: 'Description is required', severity: 'error' });
  if (copy.description.length > DESCRIPTION_MAX) issues.push({ field: 'description', message: 'Description is too long', severity: 'error' });
  if (!/digital/i.test(copy.description)) {
    issues.push({ field: 'description', message: 'Say clearly that this is a digital download', severity: 'warning' });
  }

  if (!(copy.price >= 0.2)) issues.push({ field: 'price', message: 'Etsy’s minimum price is 0.20', severity: 'error' });
  if (copy.price > 50000) issues.push({ field: 'price', message: 'Price looks too high', severity: 'error' });
  return issues;
}

export function cleanTag(tag: string): string | null {
  const t = tag
    .replace(/[^\p{L}\p{N} '\-™©®]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  if (!t) return null;
  if (t.length <= TAG_MAX) return t;
  // Trim to whole words that fit.
  const words = t.split(' ');
  let out = '';
  for (const w of words) {
    const next = out ? `${out} ${w}` : w;
    if (next.length > TAG_MAX) break;
    out = next;
  }
  return out || null;
}

export function normaliseTags(tags: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of tags) {
    const t = cleanTag(raw);
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
    if (out.length === TAGS_MAX) break;
  }
  return out;
}

export function fixTitle(title: string): string {
  let t = title.replace(/\s+/g, ' ').trim();
  for (const ch of ONCE_CHARS) {
    let first = true;
    t = t
      .split('')
      .map((c) => {
        if (c !== ch) return c;
        if (first) {
          first = false;
          return c;
        }
        return ch === '&' ? 'and' : ch === '+' ? 'plus' : ch === ':' ? ' -' : ' percent';
      })
      .join('');
  }
  if (t.length > TITLE_MAX) {
    t = t.slice(0, TITLE_MAX);
    const cut = Math.max(t.lastIndexOf(','), t.lastIndexOf(' '));
    if (cut > 60) t = t.slice(0, cut);
  }
  return t.replace(/[\s,|–-]+$/, '').trim();
}

/** Apply every automatic fix so a listing can be pushed safely. */
export function autoFix(copy: ListingCopy): ListingCopy {
  let description = copy.description.trim();
  if (!/digital download/i.test(description)) description = `${description}\n\n${DIGITAL_NOTICE}`;
  return {
    title: fixTitle(copy.title),
    tags: normaliseTags(copy.tags),
    description: description.slice(0, DESCRIPTION_MAX),
    price: Math.round(Math.max(0.2, copy.price) * 100) / 100,
  };
}

const ACRONYMS = new Set(['gst', 'cgst', 'sgst', 'igst', 'pdf', 'a4', 'us', 'uk', 'usa', 'rsvp', 'seo', 'diy', 'svg', 'png', 'kpi', 'crm', 'hr']);
const titleCase = (s: string) =>
  s
    .split(' ')
    .map((w) => (ACRONYMS.has(w.toLowerCase()) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
const article = (s: string) => (/^[aeiou]/i.test(s) ? 'an' : 'a');

/** Deterministic copy that is good enough to publish; the AI writer improves on it. */
export function ruleBasedCopy(seed: ListingSeed, price: number, opts: { aiDisclosure?: boolean } = {}): ListingCopy {
  const parts = [`${seed.productName}`, seed.format];
  for (const kw of seed.keywords.slice(0, 5)) {
    if (parts.length >= 4) break;
    const candidate = [...parts, titleCase(kw)].join(', ');
    if (candidate.length > 100) break;
    const overlap = kw.toLowerCase().split(' ').filter((w) => parts.join(' ').toLowerCase().includes(w)).length;
    if (overlap >= Math.ceil(kw.split(' ').length / 2)) continue;
    parts.push(titleCase(kw));
  }
  const title = parts.join(', ');

  const lines: string[] = [];
  lines.push(`${seed.productName} — ${article(seed.format)} ${seed.format} made for ${seed.audience}.`);
  lines.push('');
  lines.push('WHAT IT DOES');
  for (const f of seed.features) lines.push(`• ${f}`);
  lines.push('');
  lines.push('WHAT YOU GET');
  for (const i of seed.includes) lines.push(`• ${i}`);
  lines.push('');
  lines.push('HOW IT WORKS');
  seed.howItWorks.forEach((s, i) => lines.push(`${i + 1}. ${s}`));
  lines.push('');
  lines.push('PLEASE NOTE');
  lines.push(`• ${DIGITAL_NOTICE}`);
  lines.push('• Due to the nature of digital files, returns are not accepted — but if anything isn’t working, message me and I’ll fix it.');
  lines.push('• For personal or internal business use. Please don’t resell or share the files.');
  if (opts.aiDisclosure) lines.push('• This design was created with the help of software and AI tools, then reviewed by me.');

  return autoFix({ title, description: lines.join('\n'), tags: seed.keywords, price });
}

/* ------------------------------ AI writer ------------------------------ */

export function buildCopyPrompt(seed: ListingSeed, current?: ListingCopy): { system: string; user: string } {
  const system = [
    'You write Etsy listings for digital downloads. Rules you must follow:',
    `- Title: at most ${TITLE_MAX} characters and under 15 words. Lead with what the item is, then the format, then 1–2 high-intent search phrases. No keyword stuffing, no ALL CAPS, and each of % : & + at most once.`,
    `- Exactly ${TAGS_MAX} tags, each at most ${TAG_MAX} characters, lowercase, letters/numbers/spaces/hyphens/apostrophes only, no duplicates, no repeats of the exact title phrase. Mix broad and long-tail buyer searches, including gift and occasion angles where natural.`,
    '- Description: plain text (no markdown), warm and specific. First two sentences must work as a search snippet. Use short sections with CAPS headings and • bullets: what it does, what you get, how it works, please note. State clearly that it is a digital download and nothing is shipped. Never invent features that are not in the brief.',
    'Reply with JSON only: {"title": string, "tags": string[], "description": string}.',
  ].join('\n');
  const user = JSON.stringify({ brief: seed, currentDraft: current ? { title: current.title, tags: current.tags } : undefined });
  return { system, user };
}

export function parseAiCopy(text: string, price: number): ListingCopy {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('AI reply did not contain JSON');
  const data = JSON.parse(match[0]) as { title?: unknown; tags?: unknown; description?: unknown };
  if (typeof data.title !== 'string' || typeof data.description !== 'string' || !Array.isArray(data.tags)) {
    throw new Error('AI reply had the wrong shape');
  }
  return autoFix({
    title: data.title,
    description: data.description,
    tags: data.tags.filter((t): t is string => typeof t === 'string'),
    price,
  });
}
