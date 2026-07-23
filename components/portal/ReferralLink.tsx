"use client";

import { useState } from "react";

export function CopyField({ value, label, big }: { value: string; label: string; big?: boolean }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — the value is on screen and selectable anyway */
    }
  }

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <code
        className={`min-w-0 flex-1 overflow-x-auto rounded-[12px] border border-ink/10 bg-white px-4 py-3 ${
          big ? "text-[22px] font-semibold tracking-[0.08em]" : "text-[15px]"
        }`}
      >
        {value}
      </code>
      <button
        type="button"
        onClick={copy}
        className="min-h-[46px] rounded-[12px] bg-ink px-5 py-2.5 text-[14px] font-medium text-cream"
      >
        {copied ? "Copied" : label}
      </button>
    </div>
  );
}
