import { describe, expect, it } from "bun:test";
import {
  carrierCodes,
  carrierFromLookup,
  dialable,
  forwardingGuide,
  forwardingVerification,
} from "@/lib/forwarding";
import { en } from "@/lib/i18n/en";
import { es } from "@/lib/i18n/es";

const NUMBER = "+1 (754) 555-1234";

describe("dialable", () => {
  it("drops the US country code so the keypad gets ten digits", () => {
    expect(dialable(NUMBER)).toBe("7545551234");
    expect(dialable("+17545551234")).toBe("7545551234");
    expect(dialable("7545551234")).toBe("7545551234");
  });
});

describe("carrierCodes", () => {
  it("gives Verizon its own family — GSM codes don't work there", () => {
    expect(carrierCodes("verizon", NUMBER)).toEqual([
      { carrier: "verizon", dial: ["*71 7545551234"], off: ["*73"] },
    ]);
  });

  it("sets every condition in one code on GSM carriers", () => {
    for (const carrier of ["att", "tmobile", "other_mobile"] as const) {
      expect(carrierCodes(carrier, NUMBER)).toEqual([
        { carrier, dial: ["**004*7545551234*11#"], off: ["##004#"] },
      ]);
    }
  });

  it("registers busy and no-answer separately on UScellular", () => {
    expect(carrierCodes("uscellular", NUMBER)).toEqual([
      { carrier: "uscellular", dial: ["*92 7545551234", "*90 7545551234"], off: ["*93", "*91"] },
    ]);
  });

  it("has no dial code for a VoIP line or for Google Fi", () => {
    expect(carrierCodes("voip", NUMBER)).toEqual([]);
    expect(carrierCodes("app_only", NUMBER)).toEqual([]);
  });

  it("falls back to every family when the lead never picked a carrier", () => {
    const codes = carrierCodes(undefined, NUMBER);
    expect(codes.map((c) => c.carrier)).toEqual(["verizon", "other_mobile", "uscellular"]);
  });
});

describe("forwardingGuide", () => {
  it("labels the codes only when the owner has to choose between them", () => {
    expect(forwardingGuide("att", NUMBER, en.forwarding).steps[1].codes).toEqual([
      { code: "**004*7545551234*11#" },
    ]);
    expect(forwardingGuide(undefined, NUMBER, en.forwarding).steps[1].codes).toEqual([
      { label: en.forwarding.carriers.verizon, code: "*71 7545551234" },
      { label: en.forwarding.carriers.other_mobile, code: "**004*7545551234*11#" },
      { label: en.forwarding.carriers.uscellular, code: "*92 7545551234" },
      { label: en.forwarding.carriers.uscellular, code: "*90 7545551234" },
    ]);
  });

  it("keeps the UScellular pair readable as one instruction in the labelled view", () => {
    // Here the step text is stepDialPick — "dial the code for your provider", singular — so the
    // label is the only place left to say that these two lines are not alternatives.
    const codes = forwardingGuide(undefined, NUMBER, en.forwarding).steps[1].codes;
    expect(codes.filter((c) => c.label === en.forwarding.carriers.uscellular)).toHaveLength(2);
    expect(en.forwarding.carriers.uscellular).toMatch(/both/i);
    expect(es.forwarding.carriers.uscellular).toMatch(/los dos/i);
  });

  it("tells a UScellular owner to dial both codes, not to pick one", () => {
    const guide = forwardingGuide("uscellular", NUMBER, en.forwarding);
    expect(guide.steps[1].text).toBe(en.forwarding.stepDialBoth);
    expect(guide.steps[1].codes).toEqual([{ code: "*92 7545551234" }, { code: "*90 7545551234" }]);
  });

  it("ends on the test call — a client who skips it thinks they're done", () => {
    const { steps } = forwardingGuide("verizon", NUMBER, en.forwarding);
    expect(steps.at(-1)?.text).toBe(en.forwarding.stepTest);
  });

  it("sends a VoIP line to the team instead of showing codes", () => {
    const guide = forwardingGuide("voip", NUMBER, en.forwarding);
    expect(guide.manual).toEqual({ title: en.forwarding.voipTitle, body: en.forwarding.voipBody });
    expect(guide.steps).toEqual([]);
    expect(guide.turnOff).toBeNull();
  });

  it("names the app for Google Fi, which has no dial codes at all", () => {
    const guide = forwardingGuide("app_only", NUMBER, en.forwarding);
    expect(guide.manual).toEqual({ title: en.forwarding.appTitle, body: en.forwarding.appBody });
  });
});

describe("carrierFromLookup", () => {
  it("puts Verizon resellers on Verizon's codes, not on GSM", () => {
    for (const carrierName of [
      "Visible",
      "Xfinity Mobile",
      "Spectrum Mobile",
      "Cellco Partnership",
    ]) {
      expect(carrierFromLookup({ carrierName, type: "mobile" })).toBe("verizon");
    }
  });

  it("reads the GSM networks and their resellers", () => {
    expect(carrierFromLookup({ carrierName: "Cricket Wireless", type: "mobile" })).toBe("att");
    expect(carrierFromLookup({ carrierName: "Mint Mobile", type: "mobile" })).toBe("tmobile");
  });

  it("routes lines that forward from a panel or an app away from the keypad", () => {
    expect(carrierFromLookup({ carrierName: "Comcast Business", type: "landline" })).toBe("voip");
    expect(carrierFromLookup({ carrierName: "Ooma", type: "fixedVoip" })).toBe("voip");
    expect(carrierFromLookup({ carrierName: "Google Fi", type: "mobile" })).toBe("app_only");
  });

  it("falls back to the network code when the brand is unfamiliar", () => {
    expect(
      carrierFromLookup({
        carrierName: "Some Reseller",
        type: "mobile",
        mobileNetworkCode: "311480",
      }),
    ).toBe("verizon");
  });

  it("stays silent rather than guessing — a wrong code fails without telling anyone", () => {
    expect(carrierFromLookup({ carrierName: "Straight Talk", type: "mobile" })).toBeNull();
    expect(carrierFromLookup({ type: "tollFree" })).toBeNull();
    expect(carrierFromLookup({})).toBeNull();
  });
});

describe("forwardingVerification", () => {
  it("gives the GSM networks all four interrogation codes", () => {
    for (const carrier of ["att", "tmobile", "other_mobile"] as const) {
      expect(forwardingVerification(carrier).checks.map((c) => c.code)).toEqual([
        "*#21#",
        "*#61#",
        "*#67#",
        "*#62#",
      ]);
    }
  });

  it("offers no code where the network answers none — a test call instead", () => {
    for (const carrier of ["verizon", "uscellular", "voip", "app_only"] as const) {
      const { checks, note } = forwardingVerification(carrier);
      expect(checks).toEqual([]);
      expect(note).not.toBe("");
    }
  });

  it("warns that the GSM codes are unattributed when no carrier was established", () => {
    const { checks, note } = forwardingVerification(undefined);
    expect(checks.map((c) => c.code)).toContain("*#21#");
    expect(note).toContain("Verizon-network");
  });
});
