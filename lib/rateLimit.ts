export async function overRateLimit(
  kv: KVNamespace | undefined,
  key: string,
  limit: number,
  windowSeconds = 3600,
): Promise<boolean> {
  if (!kv || !key) return false;
  const count = Number((await kv.get(key)) ?? 0);
  if (count >= limit) return true;
  await kv.put(key, String(count + 1), { expirationTtl: windowSeconds });
  return false;
}

// Read-only check, for limits where the caller — not the counter — decides what an attempt cost.
// Sign-in uses it so that only failures move the number: counting successes let a shared office IP
// lock every salon behind it out for an hour just by working normally.
export async function rateLimited(
  kv: KVNamespace | undefined,
  key: string,
  limit: number,
): Promise<boolean> {
  if (!kv || !key) return false;
  return Number((await kv.get(key)) ?? 0) >= limit;
}

export async function bumpRateLimit(
  kv: KVNamespace | undefined,
  key: string,
  windowSeconds = 3600,
): Promise<void> {
  if (!kv || !key) return;
  const count = Number((await kv.get(key)) ?? 0);
  await kv.put(key, String(count + 1), { expirationTtl: windowSeconds });
}

export async function clearRateLimit(kv: KVNamespace | undefined, key: string): Promise<void> {
  if (!kv || !key) return;
  await kv.delete(key);
}
