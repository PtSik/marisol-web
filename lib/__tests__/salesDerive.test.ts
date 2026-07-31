import { describe, expect, it } from "bun:test";
import {
  esStrength,
  formatUsPhone,
  hook,
  openNow,
  parseNotes,
  scoreLead,
  slugify,
  tier,
  toE164,
  uniqueSlug,
} from "@/lib/sales/derive";
import { looksLikeKey, normaliseRep } from "@/lib/salesAuth";

// Places returns Spanish results for a Spanish query everywhere in Miami, so query_es appears on 89
// of 120 leads and means nothing. Treating it as a signal would send Spanish demos to English shops.
describe("esStrength", () => {
  it("ignores query_es entirely", () => {
    expect(esStrength("query_es")).toBe("none");
    expect(esStrength("")).toBe("none");
  });

  it("trusts the shop's own name and website", () => {
    expect(esStrength("query_es; name_es")).toBe("strong");
    expect(esStrength("site_es")).toBe("strong");
  });

  it("treats review language as a weak signal", () => {
    expect(esStrength("query_es; reviews_es(3/5)")).toBe("weak");
  });

  it("prefers the strong signal when both are present", () => {
    expect(esStrength("site_es; reviews_es(3/5)")).toBe("strong");
  });
});

describe("scoreLead", () => {
  const base = {
    is_mobile: false,
    is_chain: false,
    booking_app: "unknown",
    review_count: 0,
    es_strength: "none" as const,
  };

  it("rewards the review band that loses calls without a front desk", () => {
    expect(scoreLead({ ...base, review_count: 95 })).toBe(scoreLead(base) + 2);
    expect(scoreLead({ ...base, review_count: 300 })).toBe(scoreLead(base));
  });

  it("penalises shops big enough to already answer their phone", () => {
    expect(scoreLead({ ...base, review_count: 900 })).toBe(scoreLead(base) - 3);
  });

  it("demotes a booking system without excluding it", () => {
    expect(scoreLead({ ...base, booking_app: "moego" })).toBeLessThan(scoreLead(base));
  });

  it("scores the strongest lead in the Miami list at 14", () => {
    expect(
      scoreLead({
        is_mobile: true,
        is_chain: false,
        booking_app: "none",
        review_count: 95,
        es_strength: "strong",
      }),
    ).toBe(14);
  });
});

describe("tier", () => {
  it("pushes chains and 800+ review shops out of the queue", () => {
    expect(tier({ is_chain: true, review_count: 10 }, 12)).toBe("X");
    expect(tier({ is_chain: false, review_count: 934 }, 12)).toBe("X");
  });

  it("bands the rest by score", () => {
    expect(tier({ is_chain: false, review_count: 100 }, 9)).toBe("A");
    expect(tier({ is_chain: false, review_count: 100 }, 6)).toBe("B");
    expect(tier({ is_chain: false, review_count: 100 }, 5)).toBe("C");
  });
});

describe("slugify", () => {
  it("strips accents rather than dropping the letters", () => {
    expect(slugify("Peluquería Canina Ñandú")).toBe("peluqueria-canina-nandu");
  });

  it("cuts on a word boundary so an SMS link stays readable", () => {
    const slug = slugify(
      "Alexzaida's Grooming - Limpieza Dental Para Perros Pequeños Sin Anestesia",
    );
    expect(slug.length).toBeLessThanOrEqual(40);
    expect(slug.endsWith("-")).toBe(false);
    expect(slug).toBe("alexzaida-s-grooming-limpieza-dental");
  });

  it("collapses punctuation into single dashes", () => {
    expect(slugify("Lilo’s Dog Hotels & Daycare")).toBe("lilo-s-dog-hotels-daycare");
  });
});

