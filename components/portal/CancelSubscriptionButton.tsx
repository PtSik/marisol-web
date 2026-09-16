"use client";

import { Modal } from "@/components/Modal";
import { useId, useState } from "react";

export function CancelSubscriptionButton({ endDate }: { endDate?: string }) {
  const [open, setOpen] = useState(false);
  const titleId = useId();

  return (
    <>
      <button
        type="button"
        className="btn btn-md btn-secondary text-danger"
        onClick={() => setOpen(true)}
      >
        Cancel my subscription
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        labelledBy={titleId}
        locale="en"
        className="relative w-full max-w-[440px] rounded-[20px] border border-ink/10 bg-cream-100 p-7"
      >
        <h2 id={titleId} className="font-display text-[26px] tracking-[-0.02em]">
          Are you sure you want to cancel?
        </h2>
        <p className="mt-3 text-[14.5px] leading-[1.55] text-muted">
          Marisol will keep working
          {endDate ? ` until ${endDate}` : " until the end of your current period"}. After that,
          calls, bookings and reminders will stop.
        </p>
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" className="btn btn-md btn-secondary" onClick={() => setOpen(false)}>
            Keep my subscription
          </button>
          <form method="post" action="/api/portal/cancel-subscription">
            <button type="submit" className="btn btn-md btn-primary w-full sm:w-auto">
              Yes, cancel subscription
            </button>
          </form>
        </div>
      </Modal>
    </>
  );
}
