# Etsy Autopilot

Make digital products, generate their Etsy listing images and copy, and send them to your Etsy shop as drafts — then publish each one after a human review.

```
template + params ──► files (.xlsx / .pdf) ──► 5 listing images ──► listing copy (rules + AI)
                                                                            │
                                     you review ◄── Etsy draft ◄── push ────┘
                                          │
                                          └──► publish (live)
```

## What's in the box

| Part | Where | What it does |
|---|---|---|
| Core engine | `packages/core` | Product templates, `.xlsx` + `.pdf` generators, Etsy listing rules, Etsy API v3 client, formula evaluator for previews. Runs in browser, Node and Deno. |
| Web app | `apps/web` | React dashboard: template studio with live preview, listing editor with Etsy rule checks, mockup generator, Etsy push/publish. |
| Backend | `supabase/` | Postgres schema with RLS, private storage bucket, edge functions for Etsy OAuth, Etsy actions, AI copy and server-side generation. |
| Android | `apps/android` | Planned native app on the same backend — see `docs/android.md`. |

### Templates (v1)

| Template | Type | Suggested price |
|---|---|---|
| GST Invoice & Expense Tracker (India) | Spreadsheet | $9.50 |
| Freelancer Business Dashboard | Spreadsheet | $12 |
| Wedding Budget & Guest Planner | Spreadsheet | $10 |
| Personal Budget & Savings Planner | Spreadsheet | $8 |
| Job Search Tracker | Spreadsheet | $7 |
| Habit Tracker Printable Kit | PDF (A4 + US Letter) | $4.50 |
| Weekly Life Planner Printable | PDF (A4 + US Letter) | $5.50 |

Every template accepts brand name, colour theme (6 presets) and, where relevant, currency or paper size. Adding a template is one file — see `docs/templates.md`.

## Quick start (local mode — no accounts needed)

```bash
npm install
npm run dev          # http://localhost:5173
```

Without Supabase settings the app runs in **local mode**: products are saved in your browser, and you can generate files and listing images and download them. Etsy features switch on once the backend is connected.

```bash
npm test             # 31 tests: generators, Etsy rules, client, formula parity with LibreOffice
npm run samples      # writes every template to packages/core/samples-out/
```

## Going live with Etsy

Follow **`docs/setup.md`** step by step. In short:

1. Create a Supabase project, run the migration, deploy the 4 edge functions.
2. Create an Etsy app at <https://www.etsy.com/developers/your-apps> with callback
   `https://<project-ref>.supabase.co/functions/v1/etsy-oauth`.
3. Set secrets: `ETSY_KEYSTRING`, `ETSY_SHARED_SECRET`, `APP_ORIGINS`, `ANTHROPIC_API_KEY`.
4. Put `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `apps/web/.env`.
5. Sign in, open **Etsy shop → Connect**, then send your first product as a draft.

## Safety rails built in

- **Drafts only.** Pushing never publishes. Publishing is a separate button with a confirmation.
- **Etsy rules enforced before upload**: 140-char title, 13 tags × 20 chars, allowed characters, `% : & +` once each, ≤3 all-caps words, price ≥ 0.20, ≤10 images, ≤5 files, ≤20 MB each.
- **AI disclosure** line added to descriptions by default (toggle in Settings).
- **Secrets stay server-side.** Etsy tokens live in a table with RLS and no policies; only edge functions read them. The shared secret never reaches the browser.
- **Re-push is idempotent.** Updating a draft replaces its images and files instead of duplicating them.

## Project layout

```
packages/core/src
  spec/        product spec types, themes, currencies
  templates/   the product catalogue (spreadsheets.ts, printables.ts)
  generators/  xlsx (exceljs) + pdf (pdf-lib) + formula placeholder resolver
  preview/     Excel-formula evaluator → real numbers in previews/mockups
  listing/     Etsy listing rules, auto-fix, rule-based copy, AI prompt + parser
  etsy/        OAuth PKCE, API v3 client, push/publish orchestration
apps/web/src
  pages/       Products, NewProduct, ProductDetail, Shop, Settings, Login
  mockups/     canvas renderers: spreadsheet tabs, PDF pages, 5 listing images
  lib/         data store (Supabase or local IndexedDB), build pipeline
supabase/
  migrations/  schema + RLS + storage policies
  functions/   etsy-oauth, etsy-api, ai-copy, product-generate (+ _shared/core, synced)
```

`supabase/functions/_shared/core` is a copy of `packages/core/src`. After changing core, run `npm run sync:shared`.
