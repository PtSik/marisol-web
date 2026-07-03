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
