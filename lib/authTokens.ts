// One-off tokens for email verification and password reset. Separate KV keyspace from sessions
// (`sess:`) so a leaked token never doubles as a session id.
const VERIFY_TTL_SECONDS = 24 * 60 * 60;
const RESET_TTL_SECONDS = 60 * 60;

const verifyKey = (token: string) => `verify:${token}`;
const resetKey = (token: string) => `pwreset:${token}`;

export async function createVerifyToken(
  kv: KVNamespace | undefined,
  accountId: string,
): Promise<string | null> {
  if (!kv) return null;
  const token = crypto.randomUUID();
  await kv.put(verifyKey(token), accountId, { expirationTtl: VERIFY_TTL_SECONDS });
  return token;
}

// Deletes on read — a verify link only ever confirms one address.
export async function consumeVerifyToken(
  kv: KVNamespace | undefined,
  token: string,
): Promise<string | null> {
  if (!kv || !token) return null;
  const accountId = await kv.get(verifyKey(token));
  if (!accountId) return null;
  await kv.delete(verifyKey(token)).catch(() => {});
  return accountId;
}

export async function createResetToken(
  kv: KVNamespace | undefined,
  accountId: string,
): Promise<string | null> {
  if (!kv) return null;
  const token = crypto.randomUUID();
  await kv.put(resetKey(token), accountId, { expirationTtl: RESET_TTL_SECONDS });
  return token;
}

// Deletes on read — a reset link is single-use, so a stolen link stops working the moment it's used.
export async function consumeResetToken(
  kv: KVNamespace | undefined,
  token: string,
): Promise<string | null> {
  if (!kv || !token) return null;
  const accountId = await kv.get(resetKey(token));
  if (!accountId) return null;
  await kv.delete(resetKey(token)).catch(() => {});
  return accountId;
}
