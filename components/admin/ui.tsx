import type { ReactNode } from "react";

export type Tone = "teal" | "amber" | "red" | "muted";

const PILL_TONE: Record<Tone, string> = {
  teal: "bg-teal/10 text-teal ring-teal/20",
  amber: "bg-[#B97E24]/10 text-[#8A5D17] ring-[#B97E24]/20",
  red: "bg-[#B3261E]/10 text-[#B3261E] ring-[#B3261E]/20",
  muted: "bg-ink/5 text-muted ring-ink/10",
};

export function Pill({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium uppercase tracking-[0.04em] ring-1 ring-inset ${PILL_TONE[tone]}`}
    >
      {children}
    </span>
  );
}

const NOTICE_TONE: Record<Tone, string> = {
  teal: "border-teal/25 bg-teal/10 text-teal",
  amber: "border-[#B97E24]/30 bg-[#B97E24]/10 text-[#8A5D17]",
  red: "border-[#B3261E]/30 bg-[#B3261E]/10 text-[#B3261E]",
  muted: "border-ink/10 bg-ink/5 text-muted",
};

export function Notice({
  tone,
  children,
  alert,
}: { tone: Tone; children: ReactNode; alert?: boolean }) {
  return (
    <p
      role={alert ? "alert" : undefined}
      className={`rounded-[12px] border px-4 py-2.5 text-sm ${NOTICE_TONE[tone]}`}
    >
      {children}
    </p>
  );
}

/** Headline number in the summary strip. Counts are tabular so the row stays aligned. */
export function Stat({
  label,
  value,
  tone = "muted",
}: { label: string; value: number; tone?: Tone }) {
  const accent: Record<Tone, string> = {
    teal: "text-teal",
    amber: "text-[#8A5D17]",
    red: "text-[#B3261E]",
    muted: "text-ink",
  };
  return (
    <div className="rounded-[14px] border border-ink/10 bg-cream/80 px-4 py-3">
      <div className={`font-display text-[26px] leading-none tabular-nums ${accent[tone]}`}>
        {value}
      </div>
      <div className="mt-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-2">
        {label}
      </div>
    </div>
  );
}

/** A labelled block inside an expanded row. `wide` spans the whole detail grid. */
export function Field({
  label,
  children,
  wide,
}: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2 lg:col-span-3" : "min-w-0"}>
      <dt className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-2">{label}</dt>
      <dd className="mt-1 break-words text-sm leading-snug text-ink">{children}</dd>
    </div>
  );
}

export function FieldGrid({ children }: { children: ReactNode }) {
  return <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">{children}</dl>;
}

/** Right-hand column of an expanded row: everything the operator can act on. */
export function ActionPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-[14px] border border-ink/10 bg-offwhite p-4">
      <h4 className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-2">{title}</h4>
      <div className="mt-3 space-y-3">{children}</div>
    </div>
  );
}

export function SubmitButton({
  children,
  disabled,
  danger,
}: { children: ReactNode; disabled?: boolean; danger?: boolean }) {
  const skin = danger
    ? "border-[#B3261E]/30 bg-[#B3261E]/10 text-[#B3261E]"
    : "border-teal/30 bg-teal/10 text-teal";
  return (
    <button
      type="submit"
      disabled={disabled}
      className={`w-full rounded-[10px] border px-4 py-2 text-sm font-medium disabled:opacity-40 ${skin}`}
    >
      {children}
    </button>
  );
}

export function Hint({ children }: { children: ReactNode }) {
  return <p className="text-xs leading-snug text-muted-2">{children}</p>;
}

/** `open` names the group-open variant so nested disclosures rotate independently. */
function Chevron({ open }: { open: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className={`h-4 w-4 shrink-0 text-muted-3 transition-transform duration-150 ${open}`}
    >
      <path
        d="M6 3.5 10.5 8 6 12.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const STRIP_HEAD = "flex items-center gap-3 px-3.5 py-2.5";
const STRIP_LABEL = "text-[11px] font-medium uppercase tracking-[0.08em] text-muted-2";

/**
 * A labelled strip inside an expanded row. Reference detail — hours, a service
 * menu — stays folded behind a one-line preview so the row keeps its shape.
 */
export function Disclosure({
  label,
  preview,
  children,
}: { label: string; preview?: ReactNode; children: ReactNode }) {
  return (
    <details className="group/disc rounded-[12px] border border-ink/10 bg-offwhite">
      <summary
        className={`${STRIP_HEAD} cursor-pointer list-none hover:bg-ink/5 [&::-webkit-details-marker]:hidden`}
      >
        <span className={`${STRIP_LABEL} shrink-0`}>{label}</span>
        <span className="min-w-0 flex-1 truncate text-sm text-ink">{preview}</span>
        <Chevron open="group-open/disc:rotate-90" />
      </summary>
      <div className="border-t border-ink/10 px-3.5 py-3">{children}</div>
    </details>
  );
}

/**
 * Same shell as `Disclosure` for detail that must stay on screen. `pr-7` reserves the
 * chevron column so the content lines up with the disclosures above it.
 */
export function Strip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-[12px] border border-ink/10 bg-offwhite">
      <div className={`${STRIP_HEAD} items-start pr-7`}>
        <span className={`${STRIP_LABEL} shrink-0 pt-px`}>{label}</span>
        <div className="min-w-0 flex-1 text-sm text-ink">{children}</div>
      </div>
    </div>
  );
}

/**
 * One scannable line that expands in place. The grid template is passed in so every
 * row in a table shares the header's columns.
 */
export function Row({
  columns,
  summary,
  children,
  defaultOpen,
}: {
  columns: string;
  summary: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details open={defaultOpen} className="group border-t border-ink/10 first:border-t-0">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 hover:bg-ink/5 [&::-webkit-details-marker]:hidden">
        <div className={`grid min-w-0 flex-1 items-center gap-x-4 gap-y-1 ${columns}`}>
          {summary}
        </div>
        <Chevron open="group-open:rotate-90" />
      </summary>
      <div className="border-t border-dashed border-ink/10 bg-cream-300/40 px-4 py-5">
        {children}
      </div>
    </details>
  );
}

/** Column captions above a row list. Hidden on small screens, where rows stack. */
export function RowHeader({ columns, children }: { columns: string; children: ReactNode }) {
  return (
    <div className="hidden border-b border-ink/10 px-4 py-2 md:block">
      <div
        className={`grid items-center gap-x-4 pr-7 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-3 ${columns}`}
      >
        {children}
      </div>
    </div>
  );
}

export function Section({
  title,
  count,
  hint,
  columns,
  headers,
  children,
}: {
  title: string;
  count: number;
  hint?: string;
  columns?: string;
  headers?: ReactNode;
  children: ReactNode;
}) {
  if (count === 0) return null;
  return (
    <section className="mt-9">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="font-display text-[21px] tracking-tight">{title}</h2>
        <span className="text-sm tabular-nums text-muted-2">{count}</span>
        {hint && <span className="text-sm text-muted-2">— {hint}</span>}
      </div>
      <div className="mt-3 overflow-hidden rounded-[16px] border border-ink/10 bg-cream/80">
        {columns && headers && <RowHeader columns={columns}>{headers}</RowHeader>}
        {children}
      </div>
    </section>
  );
}

export function fmtDate(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
