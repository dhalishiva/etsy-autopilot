// Etsy OAuth (PKCE).
//   POST {redirectTo}         (signed-in user) → { url } to send the browser to
//   GET  ?code=…&state=…      (Etsy callback)  → stores tokens, redirects back to the app
// Deploy with verify_jwt = false (see supabase/config.toml): the Etsy callback carries no
// Supabase JWT, so the POST branch checks the user itself and the GET branch trusts only `state`.
import { buildAuthorizeUrl, ETSY_SCOPES, exchangeCode, pkceChallenge, randomToken, userIdFromToken } from '../_shared/core/etsy/index.ts';
import { baseClient, redirectUri } from '../_shared/etsy.ts';
import { HttpError, admin, env, handle, json, requireUser } from '../_shared/http.ts';

const STATE_TTL_MS = 15 * 60 * 1000;

function allowedRedirect(target: string): string {
  const allowed = (Deno.env.get('APP_ORIGINS') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  try {
    const u = new URL(target);
    if (allowed.length === 0 || allowed.includes(u.origin)) return u.toString();
  } catch {
    /* fall through */
  }
  throw new HttpError(400, 'redirectTo is not an allowed app origin (set APP_ORIGINS)');
}

function back(to: string, params: Record<string, string>): Response {
  const u = new URL(to);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  return new Response(null, { status: 302, headers: { Location: u.toString() } });
}

Deno.serve(
  handle(async (req) => {
    const db = admin();

    if (req.method === 'POST') {
      const user = await requireUser(req);
      const { redirectTo } = (await req.json().catch(() => ({}))) as { redirectTo?: string };
      const target = allowedRedirect(redirectTo ?? '');
      const state = randomToken(32);
      const verifier = randomToken(64);
      // Housekeeping: drop stale states.
      await db.from('oauth_states').delete().lt('created_at', new Date(Date.now() - STATE_TTL_MS).toISOString());
      const { error } = await db.from('oauth_states').insert({ state, user_id: user.id, code_verifier: verifier, redirect_to: target });
      if (error) throw new HttpError(500, error.message);
      const url = buildAuthorizeUrl({
        clientId: env('ETSY_KEYSTRING'),
        redirectUri: redirectUri(),
        state,
        codeChallenge: await pkceChallenge(verifier),
        scopes: ETSY_SCOPES,
      });
      return json({ url });
    }

    if (req.method === 'GET') {
      const q = new URL(req.url).searchParams;
      const state = q.get('state') ?? '';
      const { data: row } = await db.from('oauth_states').select('*').eq('state', state).maybeSingle();
      if (!row) return new Response('This Etsy sign-in link has expired. Go back to the app and try again.', { status: 400 });
      await db.from('oauth_states').delete().eq('state', state);
      if (Date.now() - new Date(row.created_at).getTime() > STATE_TTL_MS) return back(row.redirect_to, { etsy: 'expired' });
      if (q.get('error')) return back(row.redirect_to, { etsy: 'denied' });

      try {
        const tokens = await exchangeCode({
          clientId: env('ETSY_KEYSTRING'),
          redirectUri: redirectUri(),
          code: q.get('code') ?? '',
          verifier: row.code_verifier,
        });
        const client = baseClient().withToken(tokens.access_token);
        const me = await client.getMe();
        const shop = me.shop_id ? await client.getShop(me.shop_id) : null;
        const now = new Date().toISOString();
        await db.from('etsy_tokens').upsert({
          user_id: row.user_id,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
          updated_at: now,
        });
        await db.from('etsy_connections').upsert({
          user_id: row.user_id,
          etsy_user_id: me.user_id ?? userIdFromToken(tokens.access_token),
          shop_id: me.shop_id ?? null,
          shop_name: shop?.shop_name ?? null,
          shop_url: shop?.url ?? null,
          currency_code: shop?.currency_code ?? null,
          scopes: ETSY_SCOPES,
          updated_at: now,
        });
        await db.from('events').insert({ user_id: row.user_id, kind: 'connected', message: `Connected Etsy shop ${shop?.shop_name ?? ''}`.trim() });
        return back(row.redirect_to, { etsy: 'connected' });
      } catch (e) {
        console.error(e);
        return back(row.redirect_to, { etsy: 'error', reason: (e as Error).message.slice(0, 200) });
      }
    }

    return json({ error: 'Method not allowed' }, 405);
  }),
);
