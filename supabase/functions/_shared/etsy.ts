import type { SupabaseClient } from '@supabase/supabase-js';
import { EtsyClient, refreshTokens } from './core/etsy/index.ts';
import { HttpError, env } from './http.ts';

export function baseClient(): EtsyClient {
  return new EtsyClient({ keystring: env('ETSY_KEYSTRING'), sharedSecret: env('ETSY_SHARED_SECRET') });
}

export function redirectUri(): string {
  // Must exactly match the callback URL registered on your Etsy app.
  return Deno.env.get('ETSY_REDIRECT_URI') ?? `${env('SUPABASE_URL')}/functions/v1/etsy-oauth`;
}

/** Returns an authenticated client for the user, refreshing the token when needed. */
export async function clientFor(db: SupabaseClient, userId: string): Promise<{ client: EtsyClient; shopId: number }> {
  const [{ data: tok }, { data: conn }] = await Promise.all([
    db.from('etsy_tokens').select('*').eq('user_id', userId).maybeSingle(),
    db.from('etsy_connections').select('shop_id').eq('user_id', userId).maybeSingle(),
  ]);
  if (!tok || !conn) throw new HttpError(409, 'Connect your Etsy shop first');
  if (!conn.shop_id) throw new HttpError(409, 'Your Etsy account has no shop yet — open one on Etsy first');

  let accessToken = tok.access_token as string;
  if (new Date(tok.expires_at).getTime() - Date.now() < 120_000) {
    try {
      const fresh = await refreshTokens({ clientId: env('ETSY_KEYSTRING'), refreshToken: tok.refresh_token });
      accessToken = fresh.access_token;
      await db
        .from('etsy_tokens')
        .update({
          access_token: fresh.access_token,
          refresh_token: fresh.refresh_token,
          expires_at: new Date(Date.now() + fresh.expires_in * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);
    } catch (e) {
      throw new HttpError(401, `Etsy session expired — reconnect your shop (${(e as Error).message.slice(0, 120)})`);
    }
  }
  return { client: baseClient().withToken(accessToken), shopId: Number(conn.shop_id) };
}
