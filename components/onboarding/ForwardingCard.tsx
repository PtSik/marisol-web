import { type Segment, forwardingInstructions } from "@/lib/forwarding";
import type { Dict } from "@/lib/i18n/dict";
import type { ForwardMode } from "@/lib/onboarding";
import { SALES_EMAIL_HREF } from "@/lib/site";

function Segments({ parts }: { parts: Segment[] }) {
  return (
    <>
      {parts.map((part, i) =>
        typeof part === "string" ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: static instruction fragments, never reordered
          <span key={i}>{part}</span>
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: static instruction fragments, never reordered
          <strong key={i} className="font-semibold text-ink">
            {part.code}
          </strong>
        ),
      )}
    </>
  );
}

export function ForwardingCard({
  twilioNumber,
  forwardMode,
  t,
}: { twilioNumber: string; forwardMode: ForwardMode; t: Dict["forwarding"] }) {
  const { intro, steps, turnOff } = forwardingInstructions(forwardMode, twilioNumber, t);

  return (
    <div className="mt-9 rounded-[24px] bg-cream-100 p-[clamp(20px,4vw,34px)]">
      <p className="text-[11.5px] font-semibold uppercase tracking-[0.16em] text-muted-2">
        {t.kicker}
      </p>
      <p className="mt-1.5 font-display text-[clamp(26px,4vw,34px)] tracking-[-0.02em]">
        {twilioNumber}
      </p>
      <h2 className="mt-7 text-[17px] font-medium">{t.heading}</h2>
      <p className="mt-2 text-[15px] leading-[1.55] text-muted">
        <Segments parts={intro} />
      </p>
      <ul className="mt-4 flex flex-col gap-2.5">
        {steps.map((step) => (
          <li key={step.device} className="rounded-[14px] bg-cream px-[18px] py-3.5 text-[15px]">
            <span className="font-medium">{step.device}:</span>{" "}
            <span className="text-muted">
              <Segments parts={step.parts} />
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-[13.5px] leading-[1.5] text-muted-2">
        <Segments parts={turnOff} />
      </p>
      <p className="mt-2 text-[13.5px] leading-[1.5] text-muted-2">
        {t.carrierBefore}
        <a href={SALES_EMAIL_HREF} className="font-medium text-teal">
          {t.carrierLink}
        </a>
        {t.carrierAfter}
      </p>
    </div>
  );
}
