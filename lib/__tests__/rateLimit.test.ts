import { beforeEach, describe, expect, it } from "bun:test";
import { bumpRateLimit, clearRateLimit, overRateLimit, rateLimited } from "@/lib/rateLimit";

// Enough of KV for counters: values and the TTL each write asked for.
function kvStub() {
  const store = new Map<string, { value: string; ttl?: number }>();
  return {
    store,
    kv: {
      get: async (key: string) => store.get(key)?.value ?? null,
      put: async (key: string, value: string, options?: { expirationTtl?: number }) => {
        store.set(key, { value, ttl: options?.expirationTtl });
      },
      delete: async (key: string) => {
        store.delete(key);
      },
    } as unknown as KVNamespace,
  };
}

let stub: ReturnType<typeof kvStub>;

beforeEach(() => {
  stub = kvStub();
});

describe("overRateLimit", () => {
  it("counts every call and blocks once the window is full", async () => {
    for (let i = 0; i < 3; i++) {
      expect(await overRateLimit(stub.kv, "k", 3)).toBe(false);
    }
    expect(await overRateLimit(stub.kv, "k", 3)).toBe(true);
  });

  it("is a no-op without a namespace or a key", async () => {
    expect(await overRateLimit(undefined, "k", 0)).toBe(false);
    expect(await overRateLimit(stub.kv, "", 0)).toBe(false);
    expect(stub.store.size).toBe(0);
  });
});

describe("rateLimited", () => {
  it("reads the counter without moving it", async () => {
    await bumpRateLimit(stub.kv, "k");
    expect(await rateLimited(stub.kv, "k", 2)).toBe(false);
    expect(await rateLimited(stub.kv, "k", 2)).toBe(false);
    // Three reads, still one recorded attempt — this is what keeps a successful sign-in free.
    expect(stub.store.get("k")?.value).toBe("1");
    await bumpRateLimit(stub.kv, "k");
    expect(await rateLimited(stub.kv, "k", 2)).toBe(true);
  });

  it("carries the window on every write", async () => {
    await bumpRateLimit(stub.kv, "k");
    await bumpRateLimit(stub.kv, "k");
    expect(stub.store.get("k")?.ttl).toBe(3600);
  });
});

describe("clearRateLimit", () => {
  it("wipes a failure streak, so a later correct password starts clean", async () => {
    await bumpRateLimit(stub.kv, "acct");
    await bumpRateLimit(stub.kv, "acct");
    await clearRateLimit(stub.kv, "acct");
    expect(await rateLimited(stub.kv, "acct", 1)).toBe(false);
  });

  it("is a no-op without a namespace or a key", async () => {
    await bumpRateLimit(stub.kv, "acct");
    await clearRateLimit(undefined, "acct");
    await clearRateLimit(stub.kv, "");
    expect(stub.store.has("acct")).toBe(true);
  });
});

describe("sign-in buckets", () => {
  // The shape the login route uses: one shared-IP bucket, one per-account bucket, both charged
  // only on a rejected password. A salon behind NAT signing in all day never fills either.
  const IP = "auth:login:203.0.113.7";
  const ACCT = "auth:login:acct:luis@barbarossa.com";

  async function attempt(correct: boolean) {
    if (await rateLimited(stub.kv, IP, 50)) return "429";
    if (await rateLimited(stub.kv, ACCT, 10)) return "429";
    if (!correct) {
      await Promise.all([bumpRateLimit(stub.kv, IP), bumpRateLimit(stub.kv, ACCT)]);
      return "401";
    }
    await clearRateLimit(stub.kv, ACCT);
    return "200";
  }

  it("never locks out a shared address that keeps signing in successfully", async () => {
    for (let i = 0; i < 40; i++) expect(await attempt(true)).toBe("200");
    expect(stub.store.has(IP)).toBe(false);
  });

  it("still stops a brute-force run on one account", async () => {
    for (let i = 0; i < 10; i++) expect(await attempt(false)).toBe("401");
    expect(await attempt(false)).toBe("429");
    // And the block is real: the right password can't slip past the closed window either.
    expect(await attempt(true)).toBe("429");
  });

  it("forgives typos once the owner gets it right", async () => {
    for (let i = 0; i < 9; i++) await attempt(false);
    expect(await attempt(true)).toBe("200");
    for (let i = 0; i < 9; i++) expect(await attempt(false)).toBe("401");
  });
});
