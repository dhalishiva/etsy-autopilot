import ExcelJS from 'exceljs';
import { PDFDocument } from 'pdf-lib';
import { describe, expect, it, vi } from 'vitest';
import {
  EtsyClient,
  TEMPLATES,
  buildAuthorizeUrl,
  generateProductFiles,
  layoutTables,
  normaliseTags,
  pkceChallenge,
  pushDraft,
  resolveFormula,
  ruleBasedCopy,
  userIdFromToken,
  validateListing,
  type TableSheetSpec,
} from '../src/index.ts';

describe('formula resolution', () => {
  const table: TableSheetSpec = {
    kind: 'table',
    name: 'Time Log',
    title: 'x',
    rows: 10,
    columns: [
      { key: 'hours', header: 'Hours', type: 'number' },
      { key: 'rate', header: 'Rate', type: 'currency' },
    ],
  };
  const tables = layoutTables([table]);

  it('resolves same-row and cross-sheet references', () => {
    expect(resolveFormula('[hours]*[rate]', { tables, current: tables.get('Time Log'), row: 7 })).toBe('B7*C7');
    expect(resolveFormula('SUM({{Time Log.rate}})', { tables })).toBe("SUM('Time Log'!$C$5:$C$14)");
  });

  it('keeps array constants and quoted text intact', () => {
    expect(resolveFormula('MATCH({label},{"Jan","Feb"},0)', { tables, vars: { label: '$B9' } })).toBe('MATCH($B9,{"Jan","Feb"},0)');
  });

  it('throws on unknown references', () => {
    expect(() => resolveFormula('SUM({{Nope.x}})', { tables })).toThrow();
    expect(() => resolveFormula('[missing]', { tables, current: tables.get('Time Log'), row: 5 })).toThrow();
  });
});

describe('templates', () => {
  for (const t of TEMPLATES) {
    it(`${t.id}: builds files that open cleanly`, async () => {
      const spec = t.build({ brand: 'Test Studio' });
      const files = await generateProductFiles(spec);
      expect(files.length).toBeGreaterThan(0);
      for (const f of files) {
        expect(f.bytes.byteLength).toBeGreaterThan(1000);
        if (f.name.endsWith('.xlsx')) {
          const wb = new ExcelJS.Workbook();
          await wb.xlsx.load(f.bytes.buffer.slice(f.bytes.byteOffset, f.bytes.byteOffset + f.bytes.byteLength) as ArrayBuffer);
          expect(wb.worksheets.length).toBe(spec.kind === 'spreadsheet' ? spec.sheets.length : 0);
          wb.eachSheet((ws) =>
            ws.eachRow((row) =>
              row.eachCell((cell) => {
                const v = cell.value as { formula?: string } | null;
                if (v && typeof v === 'object' && 'formula' in v && v.formula) {
                  expect(v.formula).not.toMatch(/\{\{|\[[a-z]+\]|\{label\}/);
                }
              }),
            ),
          );
        } else {
          const pdf = await PDFDocument.load(f.bytes);
          expect(pdf.getPageCount()).toBe(spec.kind === 'printable' ? spec.pages.length : 0);
        }
      }
    });

    it(`${t.id}: rule-based listing passes Etsy rules`, () => {
      const copy = ruleBasedCopy(t.seed({}), t.suggestedPriceUsd);
      const errors = validateListing(copy).filter((i) => i.severity === 'error');
      expect(errors).toEqual([]);
      expect(copy.tags).toHaveLength(13);
      expect(copy.title.length).toBeLessThanOrEqual(140);
    });
  }
});

describe('listing rules', () => {
  it('flags long tags, duplicate symbols and caps', () => {
    const issues = validateListing({
      title: 'BEST EVER SUPER MEGA Planner: 100% & more: wow & then',
      description: 'A digital download',
      tags: ['this tag is far too long to be accepted', 'ok'],
      price: 5,
    });
    const msgs = issues.map((i) => i.message).join(' | ');
    expect(msgs).toMatch(/ALL-CAPS/);
    expect(msgs).toMatch(/“:” can appear only once/);
    expect(msgs).toMatch(/over 20 characters/);
  });

  it('normalises tags', () => {
    expect(normaliseTags(['Budget Planner!', 'budget planner', 'a very long tag that keeps going'])).toEqual([
      'budget planner',
      'a very long tag that',
    ]);
  });
});

describe('etsy oauth', () => {
  it('computes RFC 7636 PKCE challenge', async () => {
    expect(await pkceChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  });

  it('builds an authorize URL with %20-separated scopes', () => {
    const url = buildAuthorizeUrl({ clientId: 'k', redirectUri: 'https://x.test/cb', state: 's', codeChallenge: 'c', scopes: ['a_r', 'b_w'] });
    expect(url).toContain('scope=a_r%20b_w');
    expect(url).toContain('code_challenge_method=S256');
  });

  it('reads the user id from an access token', () => {
    expect(userIdFromToken('12345678.abcdef')).toBe(12345678);
    expect(userIdFromToken('garbage')).toBeNull();
  });
});

describe('etsy client', () => {
  it('sends keystring:secret and form-encodes arrays', async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fake = vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ listing_id: 42, title: 't', state: 'draft', type: 'download' }), { status: 201 });
    });
    const c = new EtsyClient({ keystring: 'KEY', sharedSecret: 'SECRET', accessToken: '1.tok', fetch: fake as unknown as typeof fetch });
    await c.createDraftListing(9, { title: 'T', description: 'D', price: 5, taxonomyId: 1, tags: ['a b', 'c'] });
    const h = calls[0]!.init.headers as Record<string, string>;
    expect(h['x-api-key']).toBe('KEY:SECRET');
    expect(h.Authorization).toBe('Bearer 1.tok');
    const body = new URLSearchParams(calls[0]!.init.body as string);
    expect(body.get('tags')).toBe('a b,c');
    expect(body.get('type')).toBe('download');
    expect(body.get('price')).toBe('5.00');
  });

  it('retries on 429', async () => {
    let n = 0;
    const fake = async () => {
      n++;
      return n === 1 ? new Response('slow down', { status: 429, headers: { 'retry-after': '0' } }) : new Response('{"user_id":1,"shop_id":2}');
    };
    const c = new EtsyClient({ keystring: 'k', sharedSecret: 's', fetch: fake as unknown as typeof fetch });
    expect(await c.getMe()).toEqual({ user_id: 1, shop_id: 2 });
    expect(n).toBe(2);
  });

  it('pushDraft creates a draft then uploads images and files in order', async () => {
    const log: string[] = [];
    const fake = async (url: string, init: RequestInit) => {
      const path = new URL(url).pathname.replace('/v3/application', '');
      log.push(`${init.method} ${path}`);
      if (path.endsWith('/listings')) return new Response('{"listing_id":7,"title":"x","state":"draft","type":"download"}');
      if (path.endsWith('/images')) return new Response('{"listing_image_id":1}');
      if (path.endsWith('/files')) return new Response('{"listing_file_id":2}');
      return new Response('{}');
    };
    const c = new EtsyClient({ keystring: 'k', sharedSecret: 's', accessToken: '1.t', fetch: fake as unknown as typeof fetch });
    const r = await pushDraft(c, {
      shopId: 3,
      taxonomyId: 1,
      copy: { title: 'T', description: 'digital download', tags: ['a'], price: 4 },
      images: [{ name: 'a.png', blob: new Blob(['x']) }, { name: 'b.png', blob: new Blob(['y']) }],
      files: [{ name: 'f.xlsx', blob: new Blob(['z']) }],
    });
    expect(r.listingId).toBe(7);
    expect(log).toEqual([
      'POST /shops/3/listings',
      'POST /shops/3/listings/7/images',
      'POST /shops/3/listings/7/images',
      'POST /shops/3/listings/7/files',
    ]);
  });
});