describe("uniqueSlug", () => {
  it("disambiguates a repeated shop name by neighbourhood, then by counter", () => {
    const taken = new Set<string>();
    const first = uniqueSlug("Pet Supermarket", "Hialeah", taken);
    taken.add(first);
    const second = uniqueSlug("Pet Supermarket", "Hialeah", taken);
    taken.add(second);
    const third = uniqueSlug("Pet Supermarket", "Hialeah", taken);

    expect(first).toBe("pet-supermarket");
    expect(second).toBe("pet-supermarket-hialeah");
    expect(third).toBe("pet-supermarket-2");
  });

  it("never hands out a slug that would shadow a real route", () => {
    expect(uniqueSlug("Portal", "Doral", new Set())).not.toBe("portal");
  });
});

describe("phone formatting", () => {
  it("makes the scraper's format dialable and readable", () => {
    expect(formatUsPhone("+1305-231-9559")).toBe("(305) 231-9559");
    expect(toE164("+1305-231-9559")).toBe("+13052319559");
  });

  it("leaves anything that is not a 10-digit US number alone", () => {
    expect(formatUsPhone("+44 20 7946 0958")).toBe("+44 20 7946 0958");
  });
});

describe("parseNotes", () => {
  it("reads the full four-segment shape", () => {
    const parsed = parseNotes(
      "4.9★ 934 reviews · Monday: 6:30 AM – 10:00 PM | Sunday: Closed · prices: $75 $210 · 1165 W 49th St #205, Hialeah, FL 33012",
    );
    expect(parsed.rating).toBe(4.9);
    expect(parsed.reviewCount).toBe(934);
    expect(parsed.hours).toContain("Monday: 6:30 AM");
    expect(parsed.prices).toBe("$75 $210");
    expect(parsed.address).toBe("1165 W 49th St #205, Hialeah, FL 33012");
  });

  it("handles rating plus address with no hours", () => {
    const parsed = parseNotes("3.9★ 7 reviews · 7225 NW 25th St, Miami, FL 33122");
    expect(parsed.hours).toBeNull();
    expect(parsed.address).toBe("7225 NW 25th St, Miami, FL 33122");
  });

  it("handles hours plus address with no rating", () => {
    const parsed = parseNotes(
      "Monday: Closed | Tuesday: 9:00 AM – 5:00 PM · 14261 SW 120th St, Miami, FL 33186",
    );
    expect(parsed.rating).toBeNull();
    expect(parsed.hours).toContain("Tuesday: 9:00 AM");
    expect(parsed.address).toBe("14261 SW 120th St, Miami, FL 33186");
  });

  it("handles a rating on its own", () => {
    const parsed = parseNotes("5★ 47 reviews");
    expect(parsed.rating).toBe(5);
    expect(parsed.address).toBeNull();
    expect(parsed.hours).toBeNull();
  });

  it("never mistakes hours for an address", () => {
    const parsed = parseNotes(
      "Monday: Open 24 hours | Sunday: Open 24 hours · 16002 SW 73rd St, Miami, FL 33157",
    );
    expect(parsed.address).not.toContain("Monday");
    expect(parsed.hours).not.toContain(", FL");
  });
});

// Fixed instants in Eastern time; the shop timezone is what matters, not the machine's.
const at = (iso: string) => new Date(iso);

