import { Field } from "@/components/onboarding/Field";
import { inputCls } from "@/components/onboarding/fieldStyles";
import { PAYOUT_HINT, PAYOUT_LABEL, PAYOUT_METHODS, isPayoutMethod } from "@/lib/payout";

export function ClaimPayoutForm({
  amountCents,
  savedMethod,
  savedHandle,
}: {
  amountCents: number;
  savedMethod?: string | null;
  savedHandle?: string | null;
}) {
  const method = isPayoutMethod(savedMethod) ? savedMethod : "paypal";

  return (
    <form
      method="post"
      action="/api/portal/referral-payout"
      className="mt-4 rounded-[24px] bg-cream-100 p-[clamp(20px,4vw,34px)]"
    >
      <p className="font-display text-[clamp(20px,3vw,26px)] tracking-[-0.02em]">
        Claim ${amountCents / 100}
      </p>
      <p className="mt-1.5 max-w-[52ch] text-[14px] leading-[1.5] text-muted">
        Tell us where to send it and we'll pay it out by hand — usually within two business days.
      </p>

      <div className="mt-6 grid max-w-[420px] gap-5">
        <Field label="Send it with" htmlFor="payout-method">
          <select id="payout-method" name="method" className={inputCls} defaultValue={method}>
            {PAYOUT_METHODS.map((m) => (
              <option key={m} value={m}>
                {PAYOUT_LABEL[m]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Your handle" htmlFor="payout-handle" hint={PAYOUT_HINT}>
          <input
            id="payout-handle"
            name="handle"
            className={inputCls}
            defaultValue={savedHandle ?? ""}
            placeholder="you@example.com"
            required
          />
        </Field>
      </div>

      <button
        type="submit"
        className="mt-7 inline-flex min-h-[50px] w-full items-center justify-center rounded-[13px] bg-teal px-7 py-[14px] text-[15px] font-medium text-cream sm:w-auto"
      >
        Claim ${amountCents / 100}
      </button>
    </form>
  );
}
