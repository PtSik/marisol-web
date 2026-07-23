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
): ForwardingInstructions {
  const number = dialable(twilioNumber);

  if (mode === "all") {
    return {
      intro: ["Send ", { code: "every call" }, " straight to Marisol so she answers first:"],
      steps: [
        {
          device: "Landline / desk phone",
          parts: [
            "dial ",
            { code: "*72" },
            ", then ",
            { code: number },
            ", then call — you'll hear a confirmation tone.",
          ],
        },
        {
          device: "Mobile",
          parts: ["dial ", { code: `**21*${number}#` }, " and press call."],
        },
      ],
      turnOff: [
        "To turn it off later: ",
        { code: "*73" },
        " (landline) or ",
        { code: "##21#" },
        " (mobile).",
      ],
    };
  }

  return {
    intro: [
      "Send calls to Marisol ",
      { code: "only when you can't pick up" },
      " (busy or no answer) — you still answer first whenever you're free:",
    ],
    steps: [
      {
        device: "Landline / desk phone",
        parts: ["dial ", { code: "*71" }, ", then ", { code: number }, ", then call."],
      },
      {
        device: "Mobile",
        parts: [
          "dial ",
          { code: `**61*${number}#` },
          " (no answer) and ",
          { code: `**67*${number}#` },
          " (busy), pressing call after each.",
        ],
      },
    ],
    turnOff: [
      "To turn it off later: ",
      { code: "*73" },
      " (landline) or ",
      { code: "##002#" },
      " (mobile).",
    ],
  };
}
