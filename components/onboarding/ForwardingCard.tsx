import { ForwardingHelpButton } from "@/components/onboarding/ForwardingHelpButton";
import { type Carrier, type CodeLine, forwardingGuide } from "@/lib/forwarding";
import type { Dict } from "@/lib/i18n/dict";

function Codes({ codes }: { codes: CodeLine[] }) {
  if (codes.length === 0) return null;
  return (
    <ul className="mt-2 flex list-none flex-col gap-1.5 p-0">
      {codes.map((line) => (
        <li key={line.code} className="rounded-[12px] bg-cream px-[14px] py-2.5">
          {line.label && <span className="text-[13.5px] text-muted-2">{line.label} — </span>}
          <strong className="font-display text-[17px] tracking-[0.01em] text-ink">
            {line.code}
          </strong>
        </li>
      ))}
    </ul>
  );
}

export function ForwardingCard({
  twilioNumber,
  carrier,
  t,
}: { twilioNumber: string; carrier?: Carrier; t: Dict["forwarding"] }) {
  const guide = forwardingGuide(carrier, twilioNumber, t);

  return (
    <div className="mt-9 rounded-[24px] bg-cream-100 p-[clamp(20px,4vw,34px)]">
      <p className="text-[11.5px] font-semibold uppercase tracking-[0.16em] text-muted-2">
        {t.kicker}
      </p>
      <p className="mt-1.5 font-display text-[clamp(26px,4vw,34px)] tracking-[-0.02em]">
        {twilioNumber}
      </p>
      <h2 className="mt-7 text-[17px] font-medium">{t.heading}</h2>
      <p className="mt-2 text-[15px] leading-[1.55] text-muted">{t.lead}</p>

      <p className="mt-4 rounded-[14px] bg-[#B4452C]/10 px-[16px] py-3 text-[13.5px] leading-[1.5] text-ink">
        {guide.warning}
      </p>

      {guide.voip ? (
        <div className="mt-5">
          <p className="text-[15px] font-medium">{t.voipTitle}</p>
          <p className="mt-1.5 text-[14.5px] leading-[1.55] text-muted">{t.voipBody}</p>
          <ForwardingHelpButton topic="forwarding_voip" variant="button" t={t} />
        </div>
      ) : (
        <>
          <ol className="mt-5 flex list-none flex-col gap-4 p-0">
            {guide.steps.map((step, i) => (
              <li key={step.text} className="flex gap-3">
                <span className="mt-[1px] flex h-[24px] w-[24px] shrink-0 items-center justify-center rounded-full bg-ink text-[13px] font-medium text-cream">
                  {i + 1}
                </span>
                <span className="text-[15px] leading-[1.5]">
                  {step.text}
                  <Codes codes={step.codes} />
                </span>
              </li>
            ))}
          </ol>
          {guide.turnOff && (
            <p className="mt-5 text-[13.5px] leading-[1.5] text-muted-2">
              {guide.turnOff.text}{" "}
              {guide.turnOff.codes.map((line, i) => (
                <span key={line.code}>
                  {i > 0 && " · "}
                  {line.label && `${line.label} `}
                  <strong className="font-semibold text-ink">{line.code}</strong>
                </span>
              ))}
            </p>
          )}
          <div className="mt-2">
            <ForwardingHelpButton topic="forwarding_codes" variant="link" t={t} />
          </div>
        </>
      )}
    </div>
  );
}
