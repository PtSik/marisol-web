import type { ReactNode } from "react";

export type FieldErrors = Partial<Record<string, string>>;

export function Field({
  label,
  error,
  hint,
  htmlFor,
  liveHint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  htmlFor: string;
  /* set when the hint changes on its own, so a screen reader is told what changed under the field */
  liveHint?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-[6px]">
      <label htmlFor={htmlFor} className="text-[13.5px] font-medium text-ink">
        {label}
      </label>
      {children}
      {hint && !error && (
        <span className="text-[12.5px] text-muted-2" aria-live={liveHint ? "polite" : undefined}>
          {hint}
        </span>
      )}
      {error && (
        <span role="alert" className="text-[12.5px] font-medium text-[#B4452C]">
          {error}
        </span>
      )}
    </div>
  );
}
