"use client";

import { SALES_EMAIL_HREF } from "@/lib/site";
import { useState } from "react";

type State = "idle" | "sending" | "sent" | "failed";

export function SupportForm() {
  const [message, setMessage] = useState("");
  const [state, setState] = useState<State>("idle");

  const send = async () => {
    if (!message.trim()) return;
    setState("sending");
    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: "general", message }),
      });
      setState(res.ok ? "sent" : "failed");
    } catch {
      setState("failed");
    }
  };

  return (
    <details className="rounded-[16px] border border-ink/10 bg-cream-100 px-[18px] py-3.5">
      <summary className="cursor-pointer text-[14px] font-medium">Need help?</summary>
      {state === "sent" ? (
        <output className="mt-3 block text-[14px] text-teal">
          Thanks — we'll get back to you today. We have your salon details, so there's nothing else
          to send.
        </output>
      ) : (
        <div className="mt-3">
          <label htmlFor="support-message" className="block text-[13.5px] text-muted">
            Tell us what's going on and we'll pick it up from here — your salon, number and setup
            come through with it.
          </label>
          <textarea
            id="support-message"
            rows={3}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="mt-2 min-h-[80px] w-full resize-y rounded-[12px] border border-ink/15 bg-cream px-[14px] py-2.5 text-[15px]"
            placeholder="Marisol didn't pick up a call this morning…"
          />
          <div className="mt-2.5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={send}
              disabled={state === "sending" || !message.trim()}
              className="inline-flex min-h-[42px] items-center justify-center rounded-[12px] bg-ink px-5 text-[14.5px] font-medium text-cream disabled:opacity-50"
            >
              {state === "sending" ? "Sending…" : "Send"}
            </button>
            {state === "failed" && (
              <p role="alert" className="text-[13.5px] text-muted-2">
                That didn't send.{" "}
                <a href={SALES_EMAIL_HREF} className="font-medium text-teal">
                  Email us
                </a>{" "}
                instead.
              </p>
            )}
          </div>
        </div>
      )}
    </details>
  );
}
