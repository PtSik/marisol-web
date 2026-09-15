"use client";

import type { Dict } from "@/lib/i18n/dict";
import { SALES_EMAIL_HREF } from "@/lib/site";
import { useState } from "react";

type State = "idle" | "sending" | "sent" | "failed";

export function ForwardingHelpButton({
  topic,
  variant,
  t,
}: {
  topic: "forwarding_voip" | "forwarding_codes";
  variant: "button" | "link";
  t: Dict["forwarding"];
}) {
  const [state, setState] = useState<State>("idle");

  const send = async () => {
    setState("sending");
    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic }),
      });
      setState(res.ok ? "sent" : "failed");
    } catch {
      setState("failed");
    }
  };

  if (state === "sent") {
    return <output className="block t-body-sm font-medium text-teal">{t.helpSent}</output>;
  }

  if (state === "failed") {
    return (
      <p className="t-body-sm text-muted-2">
        {t.helpFailedBefore}
        <a href={SALES_EMAIL_HREF} className="font-medium text-teal">
          {t.helpFailedLink}
        </a>
        {t.helpFailedAfter}
      </p>
    );
  }

  const label = state === "sending" ? t.helpSending : t.helpButton;

  if (variant === "link") {
    return (
      <p className="t-body-sm text-muted-2">
        {t.troubleBefore}
        <button
          type="button"
          onClick={send}
          disabled={state === "sending"}
          className="font-medium text-teal underline disabled:opacity-60"
        >
          {label}
        </button>
        {t.troubleAfter}
      </p>
    );
  }

  return (
    <button
      type="button"
      onClick={send}
      disabled={state === "sending"}
      className="btn btn-md btn-primary mt-4 disabled:opacity-60"
    >
      {label}
    </button>
  );
}
