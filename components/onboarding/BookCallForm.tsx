"use client";

import { type CallPrefill, CallRequestForm } from "@/components/CallRequestForm";
import { useState } from "react";

export function BookCallForm({ prefill }: { prefill: CallPrefill }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <p className="mt-6 text-center text-[14px] text-muted">
        Prefer to talk it through first?{" "}
        <button type="button" onClick={() => setOpen(true)} className="font-medium text-teal">
          Book a 15-min call
        </button>{" "}
        — no payment needed.
      </p>
    );
  }

  return (
    <div className="mt-6">
      <CallRequestForm prefill={prefill} onCancel={() => setOpen(false)} />
    </div>
  );
}
