import { formatUsPhone } from "@/lib/sales/derive";
import { OUTCOME_LABELS, type Outcome, type SalesLead } from "@/lib/sales/leads";
import type { ReactNode } from "react";

const TIER_STYLE: Record<string, string> = {
  A: "bg-teal text-white",
  B: "bg-teal/15 text-teal",
  C: "bg-ink/5 text-muted",
  X: "bg-[#B3261E]/10 text-[#B3261E]",
};

const OPEN_STYLE = {
  open: { dot: "bg-success", label: "open now", tone: "text-success" },
  closed: { dot: "bg-[#B3261E]", label: "closed", tone: "text-[#B3261E]" },
  unknown: { dot: "bg-muted-3", label: "hours unknown", tone: "text-muted-2" },
} as const;

const OUTCOME_STYLE: Partial<Record<Outcome, string>> = {
  interested: "bg-success/12 text-success",
  demo_sent: "bg-teal/15 text-teal",
  callback: "bg-[#B97E24]/12 text-[#8A5D17]",
  not_interested: "bg-ink/5 text-muted",
  dead: "bg-ink/5 text-muted",
  wrong_number: "bg-ink/5 text-muted",
};

// A rep works through these top to bottom during and right after a call, so the order matches how a
// call actually ends rather than the enum order.
const QUICK_OUTCOMES: Outcome[] = ["no_answer", "callback", "gatekeeper", "interested"];
const CLOSING_OUTCOMES: Outcome[] = ["not_interested", "wrong_number", "dead"];

function Chip({ className, children }: { className: string; children: ReactNode }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}>
      {children}
    </span>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-muted">{label}</dt>
      <dd className="break-words">{children}</dd>
    </>
  );
}

export interface LeadCardProps {
  lead: SalesLead;
  back: string;
  focus?: boolean;
  history?: { actor: string; outcome: string | null; note: string | null; created_at: string }[];
}

