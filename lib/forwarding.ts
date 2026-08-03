import type { Dict } from "@/lib/i18n/dict";

export const CARRIERS = ["verizon", "att", "tmobile", "other_mobile", "voip", "unknown"] as const;

export type Carrier = (typeof CARRIERS)[number];

export function isCarrier(value: unknown): value is Carrier {
  return CARRIERS.includes(value as Carrier);
}

// US carriers take the 10-digit national form, so a stored +1… never reaches the keypad as 11 digits.
export function dialable(twilioNumber: string): string {
  const digits = twilioNumber.replace(/\D/g, "");
  return digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
}

export interface CarrierCodes {
  carrier: Carrier;
  dial: string;
  off: string;
}

// **004* sets busy, no-answer and unreachable in one go — the per-condition codes exist but a shop
// owner dialling three of them gets two right and one wrong.
function gsmCodes(number: string): { dial: string; off: string } {
  return { dial: `**004*${number}#`, off: "##004#" };
}

function verizonCodes(number: string): { dial: string; off: string } {
  return { dial: `*71 ${number}`, off: "*73" };
}

export function carrierCodes(carrier: Carrier | undefined, twilioNumber: string): CarrierCodes[] {
  const number = dialable(twilioNumber);
  switch (carrier) {
    case "verizon":
      return [{ carrier: "verizon", ...verizonCodes(number) }];
    case "att":
    case "tmobile":
    case "other_mobile":
      return [{ carrier, ...gsmCodes(number) }];
    case "voip":
      return [];
    // No carrier on the lead (or the owner wasn't sure): show both families, labelled.
    default:
      return [
        { carrier: "verizon", ...verizonCodes(number) },
        { carrier: "other_mobile", ...gsmCodes(number) },
      ];
  }
}

export interface CodeLine {
  label?: string;
  code: string;
}

export interface ForwardingStep {
  text: string;
  codes: CodeLine[];
}

export interface ForwardingGuide {
  voip: boolean;
  warning: string;
  steps: ForwardingStep[];
  turnOff: ForwardingStep | null;
}

// One guide feeds the portal card, the setup-complete screen and the welcome email, so the codes a
// client reads on screen are the same ones in their inbox.
export function forwardingGuide(
  carrier: Carrier | undefined,
  twilioNumber: string,
  t: Dict["forwarding"],
): ForwardingGuide {
  const codes = carrierCodes(carrier, twilioNumber);

  if (codes.length === 0) {
    return { voip: true, warning: t.warning, steps: [], turnOff: null };
  }

  const labelled = codes.length > 1;
  const line = (c: CarrierCodes, code: string): CodeLine =>
    labelled ? { label: t.carriers[c.carrier], code } : { code };

  return {
    voip: false,
    warning: t.warning,
    steps: [
      { text: t.stepVoicemail, codes: [] },
      {
        text: labelled ? t.stepDialPick : t.stepDial,
        codes: codes.map((c) => line(c, c.dial)),
      },
      { text: t.stepTest, codes: [] },
    ],
    turnOff: { text: t.turnOff, codes: codes.map((c) => line(c, c.off)) },
  };
}

// Support-facing only: what the team needs on a call when the one code above didn't take. Never
// rendered to clients — a shop owner reading a table of GSM codes picks the wrong one.
export const CARRIER_REFERENCE: Record<Exclude<Carrier, "unknown">, string[]> = {
  verizon: [
    "*71 + 10 digits covers busy + no answer + unreachable; Verizon can't route conditions to different numbers",
  ],
  att: ["Digital and landline fallback: *92<number># (no answer), *90<number># (busy)"],
  tmobile: [
    "Ring time before forwarding: **61*<number>*11*30# (30s, default is ~20s)",
    "Too short and Marisol takes calls the owner would have answered; too long and callers hang up",
  ],
  other_mobile: [
    "Per condition if **004* is rejected: **61* (no answer), **67* (busy), **62* (unreachable)",
  ],
  voip: [
    "Comcast Business / Spectrum / Ooma forward from the provider's web panel — no dial codes, and the steps differ per provider",
  ],
};

export const CARRIER_STATUS_CHECKS =
  "*#21# unconditional · *#61# no answer · *#67# busy · *#62# unreachable";
