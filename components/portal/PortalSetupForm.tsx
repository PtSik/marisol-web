"use client";

import { Field, type FieldErrors } from "@/components/onboarding/Field";
import { SetupFields, validateSetup } from "@/components/onboarding/SetupFields";
import { inputCls } from "@/components/onboarding/fieldStyles";
import { setupErrorMessage } from "@/lib/i18n/dict";
import { en } from "@/lib/i18n/en";
import { type SetupDetails, TIMEZONE_IDS, type Vertical, normalizeSetup } from "@/lib/onboarding";
import { useState } from "react";

export function PortalSetupForm({
  initialSetup,
  initialTimezone,
  vertical,
}: { initialSetup: SetupDetails; initialTimezone: string; vertical: Vertical }) {
  const [setup, setSetup] = useState<SetupDetails>(initialSetup);
  const [timezone, setTimezone] = useState(initialTimezone);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<"idle" | "saved" | "failed">("idle");
  const [failure, setFailure] = useState(en.setup.errSubmit);

  const patch = (partial: Partial<SetupDetails>) => {
    setStatus("idle");
    setSetup((s) => ({ ...s, ...partial }));
  };

  const save = async () => {
    // Validate and send the same object — a lead saved before the staff-hours rules changed can
    // carry hours behind a switched-off toggle, and those fields aren't on screen to be fixed.
    const payload = normalizeSetup(setup);
    const errs = validateSetup(payload, en.setup);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setSaving(true);
    setStatus("idle");
    try {
      const res = await fetch("/api/portal/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ setup: payload, timezone }),
      });
      const body = (await res.json()) as { ok?: boolean; shopUpdated?: boolean; error?: string };
      if (res.ok && body.ok && body.shopUpdated) {
        setSetup(payload);
        setStatus("saved");
      } else {
        // Saved but not applied is a different problem from rejected, and needs a different answer
        // than "try again" — the retry would keep succeeding while the agent stays stale.
        setFailure(
          res.ok && body.ok ? en.setup.errShopDrift : setupErrorMessage(en.setup, body.error),
        );
        setStatus("failed");
      }
    } catch {
      setFailure(en.setup.errSubmit);
      setStatus("failed");
    }
    setSaving(false);
  };

  return (
    <div className="mt-7 rounded-[24px] bg-cream-100 p-[clamp(20px,4vw,34px)]">
      <SetupFields setup={setup} vertical={vertical} errors={errors} t={en.setup} patch={patch} />

      <div className="mt-7">
        <Field
          label="Time zone"
          htmlFor="portal-timezone"
          hint="Everything Marisol says about times is in this zone."
        >
          <select
            id="portal-timezone"
            className={`${inputCls} max-w-[420px]`}
            value={timezone}
            onChange={(e) => {
              setStatus("idle");
              setTimezone(e.target.value);
            }}
          >
            {TIMEZONE_IDS.map((id) => (
              <option key={id} value={id}>
                {en.timezones[id]}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-end gap-4">
        {status === "saved" && (
          <output className="text-[14px] font-medium text-teal">
            Saved — live on your next call.
          </output>
        )}
        {status === "failed" && (
          <p role="alert" className="max-w-[46ch] text-[14px] font-medium text-[#B4452C]">
            {failure}
          </p>
        )}
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="inline-flex min-h-[50px] w-full items-center justify-center rounded-[13px] bg-ink px-7 py-[14px] text-[15px] font-medium text-cream disabled:opacity-60 sm:w-auto"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  );
}
