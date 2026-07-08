"use client";

import type { FieldErrors } from "@/components/onboarding/Field";
import { SetupFields, validateSetup } from "@/components/onboarding/SetupFields";
import { SetupCompleteHeading, ThanksHeading } from "@/components/onboarding/ThanksHeading";
import { type SetupDetails, type Vertical, defaultSetup } from "@/lib/onboarding";
import { track } from "@/lib/track";
import { useEffect, useState } from "react";

export function SetupForm({ sessionId, vertical }: { sessionId: string; vertical: Vertical }) {
  const [setup, setSetup] = useState<SetupDetails>(() => defaultSetup(vertical));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    try {
      sessionStorage.removeItem("kaijiro-onboarding");
    } catch {
      /* storage blocked — non-fatal */
    }
  }, []);

  const patch = (partial: Partial<SetupDetails>) => setSetup((s) => ({ ...s, ...partial }));

  const submit = async () => {
    const errs = validateSetup(setup);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent: "setup", sessionId, setup }),
      });
      const body = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !body.ok) {
        throw new Error(body.error ?? "setup failed");
      }
      track("setup_completed");
      setDone(true);
    } catch {
      setSubmitError("Something went wrong saving your setup. Please try again.");
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <output className="block">
        <SetupCompleteHeading />
      </output>
    );
  }

  return (
    <>
      <ThanksHeading
        title={
          <>
            Payment received. <span className="text-teal">Finish your setup.</span>
          </>
        }
        lead="Add your hours, services and staff below — your receptionist is configured from exactly this. Takes about three minutes."
      />
      <div className="mt-9 rounded-[24px] bg-cream-100 p-[clamp(20px,4vw,34px)]">
        <SetupFields setup={setup} vertical={vertical} errors={errors} patch={patch} />
        {submitError && (
          <p role="alert" className="mt-5 text-center text-[13.5px] font-medium text-[#B4452C]">
            {submitError}
          </p>
        )}
        <div className="mt-8 flex justify-end">
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="inline-flex min-h-[50px] w-full items-center justify-center gap-2 rounded-[13px] bg-ink px-7 py-[14px] text-[15px] font-medium text-cream disabled:opacity-60 sm:w-auto"
          >
            {submitting ? "Saving…" : "Finish setup"}
          </button>
        </div>
      </div>
    </>
  );
}
