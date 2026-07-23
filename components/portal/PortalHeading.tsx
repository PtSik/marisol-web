import type { ReactNode } from "react";

export function PortalHeading({ title, lead }: { title: ReactNode; lead?: ReactNode }) {
  return (
    <header>
      <h1 className="font-display text-[clamp(26px,4.5vw,36px)] font-light leading-[1.1] tracking-[-0.03em]">
        {title}
      </h1>
      {lead && (
        <p className="mt-[10px] max-w-[52ch] text-[15px] leading-[1.55] text-muted">{lead}</p>
      )}
    </header>
  );
}

export function PortalNotice({
  tone = "info",
  children,
}: { tone?: "info" | "warn" | "good"; children: ReactNode }) {
  const tones = {
    info: "border-ink/10 bg-cream-100 text-muted",
    warn: "border-[#B97E24]/30 bg-[#B97E24]/10 text-[#8A5D17]",
    good: "border-teal/30 bg-teal/10 text-teal",
  };
  return (
    <p className={`mt-6 rounded-[14px] border px-4 py-3 text-[14px] leading-[1.5] ${tones[tone]}`}>
      {children}
    </p>
  );
}
