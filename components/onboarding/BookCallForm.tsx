"use client";

import { type CallPrefill, CallRequestForm } from "@/components/CallRequestForm";
import type { Dict } from "@/lib/i18n/dict";
import { useState } from "react";

export function BookCallForm({
  prefill,
  t,
  form,
}: { prefill: CallPrefill; t: Dict["onboarding"]; form: Dict["callForm"] }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <p className="mt-6 text-center t-body-sm text-muted">
        {t.bookCallBefore}
        <button type="button" onClick={() => setOpen(true)} className="font-medium text-teal">
          {t.bookCallLink}
        </button>
        {t.bookCallAfter}
      </p>
    );
  }

  return (
    <div className="mt-6">
      <CallRequestForm prefill={prefill} onCancel={() => setOpen(false)} t={form} />
    </div>
  );
}
