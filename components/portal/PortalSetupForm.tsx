"use client";

import { Field, type FieldErrors } from "@/components/onboarding/Field";
import { SetupFields, validateSetup } from "@/components/onboarding/SetupFields";
import { inputCls } from "@/components/onboarding/fieldStyles";
import { type SetupDetails, TIMEZONES, type Vertical } from "@/lib/onboarding";
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

  const patch = (partial: Partial<SetupDetails>) => {
    setStatus("idle");
    setSetup((s) => ({ ...s, ...partial }));
  };

  const save = async () => {
    const errs = validateSetup(setup);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setSaving(true);
    setStatus("idle");
    try {
      const res = await fetch("/api/portal/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ setup, timezone }),
      });
      const body = (await res.json()) as { ok?: boolean; shopUpdated?: boolean };
      setStatus(res.ok && body.ok && body.shopUpdated ? "saved" : "failed");
    } catch {
      setStatus("failed");
    }
    setSaving(false);
  };

  return (
    <div className="mt-7 rounded-[24px] bg-cream-100 p-[clamp(20px,4vw,34px)]">
      <SetupFields setup={setup} vertical={vertical} errors={errors} patch={patch} />

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
            {TIMEZONES.map((tz) => (
              <option key={tz.id} value={tz.id}>
                {tz.label}
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
          <p role="alert" className="text-[14px] font-medium text-[#B4452C]">
            We couldn't save that. Please try again.
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
