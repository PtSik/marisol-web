import type { Dict } from "@/lib/i18n/dict";
import type { ForwardMode } from "@/lib/onboarding";

// Segments keep the dial codes marked up so the same instructions render as HTML in the
// welcome email and as React on the setup-complete screen.
export type Segment = string | { code: string };

export interface ForwardingStep {
  device: string;
  parts: Segment[];
}

export interface ForwardingInstructions {
  intro: Segment[];
  steps: ForwardingStep[];
  turnOff: Segment[];
}

export function dialable(twilioNumber: string): string {
  return twilioNumber.replace(/\D/g, "");
}

export function forwardingInstructions(
  mode: ForwardMode,
  twilioNumber: string,
  t: Dict["forwarding"],
): ForwardingInstructions {
  const number = dialable(twilioNumber);
  const copy = mode === "all" ? t.all : t.conditional;
  const intro: Segment[] = [copy.introBefore, { code: copy.introCode }, copy.introAfter];

  if (mode === "all") {
    return {
      intro,
      steps: [
        {
          device: t.landline,
          parts: [t.all.dial, { code: "*72" }, t.all.middle, { code: number }, t.all.landlineEnd],
        },
        {
          device: t.mobile,
          parts: [t.all.dial, { code: `**21*${number}#` }, t.all.mobileEnd],
        },
      ],
      turnOff: [
        t.turnOffPrefix,
        { code: "*73" },
        t.turnOffLandline,
        { code: "##21#" },
        t.turnOffMobile,
      ],
    };
  }

  return {
    intro,
    steps: [
      {
        device: t.landline,
        parts: [
          t.conditional.dial,
          { code: "*71" },
          t.conditional.middle,
          { code: number },
          t.conditional.landlineEnd,
        ],
      },
      {
        device: t.mobile,
        parts: [
          t.conditional.dial,
          { code: `**61*${number}#` },
          t.conditional.mobileNoAnswer,
          { code: `**67*${number}#` },
          t.conditional.mobileBusy,
        ],
      },
    ],
    turnOff: [
      t.turnOffPrefix,
      { code: "*73" },
      t.turnOffLandline,
      { code: "##002#" },
      t.turnOffMobile,
    ],
  };
}
