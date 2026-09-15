"use client";

import type { FieldErrors } from "@/components/onboarding/Field";
import { ForwardingCard } from "@/components/onboarding/ForwardingCard";
import { SetupFields, validateSetup } from "@/components/onboarding/SetupFields";
import { SetupCompleteHeading, ThanksHeading } from "@/components/onboarding/ThanksHeading";
import { type Locale, getDict, setupErrorMessage } from "@/lib/i18n/dict";
import { type SetupDetails, type Vertical, defaultSetup, normalizeSetup } from "@/lib/onboarding";
import { track } from "@/lib/track";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

export function SetupForm({
  sessionId,
  vertical,
  locale,
  completionContent,
}: {
  sessionId: string;
  vertical: Vertical;
  locale: Locale;
  completionContent?: ReactNode;
}) {
  const dict = getDict(locale);
  const t = dict.setup;
  const [setup, setSetup] = useState<SetupDetails>(() =>
    defaultSetup(vertical, t.servicePresets[vertical]),
  );
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [assignedNumber, setAssignedNumber] = useState<string | null>(null);

  useEffect(() => {
    try {
      sessionStorage.removeItem("marisol-onboarding");
    } catch {
      /* storage blocked — non-fatal */
    }
  }, []);

  const patch = (partial: Partial<SetupDetails>) => setSetup((s) => ({ ...s, ...partial }));

  const submit = async () => {
    // Validate and send the same object — see `normalizeSetup`.
    const payload = normalizeSetup(setup);
    const errs = validateSetup(payload, t);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent: "setup", sessionId, setup: payload }),
      });
      const body = (await res.json()) as { ok?: boolean; error?: string; number?: string };
      if (!res.ok || !body.ok) {
        // The worker names what it rejected; repeating "try again" hides the one thing that
        // would let the owner finish.
        setSubmitError(setupErrorMessage(t, body.error));
        setSubmitting(false);
        return;
      }
      track("setup_completed");
      setAssignedNumber(body.number ?? null);
      setDone(true);
    } catch {
      setSubmitError(t.errSubmit);
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <>
        <output className="block">
          <SetupCompleteHeading hasNumber={Boolean(assignedNumber)} t={dict.thanks} />
          {assignedNumber && (
            <ForwardingCard
              twilioNumber={assignedNumber}
              carrier={setup.carrier}
              t={dict.forwarding}
            />
          )}
        </output>
        {completionContent}
      </>
    );
  }

  return (
    <>
      <ThanksHeading title={dict.thanks.finishTitle} lead={dict.thanks.finishLead} />
      <div className="mt-9 rounded-[24px] bg-cream-100 p-[clamp(20px,4vw,34px)]">
        <SetupFields
          setup={setup}
          vertical={vertical}
          errors={errors}
          t={t}
          locale={locale}
          patch={patch}
        />
        {submitError && (
          <p role="alert" className="mt-5 text-center t-body-sm font-medium text-danger">
            {submitError}
          </p>
        )}
        <div className="mt-8 flex justify-end">
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="btn btn-lg btn-primary w-full disabled:opacity-60 sm:w-auto"
          >
            {submitting ? t.submitting : t.submit}
          </button>
        </div>
      </div>
    </>
  );
}
