import { describe, expect, it } from "bun:test";
import { DEMO_SERVICES } from "@/lib/demoServices";
import {
  NEUTRAL_DEMO_PATCH,
  demoKnowledge,
  demoServices,
  demoShopPatch,
  toShopHoursFromPlaces,
} from "@/lib/sales/demoKnowledge";

const FULL_WEEK =
  "Monday: 6:30 AM – 10:00 PM | Tuesday: 9:00 AM – 5:00 PM | Wednesday: 9:00 AM – 5:00 PM | " +
  "Thursday: 9:00 AM – 5:00 PM | Friday: 9:00 AM – 5:00 PM | Saturday: 10:00 AM – 4:00 PM | " +
  "Sunday: Closed";

// The rule voice-agent's `validateHoursJson` applies. Every value we emit has to clear it, because a
// rejected PATCH does not lose the hours — it fails the whole demo generation.
function serverAccepts(value: string): boolean {
  if (value === "closed") return true;
  const [open, close] = value.split("-");
  const clock = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i;
  return !!open && !!close && clock.test(open) && clock.test(close);
}

describe("toShopHoursFromPlaces", () => {
  it("maps a full Places week onto the shop hours shape", () => {
    expect(toShopHoursFromPlaces(FULL_WEEK)).toEqual({
      Mon: "6:30am-10:00pm",
      Tue: "9:00am-5:00pm",
      Wed: "9:00am-5:00pm",
      Thu: "9:00am-5:00pm",
      Fri: "9:00am-5:00pm",
      Sat: "10:00am-4:00pm",
      Sun: "closed",
    });
  });

  it("every emitted value clears the server-side validator", () => {
    const hours = toShopHoursFromPlaces(FULL_WEEK);
    expect(hours).not.toBeNull();
    for (const value of Object.values(hours as Record<string, string>)) {
      expect(serverAccepts(value)).toBe(true);
    }
  });

  it("clamps 'Open 24 hours' into a same-day window", () => {
    const week = FULL_WEEK.replace("Monday: 6:30 AM – 10:00 PM", "Monday: Open 24 hours");
    expect(toShopHoursFromPlaces(week)?.Mon).toBe("12:00am-11:59pm");
  });

  it("clamps a past-midnight close rather than emitting an hour the format cannot hold", () => {
    const week = FULL_WEEK.replace("Monday: 6:30 AM – 10:00 PM", "Monday: 8:00 PM – 2:00 AM");
    const mon = toShopHoursFromPlaces(week)?.Mon;
    expect(mon).toBe("8:00pm-11:59pm");
    expect(serverAccepts(mon as string)).toBe(true);
  });

  it("collapses a split shift to its envelope", () => {
    const week = FULL_WEEK.replace(
      "Tuesday: 9:00 AM – 5:00 PM",
      "Tuesday: 9:00 AM – 12:00 PM, 2:00 PM – 6:00 PM",
    );
    expect(toShopHoursFromPlaces(week)?.Tue).toBe("9:00am-6:00pm");
  });

  it("gives up on the whole week when one day will not parse", () => {
    // Half a week reads to the agent as "closed the rest of the time", and telling an owner his own
    // salon is shut on Saturday is worse than saying nothing.
    const week = FULL_WEEK.replace("Saturday: 10:00 AM – 4:00 PM", "Saturday: by appointment");
    expect(toShopHoursFromPlaces(week)).toBeNull();
  });

  it("returns null for missing or empty input", () => {
    expect(toShopHoursFromPlaces(null)).toBeNull();
    expect(toShopHoursFromPlaces("   ")).toBeNull();
  });
});

describe("demoServices", () => {
  const scraped = JSON.stringify([
    { name: "Full Groom", durationMin: "60", durationMaxMin: "150", price: "70", priceMax: "130" },
    { name: "Nail Trim", durationMin: "15", price: "18" },
  ]);

  it("uses the site's own menu when the scrape is trustworthy", () => {
    const out = demoServices({ services: scraped, service_confidence: "high", note: null });
    expect(out.map((s) => s.name)).toEqual(["Full Groom", "Nail Trim"]);
  });

  it("falls back to the reviewed grooming menu, never to nothing", () => {
    for (const row of [
      null,
      { services: scraped, service_confidence: "low", note: "no published prices" },
      { services: null, service_confidence: "high", note: null },
      { services: "not json", service_confidence: "high", note: null },
      { services: "[]", service_confidence: "high", note: null },
      { services: JSON.stringify([{ name: "  " }]), service_confidence: "high", note: null },
    ]) {
      expect(demoServices(row)).toBe(DEMO_SERVICES.grooming);
    }
  });
});

describe("demoShopPatch", () => {
  const lead = {
    shop_name: "Hialeah Pet Spa",
    hours: FULL_WEEK,
    address: " 1165 W 49th St, Hialeah, FL 33012 ",
  };

  it("carries name, language, address, hours and services", () => {
    const patch = demoShopPatch({ lead, lang: "es", agentId: "agent_x" });

    expect(patch.name).toBe("Hialeah Pet Spa");
    expect(patch.primary_language).toBe("es");
    expect(patch.elevenlabs_agent_id).toBe("agent_x");
    expect(patch.address).toBe("1165 W 49th St, Hialeah, FL 33012");
    expect(JSON.parse(patch.hours_json as string).Sun).toBe("closed");
  });

  it("renders services as strings, because the agent joins them into one sentence", () => {
    // An array of objects renders as "[object Object]" in {{services_summary}}.
    const rendered = JSON.parse(
      demoShopPatch({
        lead,
        lang: "en",
        enrichment: {
          services: JSON.stringify([
            {
              name: "Full Groom",
              durationMin: "60",
              durationMaxMin: "150",
              price: "70",
              priceMax: "130",
            },
          ]),
          service_confidence: "high",
          note: null,
        },
      }).services_json as string,
    );
    expect(rendered).toEqual(["Full Groom — 60-150 min / $70-130"]);
  });

  it("still sends a menu and an address when we know nothing", () => {
    // Omitting either would leave the previous prospect's values on a recycled number.
    const patch = demoShopPatch({
      lead: { shop_name: "Nameless Grooming", hours: null, address: null },
      lang: "en",
    });

    expect(patch.address).toBeNull();
    expect(JSON.parse(patch.services_json as string).length).toBe(DEMO_SERVICES.grooming.length);
    expect("hours_json" in patch).toBe(false); // the only field allowed to be absent
  });
});

describe("NEUTRAL_DEMO_PATCH", () => {
  it("puts back every field demoShopPatch can set", () => {
    const set = new Set(
      Object.keys(
        demoShopPatch({
          lead: { shop_name: "X", hours: FULL_WEEK, address: "1 Main St" },
          lang: "es",
        }),
      ),
    );
    set.delete("elevenlabs_agent_id"); // handled separately by releaseNumber

    for (const key of set) {
      expect(NEUTRAL_DEMO_PATCH[key]).toBeDefined();
    }
    expect(NEUTRAL_DEMO_PATCH.name).toBe("Marisol Demo");
    expect(NEUTRAL_DEMO_PATCH.primary_language).toBe("en");
  });
});

describe("demoKnowledge", () => {
  it("tells the rep what the agent will and will not know", () => {
    expect(
      demoKnowledge({ shop_name: "A", hours: FULL_WEEK, address: "1 Main St" }, null),
    ).toMatchObject({ hours: true, address: true, servicesFromSite: false });

    expect(
      demoKnowledge({ shop_name: "A", hours: "Monday: by appointment", address: null }, null),
    ).toMatchObject({ hours: false, address: false, servicesFromSite: false });
  });
});
