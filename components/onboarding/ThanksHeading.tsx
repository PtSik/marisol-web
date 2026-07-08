import type { ReactNode } from "react";

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

export function ThanksHeading({ title, lead }: { title: ReactNode; lead: string }) {
  return (
    <div className="text-center">
      <CheckIcon />
      <h1 className="mx-auto mt-5 max-w-[20ch] font-display text-[clamp(28px,5vw,44px)] font-light leading-[1.08] tracking-[-0.03em]">
        {title}
      </h1>
      <p className="mx-auto mt-[14px] max-w-[44ch] text-[15.5px] leading-[1.55] text-muted">
        {lead}
      </p>
    </div>
  );
}

export function SetupCompleteHeading() {
  return (
    <ThanksHeading
      title={
        <>
          Setup complete. <span className="text-teal">We take it from here.</span>
        </>
      }
      lead="Your receptionist is being configured with everything you shared — forwarding instructions land in your inbox shortly."
    />
  );
}
