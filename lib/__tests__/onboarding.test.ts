import { describe, expect, it } from "bun:test";
import { validateSetup } from "@/components/onboarding/SetupFields";
import { en } from "@/lib/i18n/en";
import {
  type SetupDetails,
  type WeekHours,
  coerceTimezone,
  defaultHours,
  defaultSetup,
  invalidWeekHours,
  isBusinessBasics,
  isTimezoneId,
  newStaffEntry,
  normalizeSetup,
  validateSetupPayload,
} from "@/lib/onboarding";

// The findings these cover (TEST-FINDINGS.md F1/F2) were both one-sided rules: something the
// browser allowed and the worker refused. Each test below pins the two sides together.

function hoursWith(day: keyof WeekHours, patch: Partial<WeekHours["mon"]>): WeekHours {
  const hours = defaultHours();
  return { ...hours, [day]: { ...hours[day], ...patch } };
}

// A setup both sides already accept, so each test changes exactly one thing.
function setupWith(patch: Partial<SetupDetails> = {}): SetupDetails {
  return {
    ...defaultSetup("barbershop", ["Haircut", "Beard trim", "Cut & beard"]),
    forwardNumber: "+1 305 555 0101",
    staff: [{ ...newStaffEntry(), name: "Luis", hours: null }],
    ...patch,
  };
}

const basics = {
  vertical: "barbershop",
  businessName: "Barbarossa",
  ownerName: "Luis",
  email: "luis@barbarossa.com",
  businessPhone: "+1 305 555 0101",
  ownerMobile: "+1 305 555 0102",
  timezone: "America/New_York",
};

describe("isTimezoneId", () => {
  it("accepts the zones the portal can render and nothing else", () => {
    expect(isTimezoneId("America/New_York")).toBe(true);
    expect(isTimezoneId("Pacific/Honolulu")).toBe(true);
    expect(isTimezoneId("Europe/Warsaw")).toBe(false);
    expect(isTimezoneId("")).toBe(false);
    expect(isTimezoneId(undefined)).toBe(false);
  });
});

describe("coerceTimezone", () => {
  it("keeps a US zone and falls back for anything else", () => {
    expect(coerceTimezone("America/Chicago")).toBe("America/Chicago");
    // The shop that started all of this: a Warsaw zone on an Indiana number, which made the
    // agent quote opening hours six hours out.
    expect(coerceTimezone("Europe/Warsaw")).toBe("America/New_York");
    expect(coerceTimezone("")).toBe("America/New_York");
  });
});

describe("isBusinessBasics", () => {
  it("rejects a zone the portal has no option for", () => {
    expect(isBusinessBasics(basics)).toBe(true);
    expect(isBusinessBasics({ ...basics, timezone: "Europe/Warsaw" })).toBe(false);
    expect(isBusinessBasics({ ...basics, timezone: "" })).toBe(false);
  });
});

describe("invalidWeekHours", () => {
  it("rejects a cleared time field on an open day", () => {
    // `<input type="time">` hands back "" — and "" >= "18:00" is false, which is how the old
    // client check waved it through into a bare 400.
    expect(invalidWeekHours(hoursWith("mon", { open: "" }))).toBe(true);
    expect(invalidWeekHours(hoursWith("mon", { close: "" }))).toBe(true);
    expect(invalidWeekHours(hoursWith("mon", { open: "9:00" }))).toBe(true);
  });

  it("rejects a day that closes before it opens", () => {
    expect(invalidWeekHours(hoursWith("tue", { open: "18:00", close: "09:00" }))).toBe(true);
    expect(invalidWeekHours(hoursWith("tue", { open: "09:00", close: "09:00" }))).toBe(true);
  });

  it("ignores the times on a closed day, which the form never shows", () => {
    expect(invalidWeekHours(hoursWith("sun", { closed: true, open: "", close: "" }))).toBe(false);
    expect(
      invalidWeekHours(hoursWith("sun", { closed: true, open: "18:00", close: "09:00" })),
    ).toBe(false);
  });

  it("rejects anything that isn't a week", () => {
    expect(invalidWeekHours(null)).toBe(true);
    expect(invalidWeekHours({})).toBe(true);
    expect(invalidWeekHours({ ...defaultHours(), wed: undefined })).toBe(true);
  });
});

describe("normalizeSetup", () => {
  it("drops per-person hours when the toggle that shows them is off", () => {
    const setup = setupWith({
      staffCustomHours: false,
      staff: [{ ...newStaffEntry(), name: "Luis", hours: hoursWith("mon", { open: "" }) }],
    });
    // Those fields aren't on screen, so an owner could never fix them — the save has to stop
    // depending on them rather than reject.
    expect(validateSetupPayload(setup)).toBe("invalid staff");
    expect(validateSetupPayload(normalizeSetup(setup))).toBeNull();
  });

  it("keeps them when the toggle is on", () => {
    const hours = hoursWith("mon", { open: "10:00", close: "15:00" });
    const setup = setupWith({
      staffCustomHours: true,
      staff: [{ ...newStaffEntry(), name: "Luis", hours }],
    });
    expect(normalizeSetup(setup).staff[0].hours).toEqual(hours);
  });
});

describe("validateSetup / validateSetupPayload", () => {
  it("agree on a cleared opening time", () => {
    const setup = setupWith({ hours: hoursWith("mon", { open: "" }) });
    expect(validateSetup(setup, en.setup).hours).toBe(en.setup.errHours);
    expect(validateSetupPayload(setup)).toBe("invalid hours");
  });

  it("agree on staff hours behind a switched-on toggle", () => {
    const setup = setupWith({
      staffCustomHours: true,
      staff: [
        {
          ...newStaffEntry(),
          name: "Luis",
          hours: hoursWith("mon", { open: "18:00", close: "09:00" }),
        },
      ],
    });
    expect(validateSetup(setup, en.setup).staff).toBe(en.setup.errStaffHours);
    expect(validateSetupPayload(setup)).toBe("invalid staff");
  });

  it("both pass a setup the wizard produces", () => {
    expect(validateSetup(setupWith(), en.setup)).toEqual({});
    expect(validateSetupPayload(setupWith())).toBeNull();
  });
});

describe("setup error copy", () => {
  it("names every code the setup APIs can return", () => {
    // A code with no entry falls back to "please try again" — the exact advice that made F1
    // unescapable. Anything `validateSetupPayload` emits has to be listed.
    const codes = [
      "invalid setup",
      "invalid hours",
      "invalid services",
      "invalid staff",
      "invalid forwardNumber",
      "invalid carrier",
      "invalid calendar",
      "invalid notes",
      "invalid timezone",
      "activation needs reconciliation",
    ];
    for (const code of codes) {
      expect(Object.keys(en.setup.errServer)).toContain(code);
    }
  });
});
