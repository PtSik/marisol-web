import type { Dict } from "@/lib/i18n/dict";

// `other_mobile` predates the per-network split and still arrives on old leads: it means "a GSM
// network we couldn't name", never "any carrier we don't recognise" — a Verizon MVNO sent down the
// GSM path gets a code its network rejects, and the owner never finds out.
export const CARRIERS = [
  "verizon",
  "att",
  "tmobile",
  "other_mobile",
  "uscellular",
  "app_only",
  "voip",
  "unknown",
] as const;

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
  dial: string[];
  off: string[];
}

// **004* sets busy, no-answer and unreachable in one go — the per-condition codes exist but a shop
// owner dialling three of them gets two right and one wrong. The trailing *11 is the GSM basic
// service for voice: without it the network is asked to forward every service at once, which some
// reject outright even though the voice half would have registered.
function gsmCodes(number: string): { dial: string[]; off: string[] } {
  return { dial: [`**004*${number}*11#`], off: ["##004#"] };
}

function verizonCodes(number: string): { dial: string[]; off: string[] } {
  return { dial: [`*71 ${number}`], off: ["*73"] };
}

// UScellular has no single conditional code — no-answer and busy are registered separately.
function usCellularCodes(number: string): { dial: string[]; off: string[] } {
  return { dial: [`*92 ${number}`, `*90 ${number}`], off: ["*93", "*91"] };
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
    case "uscellular":
      return [{ carrier: "uscellular", ...usCellularCodes(number) }];
    case "voip":
    case "app_only":
      return [];
    // No carrier on the lead (or the owner wasn't sure): show every family, labelled.
    default:
      return [
        { carrier: "verizon", ...verizonCodes(number) },
        { carrier: "other_mobile", ...gsmCodes(number) },
        { carrier: "uscellular", ...usCellularCodes(number) },
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
  manual: { title: string; body: string } | null;
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
    const manual =
      carrier === "app_only"
        ? { title: t.appTitle, body: t.appBody }
        : { title: t.voipTitle, body: t.voipBody };
    return { manual, warning: t.warning, steps: [], turnOff: null };
  }

  const labelled = codes.length > 1;
  const lines = (pick: (c: CarrierCodes) => string[]): CodeLine[] =>
    codes.flatMap((c) =>
      pick(c).map((code) => (labelled ? { label: t.carriers[c.carrier], code } : { code })),
    );

  const dialText = labelled
    ? t.stepDialPick
    : codes[0].dial.length > 1
      ? t.stepDialBoth
      : t.stepDial;

  return {
    manual: null,
    warning: t.warning,
    steps: [
      { text: t.stepVoicemail, codes: [] },
      { text: dialText, codes: lines((c) => c.dial) },
      { text: t.stepTest, codes: [] },
    ],
    turnOff: { text: t.turnOff, codes: lines((c) => c.off) },
  };
}

export interface LineTypeLookup {
  carrierName?: string;
  type?: string;
  mobileNetworkCode?: string;
}

// Which dial codes work is a property of the network, not of the brand on the bill: Visible and
// Xfinity Mobile are Verizon lines, Cricket is AT&T. Matching brand names is what keeps a resold
// Verizon number off the GSM path.
const NETWORK_BRANDS: { carrier: Carrier; brands: string[] }[] = [
  {
    carrier: "verizon",
    brands: ["verizon", "cellco", "visible", "xfinity", "comcast", "spectrum", "charter"],
  },
  { carrier: "att", brands: ["at&t", "at & t", "cingular", "cricket"] },
  { carrier: "tmobile", brands: ["t-mobile", "tmobile", "metropcs", "metro by", "mint", "ultra"] },
  { carrier: "uscellular", brands: ["us cellular", "uscellular", "united states cellular"] },
  { carrier: "app_only", brands: ["google fi", "google-fi"] },
];

// Only codes we can attribute with certainty. An unrecognised network is worth far less than a
// wrong one: `null` leaves the owner picking from a labelled list, a bad guess leaves them
// dialling a code their network silently drops.
const NETWORK_CODES: Record<string, Carrier> = {
  "310012": "verizon",
  "311480": "verizon",
  "310010": "verizon",
  "310004": "verizon",
  "310410": "att",
  "310150": "att",
  "310260": "tmobile",
  "310160": "tmobile",
  "311220": "uscellular",
  "310730": "uscellular",
};

const NON_KEYPAD_TYPES = new Set(["landline", "fixedVoip", "nonFixedVoip", "voicemail"]);

export function carrierFromLookup(lookup: LineTypeLookup): Carrier | null {
  if (lookup.type && NON_KEYPAD_TYPES.has(lookup.type)) return "voip";
  if (lookup.type !== "mobile") return null;

  const name = lookup.carrierName?.toLowerCase() ?? "";
  const brand = NETWORK_BRANDS.find((entry) => entry.brands.some((b) => name.includes(b)));
  if (brand) return brand.carrier;

  return (lookup.mobileNetworkCode && NETWORK_CODES[lookup.mobileNetworkCode]) || null;
}

// Support-facing only: what the team needs on a call when the one code above didn't take. Never
// rendered to clients — a shop owner reading a table of GSM codes picks the wrong one.
export const CARRIER_REFERENCE: Record<Exclude<Carrier, "unknown">, string[]> = {
  verizon: [
    "*71 covers busy + no answer; Verizon can't route conditions to different numbers",
    "A phone that is off or out of coverage goes to Verizon voicemail, not to Marisol — *71 doesn't cover unreachable",
  ],
  att: [
    "Per condition if **004* is rejected: **61* (no answer), **67* (busy), **62* (unreachable)",
  ],
  tmobile: [
    "Ring time before forwarding: **61*<number>*11*30# (30s, default is ~20s)",
    "Too short and Marisol takes calls the owner would have answered; too long and callers hang up",
  ],
  other_mobile: [
    "Per condition if **004* is rejected: **61* (no answer), **67* (busy), **62* (unreachable)",
    "Boost doesn't offer conditional forwarding on paper — the GSM codes usually take, otherwise their care line has to enable it",
    "GSM codes are rejected outright on Verizon-network resellers (Visible, Xfinity Mobile, Spectrum Mobile, Total Wireless) — those need *71",
  ],
  uscellular: [
    "Two codes, one per condition: *92 (no answer), *90 (busy); off with *93 and *91",
    "The GSM codes don't exist on this network — **004* fails here",
  ],
  app_only: [
    "Google Fi accepts no dial codes at all — forwarding is set in the Fi app or on fi.google.com, and the owner has to do it with us on the phone",
  ],
  voip: [
    "Comcast Business / Spectrum / Ooma forward from the provider's web panel — no dial codes, and the steps differ per provider",
  ],
};

export const CARRIER_STATUS_CHECKS =
  "*#21# unconditional · *#61# no answer · *#67# busy · *#62# unreachable";
