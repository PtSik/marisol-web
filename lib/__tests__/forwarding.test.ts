import { describe, expect, it } from "bun:test";
import { carrierCodes, dialable, forwardingGuide } from "@/lib/forwarding";
import { en } from "@/lib/i18n/en";

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
      { carrier: "verizon", dial: "*71 7545551234", off: "*73" },
    ]);
  });

  it("sets every condition in one code on GSM carriers", () => {
    for (const carrier of ["att", "tmobile", "other_mobile"] as const) {
      expect(carrierCodes(carrier, NUMBER)).toEqual([
        { carrier, dial: "**004*7545551234#", off: "##004#" },
      ]);
    }
  });

  it("has no dial code for a VoIP or business line", () => {
    expect(carrierCodes("voip", NUMBER)).toEqual([]);
  });

  it("falls back to both families when the lead never picked a carrier", () => {
    const codes = carrierCodes(undefined, NUMBER);
    expect(codes.map((c) => c.carrier)).toEqual(["verizon", "other_mobile"]);
  });
});

describe("forwardingGuide", () => {
  it("labels the codes only when the owner has to choose between them", () => {
    expect(forwardingGuide("att", NUMBER, en.forwarding).steps[1].codes).toEqual([
      { code: "**004*7545551234#" },
    ]);
    expect(forwardingGuide(undefined, NUMBER, en.forwarding).steps[1].codes).toEqual([
      { label: en.forwarding.carriers.verizon, code: "*71 7545551234" },
      { label: en.forwarding.carriers.other_mobile, code: "**004*7545551234#" },
    ]);
  });

  it("ends on the test call — a client who skips it thinks they're done", () => {
    const { steps } = forwardingGuide("verizon", NUMBER, en.forwarding);
    expect(steps.at(-1)?.text).toBe(en.forwarding.stepTest);
  });

  it("sends a VoIP line to the team instead of showing codes", () => {
    const guide = forwardingGuide("voip", NUMBER, en.forwarding);
    expect(guide.voip).toBe(true);
    expect(guide.steps).toEqual([]);
    expect(guide.turnOff).toBeNull();
  });
});
