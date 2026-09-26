import { describe, expect, it } from "bun:test";
import { hmacSha256Hex } from "@/lib/crypto";

// voice-agent recomputes these signatures itself, so the output format is a cross-repo contract.
describe("hmacSha256Hex", () => {
  it("matches the published HMAC-SHA256 vector as lowercase hex", async () => {
    expect(await hmacSha256Hex("key", "The quick brown fox jumps over the lazy dog")).toBe(
      "f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8",
    );
  });
});
