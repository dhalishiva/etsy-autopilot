/**
 * Etsy OAuth 2.0 (authorization code + PKCE). Runtime-agnostic: works in
 * Deno (edge functions), Node 20+ and browsers via WebCrypto + fetch.
 */

export const ETSY_AUTHORIZE_URL = 'https://www.etsy.com/oauth/connect';
export const ETSY_TOKEN_URL = 'https://api.etsy.com/v3/public/oauth/token';

/** Scopes the app needs: manage listings, read shop/profile, read sales for stats. */
export const ETSY_SCOPES = ['listings_r', 'listings_w', 'listings_d', 'shops_r', 'profile_r', 'transactions_r'];

export interface TokenSet {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

const B64URL = (bytes: Uint8Array) => {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

export function randomToken(length = 64): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let out = '';
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return out;
}

export async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return B64URL(new Uint8Array(digest));
}

export function buildAuthorizeUrl(p: {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
  scopes?: string[];
}): string {
  const q = new URLSearchParams({
    response_type: 'code',
    client_id: p.clientId,
    redirect_uri: p.redirectUri,
    scope: (p.scopes ?? ETSY_SCOPES).join(' '),
    state: p.state,
    code_challenge: p.codeChallenge,
    code_challenge_method: 'S256',
  });
  // Etsy expects %20 between scopes, URLSearchParams uses '+'.
  return `${ETSY_AUTHORIZE_URL}?${q.toString().replace(/\+/g, '%20')}`;
}

async function tokenRequest(body: Record<string, string>, fetchImpl: typeof fetch = fetch): Promise<TokenSet> {
  const res = await fetchImpl(ETSY_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body).toString(),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Etsy token request failed (${res.status}): ${text.slice(0, 300)}`);
  return JSON.parse(text) as TokenSet;
}

export function exchangeCode(
  p: { clientId: string; redirectUri: string; code: string; verifier: string },
  fetchImpl?: typeof fetch,
): Promise<TokenSet> {
  return tokenRequest(
    {
      grant_type: 'authorization_code',
      client_id: p.clientId,
      redirect_uri: p.redirectUri,
      code: p.code,
      code_verifier: p.verifier,
    },
    fetchImpl,
  );
}

export function refreshTokens(p: { clientId: string; refreshToken: string }, fetchImpl?: typeof fetch): Promise<TokenSet> {
  return tokenRequest({ grant_type: 'refresh_token', client_id: p.clientId, refresh_token: p.refreshToken }, fetchImpl);
}

/** Etsy access tokens are prefixed with the numeric user id: `12345678.abc…`. */
export function userIdFromToken(accessToken: string): number | null {
  const id = Number(accessToken.split('.')[0]);
  return Number.isFinite(id) && id > 0 ? id : null;
}
