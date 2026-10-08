# Android app plan

The backend was built API-first so the Android app is a client, not a rewrite.

## Approach

Native **Kotlin + Jetpack Compose**, talking to the same Supabase project:

| Need | Android implementation |
|---|---|
| Sign in | `supabase-kt` Auth (email OTP), same users as web |
| Products list / stage rail | Postgrest via `supabase-kt`, same `products` table and RLS |
| Create product | Insert row → call `product-generate` edge function (server builds the files with the exact same core code) |
| Listing images | Phase 1: generated on web and stored; Phase 2: server-side mockups (`mockup-generate` function using SVG → PNG via resvg-wasm), so Android never draws them |
| Listing copy | `ai-copy` edge function |
| Etsy push / publish | `etsy-api` edge function (`push`, `publish`, `sync`) |
| Etsy connect | Custom Tab to the URL returned by `etsy-oauth` (POST), redirect back via an app link |
| Notifications | FCM push when a listing sells (`orders` poll in a scheduled function) |

## Screens (mirror the web bottom-tab layout)

1. **Products** — list with stage rail and filter chips
2. **New** — template grid → params → create
3. **Product** — image pager, listing editor, one primary action button
4. **Etsy shop** — connection, recent orders
5. **Settings**

## Milestones

1. Read-only: sign in, list products, view product + images, open on Etsy.
2. Actions: push draft, publish, regenerate, AI copy, edit listing.
3. Create from template + server-side mockups.
4. Sales notifications.

Work starts once the web flow has been used for real listings, so the API shape is settled.
