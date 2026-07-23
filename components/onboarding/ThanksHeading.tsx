import type { Dict } from "@/lib/i18n/dict";

function CheckIcon() {
  return (
    <span className="inline-flex h-[54px] w-[54px] items-center justify-center rounded-full bg-[#2C7A4B]/10">
      <svg
        width="26"
        height="26"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#2C7A4B"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </span>
  );
}

export interface AccentTitle {
  before: string;
  accent: string;
}

export function ThanksHeading({ title, lead }: { title: AccentTitle; lead: string }) {
  return (
    <div className="text-center">
      <CheckIcon />
      <h1 className="mx-auto mt-5 max-w-[20ch] font-display text-[clamp(28px,5vw,44px)] font-light leading-[1.08] tracking-[-0.03em]">
        {title.before}
        <span className="text-teal">{title.accent}</span>
      </h1>
      <p className="mx-auto mt-[14px] max-w-[44ch] text-[15.5px] leading-[1.55] text-muted">
        {lead}
      </p>
    </div>
  );
}

export function SetupCompleteHeading({ hasNumber, t }: { hasNumber?: boolean; t: Dict["thanks"] }) {
  return (
    <ThanksHeading
      title={t.completeTitle}
      lead={hasNumber ? t.completeLead : t.completeLeadPending}
    />
  );
}