export function LeadCard({ lead, back, focus = false, history }: LeadCardProps) {
  const open = OPEN_STYLE[lead.openState];
  const action = `/api/sales/leads/${lead.id}`;
  const phone = formatUsPhone(lead.phone_e164);

  return (
    <article className="rounded-[18px] border border-ink/10 bg-cream/80 p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Chip className={TIER_STYLE[lead.tier] ?? TIER_STYLE.C}>{lead.tier}</Chip>
            <h3
              className={`truncate font-display tracking-tight ${focus ? "text-[28px]" : "text-[19px]"}`}
            >
              {lead.shop_name}
            </h3>
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
            <span className={`inline-flex items-center gap-1.5 ${open.tone}`}>
              <span aria-hidden="true" className={`h-2 w-2 rounded-full ${open.dot}`} />
              {open.label}
            </span>
            <span aria-hidden="true">·</span>
            <span>{lead.neighborhood}</span>
            {lead.es_strength !== "none" && (
              <>
                <span aria-hidden="true">·</span>
                <span>likely Spanish{lead.es_strength === "weak" ? " (weak signal)" : ""}</span>
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {lead.outcome !== "new" && (
            <Chip className={OUTCOME_STYLE[lead.outcome] ?? "bg-ink/5 text-muted"}>
              {OUTCOME_LABELS[lead.outcome]}
              {lead.attempts > 1 ? ` ·${lead.attempts}` : ""}
            </Chip>
          )}
          {lead.is_chain === 1 && <Chip className="bg-[#B3261E]/10 text-[#B3261E]">chain</Chip>}
          {lead.demo_lang && (
            <Chip className="bg-teal/15 text-teal">demo {lead.demo_lang.toUpperCase()}</Chip>
          )}
        </div>
      </div>

      <a
        href={`tel:${lead.phone_e164}`}
        className={`mt-3 block font-semibold tracking-tight text-ink no-underline ${
          focus ? "text-[42px] leading-tight" : "text-[26px]"
        }`}
      >
        {phone}
      </a>
      {/* Tap-to-call does nothing on a desktop, so the number stays selectable as plain text. */}
      <p className="mt-0.5 select-all text-xs text-muted-2">{lead.phone_e164}</p>

      {lead.hookLine && <p className="mt-2 text-sm">{lead.hookLine}</p>}

      <form method="post" action={action} className="mt-4">
        <input type="hidden" name="back" value={back} />
        <fieldset className="border-0 p-0">
          <legend className="text-xs font-medium uppercase tracking-wide text-muted-2">
            Call result
          </legend>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {QUICK_OUTCOMES.map((outcome) => (
              <button
                key={outcome}
                type="submit"
                name="outcome"
                value={outcome}
                className="rounded-[10px] border border-ink/15 bg-white px-3 py-2 text-sm font-medium hover:border-teal/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
              >
                {OUTCOME_LABELS[outcome]}
              </button>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {CLOSING_OUTCOMES.map((outcome) => (
              <button
                key={outcome}
                type="submit"
                name="outcome"
                value={outcome}
                className="rounded-[10px] border border-ink/10 px-3 py-1.5 text-xs text-muted hover:border-ink/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
              >
                {OUTCOME_LABELS[outcome]}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_max-content]">
          <label className="block">
            <span className="sr-only">Note for {lead.shop_name}</span>
            <input
              type="text"
              name="note"
              defaultValue={lead.note ?? ""}
              placeholder="Note — saved with the result"
              className="w-full rounded-[10px] border border-ink/15 bg-white px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm text-muted">
            <span className="sr-only">Call back on</span>
            <input
              type="date"
              name="next_followup"
              defaultValue={lead.next_followup ?? ""}
              className="rounded-[10px] border border-ink/15 bg-white px-3 py-2 text-sm"
            />
          </label>
        </div>
      </form>

      <form method="post" action={action} className="mt-3 border-t border-ink/10 pt-3">
        <input type="hidden" name="back" value={back} />
        <input type="hidden" name="intent" value="demo" />
        <p className="text-xs font-medium uppercase tracking-wide text-muted-2">
          Generate demo — pick the language you heard on the call
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <button
            type="submit"
            name="demo_lang"
            value="en"
            className="rounded-[10px] border border-teal/30 bg-teal/10 px-3 py-2 text-sm font-medium text-teal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
          >
            English
          </button>
          <button
            type="submit"
            name="demo_lang"
            value="es"
            className="rounded-[10px] border border-teal/30 bg-teal/10 px-3 py-2 text-sm font-medium text-teal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
          >
            Español
          </button>
          <span className="text-xs text-muted-2">
            {lead.demo_requested_at
              ? `requested ${lead.demo_requested_at.slice(0, 10)} — number pool coming`
              : "records your choice; the number pool lands in phase 2"}
          </span>
        </div>
      </form>

      {lead.demo_requested_at && (
        <form method="post" action={action} className="mt-2">
          <input type="hidden" name="back" value={back} />
          <input type="hidden" name="intent" value="demo_cancel" />
          <button
            type="submit"
            className="rounded-[10px] border border-ink/10 px-3 py-1.5 text-xs text-muted hover:border-ink/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
          >
            Cancel demo
          </button>
        </form>
      )}

      <details className="mt-3">
        <summary className="cursor-pointer text-sm text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal">
          Details
        </summary>
        <dl className="mt-2 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
          {lead.address && <Row label="Address">{lead.address}</Row>}
          {lead.rating !== null && (
            <Row label="Rating">
              {lead.rating}★ · {lead.review_count} reviews
            </Row>
          )}
          <Row label="Booking">{lead.booking_app || "unknown"}</Row>
          {lead.prices && lead.price_confidence === "high" && (
            <Row label="Prices seen">{lead.prices}</Row>
          )}
          {lead.price_confidence !== "high" && (
            <Row label="Prices">
              <span className="text-muted-2">not scraped — ask for two on the call</span>
            </Row>
          )}
          {lead.hours && <Row label="Hours">{lead.hours.replace(/\s*\|\s*/g, " · ")}</Row>}
          {lead.website && (
            <Row label="Website">
              <a href={lead.website} target="_blank" rel="noreferrer" className="text-teal">
                {lead.website.replace(/^https?:\/\//, "")}
              </a>
            </Row>
          )}
          {lead.instagram && <Row label="Instagram">{lead.instagram}</Row>}
          {lead.owner && <Row label="Last touched by">{lead.owner}</Row>}
          {lead.demo_lang && <Row label="Demo language">{lead.demo_lang}</Row>}
        </dl>
        {history && history.length > 0 && (
          <ul className="mt-3 space-y-1 text-xs text-muted">
            {history.map((event) => (
              <li key={`${event.created_at}-${event.actor}`}>
                {event.created_at.slice(0, 16).replace("T", " ")} · {event.actor} ·{" "}
                {event.outcome ? OUTCOME_LABELS[event.outcome as Outcome] : event.note}
                {event.outcome && event.note ? ` — ${event.note}` : ""}
              </li>
            ))}
          </ul>
        )}
      </details>
    </article>
  );
}
