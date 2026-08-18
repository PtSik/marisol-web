import { describe, expect, it } from "bun:test";
import { looksLikeKey, normaliseRep, salesReturnTo } from "@/lib/salesAuth";

const BASE = "https://callmarisol.com/api/sales/login";

describe("salesReturnTo", () => {
  it("accepts the queue and a lead's own page, filters and all", () => {
    expect(salesReturnTo("/sales", BASE)?.pathname).toBe("/sales");
    expect(salesReturnTo("/sales/happy-paws", BASE)?.pathname).toBe("/sales/happy-paws");
    expect(salesReturnTo("/sales/happy-paws?neighborhood=Stratford&page=2", BASE)?.search).toBe(
      "?neighborhood=Stratford&page=2",
    );
  });

  it("refuses anything that would leave /sales or the origin", () => {
    expect(salesReturnTo("//evil.com", BASE)).toBeNull();
    expect(salesReturnTo("https://evil.com/sales", BASE)).toBeNull();
    expect(salesReturnTo("/admin", BASE)).toBeNull();
    expect(salesReturnTo("/sales/../admin", BASE)).toBeNull();
    expect(salesReturnTo("/sales/deep/path", BASE)).toBeNull();
    expect(salesReturnTo(null, BASE)).toBeNull();
    expect(salesReturnTo(42, BASE)).toBeNull();
  });
});

describe("normaliseRep", () => {
  it("collapses whitespace and caps the length", () => {
    expect(normaliseRep("  Marco   Diaz ")).toBe("Marco Diaz");
    expect(normaliseRep("   ")).toBeNull();
    expect(normaliseRep("x".repeat(40))?.length).toBe(24);
  });
});

describe("looksLikeKey", () => {
  it("catches the key pasted into the name field", () => {
    expect(looksLikeKey("supersecretkey123", "supersecretkey123")).toBe(true);
    expect(looksLikeKey("supersecret", "supersecretkey123")).toBe(true);
    expect(looksLikeKey("Marco", "supersecretkey123")).toBe(false);
  });
});
