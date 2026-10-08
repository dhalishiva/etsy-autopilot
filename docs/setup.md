# Setup: connecting Supabase and Etsy

Allow about 30 minutes. You need a Supabase account, an Etsy seller shop, and (optionally) an Anthropic API key for AI listing copy.

## 1. Etsy seller shop

1. Open a shop at <https://www.etsy.com/sell>. Indian sellers verify identity and add a bank account for payouts.
2. List one item by hand (any digital item). Etsy needs an active shop before the API can create listings.

## 2. Supabase project

1. Create a project at <https://supabase.com/dashboard> (region: Mumbai is closest to Noida).
2. Install the CLI and link the repo:
   ```bash
   npm i -g supabase
   supabase login
   supabase link --project-ref <project-ref>
   ```
3. Apply the schema (tables, RLS, storage bucket):
   ```bash
   supabase db push
   ```
4. **Auth → Providers → Email**: keep enabled. **Auth → URL configuration**: add your app URL(s), e.g. `http://localhost:5173` and your Vercel domain.

## 3. Etsy app

1. Go to <https://www.etsy.com/developers/your-apps> → **Create a new app**.
2. Callback URL: `https://<project-ref>.supabase.co/functions/v1/etsy-oauth`
3. Copy the **keystring** and **shared secret**.
4. New apps start with personal access, which is enough to manage your own shop. Etsy may take a few days to approve the app.

## 4. Secrets and functions

```bash
supabase secrets set \
  ETSY_KEYSTRING=xxxxxxxx \
  ETSY_SHARED_SECRET=xxxxxxxx \
  APP_ORIGINS=http://localhost:5173,https://your-app.vercel.app \
  ANTHROPIC_API_KEY=sk-ant-xxxx

npm run sync:shared
supabase functions deploy etsy-oauth --no-verify-jwt
supabase functions deploy etsy-api
supabase functions deploy ai-copy
supabase functions deploy product-generate
```

Optional: `AI_MODEL` (default `claude-sonnet-5-5`), `ETSY_REDIRECT_URI` (only if you use a custom domain for functions).

## 5. Web app

```bash
cp apps/web/.env.example apps/web/.env
# fill VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (Project settings → API)
npm run dev
```

Deploy to Vercel: root directory `apps/web`, build command `npm run build`, output `dist`, plus the two `VITE_` env vars. Add a rewrite of `/(.*)` → `/index.html` for client-side routes (`apps/web/vercel.json` does this).

## 6. First listing

1. Sign in with your email code.
2. **Etsy shop → Connect Etsy shop**, approve on Etsy.
3. **New product** → pick a template → **Create product**.
4. On the product page: review the listing, **Write with AI** if you like, pick an Etsy category (search "templates" or "planners"), **Send to Etsy as a draft**.
5. Check the draft on Etsy (it opens in Etsy's listing editor), then **Publish on Etsy**.

## Troubleshooting

| Message | Fix |
|---|---|
| "redirectTo is not an allowed app origin" | Add your app's origin to `APP_ORIGINS` and redeploy `etsy-oauth`. |
| Etsy shows "invalid redirect_uri" | The callback on your Etsy app must exactly match `https://<ref>.supabase.co/functions/v1/etsy-oauth`. |
| "Etsy session expired — reconnect" | Refresh tokens last 90 days. Reconnect from the Etsy shop page. |
| 403 on create listing | The Etsy app isn't approved yet, or the shop isn't fully set up (payments/billing). |
| "Pick an Etsy category first" | Search the category box on the product page and choose a leaf category. |
