import { describe, expect, it } from "bun:test";
import { contactLabel, promoCodeFor } from "@/lib/sales/offer";

describe("promoCodeFor", () => {
  it("gives every campaign neighbourhood its own code", () => {
    expect(promoCodeFor("Hialeah")).toBe("HIALEAH20");
    expect(promoCodeFor("West Kendall")).toBe("WESTKENDALL20");
    expect(promoCodeFor("Miami Lakes")).toBe("MIAMILAKES20");
    expect(promoCodeFor("Stratford")).toBe("STRATFORD20");
  });

  it("has none for areas outside the campaign", () => {
    expect(promoCodeFor("other (33143)")).toBeNull();
    expect(promoCodeFor("")).toBeNull();
  });
});

describe("contactLabel", () => {
  it("names the call the rep is about to make, not the one already logged", () => {
    expect(contactLabel(0)).toBe("first contact");
    expect(contactLabel(1)).toBe("call #2");
    expect(contactLabel(4)).toBe("call #5");
  });

  it("counts visits on a route", () => {
    expect(contactLabel(0, "walk")).toBe("first contact");
    expect(contactLabel(1, "walk")).toBe("visit #2");
  });
});
