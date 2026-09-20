import { formatUsPhone, mapsHref } from "@/lib/sales/derive";
import type { Channel } from "@/lib/sales/leadFilters";
import { type Outcome, type SalesLead, outcomeLabel } from "@/lib/sales/leads";
import { contactLabel, promoCodeFor } from "@/lib/sales/offer";
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
      <dd className="min-w-0 break-words">{children}</dd>
    </>
  );
}

export interface LeadCardProps {
  lead: SalesLead;
  back: string;
  focus?: boolean;
  detailsOpen?: boolean;
  channel?: Channel;
  history?: { actor: string; outcome: string | null; note: string | null; created_at: string }[];
}

export function LeadCard({
  lead,
  back,
  focus = false,
  detailsOpen = false,
  channel = "call",
  history,
}: LeadCardProps) {
  const open = OPEN_STYLE[lead.openState];
  const action = `/api/sales/leads/${lead.id}`;
  const phone = formatUsPhone(lead.phone_e164);
  const promo = promoCodeFor(lead.neighborhood);
  const walking = channel === "walk";
  // On the lead's own page every write comes back to it — the rep is mid-write-up and the next shop
  // is one Next away. From the queue they land back in the queue, as they always have.
  const stay = focus ? <input type="hidden" name="path" value={`/sales/${lead.slug}`} /> : null;

  return (
    <article className="min-w-0 rounded-[18px] border border-ink/10 bg-cream/80 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Chip className={TIER_STYLE[lead.tier] ?? TIER_STYLE.C}>{lead.tier}</Chip>
            {/* min-w-0: a flex item's default min-width is auto (= its content), which blocks
                shrinking and defeats `truncate` — a long shop name was overflowing this row, which
                had no clipping ancestor above it (see globals.css's overflow-x: clip on the body),
                so it cut half the card off on narrow screens instead of ellipsizing. */}
            <h3
              className={`min-w-0 font-display tracking-tight ${
                focus ? "text-[24px] leading-tight sm:text-[28px]" : "truncate text-[19px]"
              }`}
            >
              {/* In focus the card *is* the lead's page, so the name stops being a link to it. */}
              {focus ? (
                lead.shop_name
              ) : (
                <a href={`/sales/${lead.slug}${back}`} className="text-ink no-underline">
                  {lead.shop_name}
                </a>
              )}
            </h3>
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
            <span className={`inline-flex items-center gap-1.5 ${open.tone}`}>
              <span aria-hidden="true" className={`h-2 w-2 rounded-full ${open.dot}`} />
              {open.label}
            </span>
            {lead.todayHours && lead.openState !== "unknown" && (
              <>
                <span aria-hidden="true">·</span>
                <span className={lead.openState === "open" ? open.tone : undefined}>
                  {lead.todayHours}
                </span>
              </>
            )}
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
          <Chip
            className={
              lead.attempts === 0 ? "bg-teal/15 text-teal" : "bg-[#B97E24]/12 text-[#8A5D17]"
            }
          >
            {contactLabel(lead.attempts, channel)}
          </Chip>
          {lead.outcome !== "new" && (
            <Chip className={OUTCOME_STYLE[lead.outcome] ?? "bg-ink/5 text-muted"}>
              {outcomeLabel(lead.outcome, channel)}
            </Chip>
          )}
          {lead.is_chain === 1 && <Chip className="bg-[#B3261E]/10 text-[#B3261E]">chain</Chip>}
          {lead.research?.trim() && <Chip className="bg-ink/5 text-muted">doc</Chip>}
        </div>
      </div>

      {/* On a route the address is the headline and the phone is the fallback: the rep is standing
          on the street, not holding a dialler. Walk mode never lists a lead without an address. */}
      {walking && lead.address ? (
        <>
          <a
            href={mapsHref(lead.address)}
            target="_blank"
            rel="noreferrer"
            className={`mt-3 block font-semibold tracking-tight text-ink no-underline ${
              focus ? "text-[30px] leading-tight" : "text-[21px] leading-snug"
            }`}
          >
            {lead.address}
          </a>
          <a href={`tel:${lead.phone_e164}`} className="mt-1 inline-block text-sm text-muted">
            {phone}
          </a>
        </>
      ) : (
        <>
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
        </>
      )}

      {lead.hookLine && <p className="mt-2 text-sm">{lead.hookLine}</p>}

      {promo && (
        <p className="mt-2 text-sm text-muted">
          Offer <span className="select-all font-semibold text-ink">{promo}</span> — Complete at
          $199/mo for the first year
        </p>
      )}

      <form method="post" action={action} className="mt-4">
        <input type="hidden" name="back" value={back} />
        {stay}
        <fieldset className="border-0 p-0">
          <legend className="text-xs font-medium uppercase tracking-wide text-muted-2">
            {walking ? "Visit result" : "Call result"}
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
                {outcomeLabel(outcome, channel)}
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
                {outcomeLabel(outcome, channel)}
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
              // text-base, not text-sm — anything under 16px makes iOS Safari zoom the page in on
              // focus, which can shove the outcome buttons that actually submit this form off-screen.
              className="w-full rounded-[10px] border border-ink/15 bg-white px-3 py-2 text-base"
            />
          </label>
          <label className="block text-sm text-muted">
            <span className="sr-only">Call back on</span>
            <input
              type="date"
              name="next_followup"
              defaultValue={lead.next_followup ?? ""}
              className="rounded-[10px] border border-ink/15 bg-white px-3 py-2 text-base"
            />
          </label>
        </div>
      </form>

      <details open={detailsOpen} className="mt-3">
        <summary className="cursor-pointer text-sm text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal">
          Details
        </summary>
        <dl className="mt-2 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
          {/* Called out rather than hidden: in the metros the team closes in person, a lead with no
              address is one nobody can drive to, and a blank row read as "not worth showing". */}
          <Row label="Address">
            {lead.address ?? <span className="text-muted">none on file — phone only</span>}
          </Row>
          {lead.rating !== null && (
            <Row label="Rating">
              {lead.rating}★ · {lead.review_count} reviews
            </Row>
          )}
          <Row label="Booking">{lead.booking_app || "unknown"}</Row>
          {lead.prices && lead.price_confidence === "high" && (
            <Row label="Prices seen">{lead.prices}</Row>
          )}
          {lead.weekHours.map((row) => (
            <Row key={row.days} label={row.days}>
              {row.hours}
            </Row>
          ))}
          {lead.website && (
            <Row label="Website">
              <a href={lead.website} target="_blank" rel="noreferrer" className="text-teal">
                {lead.website.replace(/^https?:\/\//, "")}
              </a>
            </Row>
          )}
          {lead.instagram && <Row label="Instagram">{lead.instagram}</Row>}
          {lead.owner && <Row label="Last touched by">{lead.owner}</Row>}
        </dl>
        {history && history.length > 0 && (
          <ul className="mt-3 space-y-1 text-xs text-muted">
            {history.map((event) => (
              <li key={`${event.created_at}-${event.actor}`}>
                {event.created_at.slice(0, 16).replace("T", " ")} · {event.actor} ·{" "}
                {event.outcome ? outcomeLabel(event.outcome as Outcome, channel) : event.note}
                {event.outcome && event.note ? ` — ${event.note}` : ""}
              </li>
            ))}
          </ul>
        )}
      </details>
    </article>
  );
}