import { getTemplate, previewSpreadsheet, toSerial, type SummaryPreview } from '../src/index.ts';

describe('preview evaluator matches LibreOffice recalculation', () => {
  // Expected values come from opening the generated .xlsx files in LibreOffice (2026-10-08).
  const expected: Record<string, number[]> = {
    'gst-invoice-expense-kit': [55500, 9990, 3192.32, 6797.68, 36580, 28910, 18349, 37151],
    'freelancer-dashboard': [26.5, 1762.5, 1065, 787.5, 165, 66.5094339622642, 2],
    'job-hunt-tracker': [6, 2, 0, 0.333333333333333, 2],
    'personal-budget-planner': [9050, 3296.73, 5753.27, 0.63572044198895, 66.98],
    'wedding-budget-planner': [25000, 21400, 22330, 2670, 8730, 13600, 15, 13],
  };
  const today = toSerial('2026-10-08');
  for (const [id, values] of Object.entries(expected)) {
    it(id, () => {
      const spec = getTemplate(id).build({});
      if (spec.kind !== 'spreadsheet') throw new Error('expected spreadsheet');
      const summary = previewSpreadsheet(spec, { today }).find((s) => s.kind === 'summary') as SummaryPreview;
      summary.metrics.forEach((m, i) => expect(m.raw).toBeCloseTo(values[i]!, 6));
      expect(summary.metrics).toHaveLength(values.length);
    });
  }

  it('computes month breakdowns', () => {
    const spec = getTemplate('freelancer-dashboard').build({});
    if (spec.kind !== 'spreadsheet') throw new Error();
    const s = previewSpreadsheet(spec, { today }).find((x) => x.kind === 'summary') as SummaryPreview;
    expect(s.breakdowns[0]!.rows[0]).toMatchObject({ label: 'Jan', raw: 952.5, secondary: '14.5' });
  });
});
