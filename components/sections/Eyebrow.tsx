import type { ReactNode } from "react";

// Two section labels, so the page has more than one way to open a section. The old page used the
// same pill seven times running, which is most of why it read as one block repeated.
//
//   pill — for sections that sit on a tinted or dark panel and need the label to hold its own shape
//   rule — for sections on the open cream ground, where a hairline reads quieter than a chip
export function Eyebrow({
  children,
  variant = "pill",
  tone = "default",
  align = "start",
  className = "",
}: {
  children: ReactNode;
  variant?: "pill" | "rule" | "plain";
  tone?: "default" | "onDark";
  /** A centred rule takes a hairline on both sides; one leading hairline under centred text reads
      as a mistake rather than as a mark. */
  align?: "start" | "center";
  className?: string;
}) {
  if (variant === "plain") {
    return (
      <span
        className={`block t-eyebrow ${
          align === "center" ? "text-center" : ""
        } ${tone === "onDark" ? "text-cream/55" : "text-muted"} ${className}`}
      >
        {children}
      </span>
    );
  }

  if (variant === "rule") {
    const hair = `h-px w-[26px] flex-none ${tone === "onDark" ? "bg-cream/30" : "bg-teal/55"}`;
    return (
      <span
        className={`flex items-center gap-[10px] t-eyebrow ${
          align === "center" ? "justify-center" : ""
        } ${tone === "onDark" ? "text-cream/55" : "text-muted"} ${className}`}
      >
        <span aria-hidden="true" className={hair} />
        {children}
        {align === "center" && <span aria-hidden="true" className={hair} />}
      </span>
    );
  }

  return (
    <span
      className={`inline-block rounded-full px-[13px] py-[7px] t-eyebrow ${
        tone === "onDark"
          ? "bg-[#9CD0C4]/[0.16] text-[#9CD0C4]"
          : "border border-ink/[0.07] bg-cream-200 text-muted"
      } ${className}`}
    >
      {children}
    </span>
  );
}
