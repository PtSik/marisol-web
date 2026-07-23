const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const JWKS_ENDPOINT = "https://www.googleapis.com/oauth2/v3/certs";
const ISSUERS = ["accounts.google.com", "https://accounts.google.com"];

export interface GoogleIdentity {
  email: string;
  sub: string;
}

export function callbackUrl(requestUrl: string): string {
  return new URL("/api/auth/google/callback", requestUrl).toString();
}

export function buildAuthUrl(clientId: string, redirectUri: string, state: string): string {
  const url = new URL(AUTH_ENDPOINT);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  // Owners sign in from a shared shop machine as often as their own phone, so always let
  // them pick which Google account they land in.
  url.searchParams.set("prompt", "select_account");
  return url.toString();
}

export async function exchangeCode(
  clientId: string,
  clientSecret: string,
  redirectUri: string,
  code: string,
): Promise<string | null> {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  }).catch(() => null);
  if (!res?.ok) return null;
  const body = (await res.json().catch(() => null)) as { id_token?: string } | null;
  return body?.id_token ?? null;
}

function b64urlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded.padEnd(padded.length + ((4 - (padded.length % 4)) % 4), "="));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function b64urlToJson<T>(value: string): T | null {
  try {
    return JSON.parse(new TextDecoder().decode(b64urlToBytes(value))) as T;
  } catch {
    return null;
  }
}

interface Jwk extends JsonWebKey {
  kid?: string;
}

async function signingKey(kid: string): Promise<CryptoKey | null> {
  const res = await fetch(JWKS_ENDPOINT).catch(() => null);
  if (!res?.ok) return null;
  const jwks = (await res.json().catch(() => null)) as { keys?: Jwk[] } | null;
  const jwk = jwks?.keys?.find((k) => k.kid === kid);
  if (!jwk) return null;
  return crypto.subtle
    .importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"])
    .catch(() => null);
}

interface IdTokenClaims {
  iss?: string;
  aud?: string;
  exp?: number;
  sub?: string;
  email?: string;
  email_verified?: boolean;
}

// The token arrives straight from Google's endpoint over TLS, but it is also the only thing
// standing between a stranger and a client's portal — so verify it as if it had been handed
// to us by the browser: signature first, then issuer, audience, expiry and a verified address.
export async function verifyIdToken(
  idToken: string,
  clientId: string,
): Promise<GoogleIdentity | null> {
  const [headerPart, payloadPart, signaturePart] = idToken.split(".");
  if (!headerPart || !payloadPart || !signaturePart) return null;

  const header = b64urlToJson<{ alg?: string; kid?: string }>(headerPart);
  if (header?.alg !== "RS256" || !header.kid) return null;

  const key = await signingKey(header.kid);
  if (!key) return null;

  const verified = await crypto.subtle
    .verify(
      "RSASSA-PKCS1-v1_5",
      key,
      b64urlToBytes(signaturePart),
      new TextEncoder().encode(`${headerPart}.${payloadPart}`),
    )
    .catch(() => false);
  if (!verified) return null;

  const claims = b64urlToJson<IdTokenClaims>(payloadPart);
  if (!claims?.sub || !claims.email) return null;
  if (!ISSUERS.includes(claims.iss ?? "")) return null;
  if (claims.aud !== clientId) return null;
  if (!claims.exp || claims.exp * 1000 <= Date.now()) return null;
  if (claims.email_verified !== true) return null;

  return { email: claims.email.trim().toLowerCase(), sub: claims.sub };
}