describe("openNow", () => {
  const weekday = "Monday: 9:00 AM – 5:00 PM | Tuesday: 9:00 AM – 5:00 PM | Sunday: Closed";

  it("is open inside business hours", () => {
    // Monday 2026-08-03, 14:00 ET = 18:00 UTC
    expect(openNow(weekday, at("2026-08-03T18:00:00Z"))).toBe("open");
  });

  it("is closed before opening and after closing", () => {
    expect(openNow(weekday, at("2026-08-03T12:00:00Z"))).toBe("closed");
    expect(openNow(weekday, at("2026-08-03T22:00:00Z"))).toBe("closed");
  });

  it("is closed on an explicit Closed day", () => {
    // Sunday 2026-08-02, 14:00 ET
    expect(openNow(weekday, at("2026-08-02T18:00:00Z"))).toBe("closed");
  });

  it("separates a missing day from a closed one", () => {
    expect(openNow("Monday: 9:00 AM – 5:00 PM", at("2026-08-04T18:00:00Z"))).toBe("unknown");
    expect(openNow("", at("2026-08-03T18:00:00Z"))).toBe("unknown");
    expect(openNow(null, at("2026-08-03T18:00:00Z"))).toBe("unknown");
  });

  it("treats Open 24 hours as always open", () => {
    const always = "Monday: Open 24 hours | Tuesday: Open 24 hours";
    expect(openNow(always, at("2026-08-03T06:00:00Z"))).toBe("open");
  });

  it("closes right at the closing minute", () => {
    // Monday 17:00 ET exactly = 21:00 UTC
    expect(openNow(weekday, at("2026-08-03T21:00:00Z"))).toBe("closed");
    expect(openNow(weekday, at("2026-08-03T20:59:00Z"))).toBe("open");
  });

  it("keeps a shop open past midnight into the next day", () => {
    const late = "Friday: 6:00 PM – 2:00 AM | Saturday: Closed";
    // Saturday 2026-08-08 01:00 ET = 05:00 UTC — still Friday's session
    expect(openNow(late, at("2026-08-08T05:00:00Z"))).toBe("open");
    // Saturday 03:00 ET — that session has ended
    expect(openNow(late, at("2026-08-08T07:00:00Z"))).toBe("closed");
  });

  it("reads the clock in Miami, not in UTC", () => {
    // Both directions, chosen so a UTC reading gives the wrong answer either way:
    // 20:30 UTC is 16:30 ET — open, while UTC alone is past closing.
    expect(openNow(weekday, at("2026-08-03T20:30:00Z"))).toBe("open");
    // 12:00 UTC is 08:00 ET — closed, while UTC alone is mid-morning.
    expect(openNow(weekday, at("2026-08-03T12:00:00Z"))).toBe("closed");
  });

  it("still works after the autumn DST change", () => {
    // 2026-11-09 is a Monday on EST (UTC-5); 14:00 ET = 19:00 UTC
    expect(openNow(weekday, at("2026-11-09T19:00:00Z"))).toBe("open");
    expect(openNow(weekday, at("2026-11-09T13:30:00Z"))).toBe("closed");
  });
});

describe("hook", () => {
  it("leads with the missing booking system and caps at three signals", () => {
    const line = hook({
      booking_app: "none",
      is_mobile: true,
      review_count: 95,
      es_strength: "strong",
    });
    expect(line).toBe("no booking system · mobile groomer · Spanish-speaking");
  });

  it("names the booking system when there is one", () => {
    expect(
      hook({ booking_app: "moego", is_mobile: false, review_count: 40, es_strength: "none" }),
    ).toBe("uses moego · 40 reviews");
  });
});

describe("normaliseRep", () => {
  it("accepts any typed name so adding a rep needs no code change", () => {
    expect(normaliseRep("Marco")).toBe("Marco");
    expect(normaliseRep("  Ana   María  ")).toBe("Ana María");
  });

  it("rejects an empty name and caps a silly one", () => {
    expect(normaliseRep("   ")).toBeNull();
    expect(normaliseRep(undefined)).toBeNull();
    expect(normaliseRep("x".repeat(80))?.length).toBe(24);
  });
});

// The name field sits above the key field on the sign-in form, and on the first real sign-in the
// team key was pasted into it — landing 24 chars of the secret in the audit table.
describe("looksLikeKey", () => {
  const key = "REDACTED_RETIRED_CREDENTIAL_000000";

  it("rejects the key pasted whole or truncated by the name cap", () => {
    expect(looksLikeKey(key, key)).toBe(true);
    expect(looksLikeKey(key.slice(0, 24), key)).toBe(true);
  });

  it("lets real names through, including short ones", () => {
    expect(looksLikeKey("Ana", key)).toBe(false);
    expect(looksLikeKey("Marco Rodriguez", key)).toBe(false);
  });

  it("does nothing when no key is configured", () => {
    expect(looksLikeKey("whatever", undefined)).toBe(false);
  });
});
