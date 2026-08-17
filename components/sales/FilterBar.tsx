import type { Channel } from "@/lib/sales/leadFilters";
import { type Outcome, outcomeLabel } from "@/lib/sales/leads";

export interface SalesQuery {
  neighborhood?: string;
  tier?: string;
  outcome?: string;
  open?: string;
  es?: string;
  mode?: string;
  view?: string;
  lead?: string;
  low?: string;
  page?: string;
  lowPage?: string;
  mobilePage?: string;
  /** "1" walks, "0" dials, empty follows the area's own channel. */
  route?: string;
  zip?: string;
}

// A narrower result set makes the page the rep is on meaningless, so every filter link goes back to
// the first page of every list. The view toggle does not — it shows the same leads differently.
const FIRST_PAGE: SalesQuery = { page: "", lowPage: "", mobilePage: "" };

export function buildQuery(current: SalesQuery, patch: SalesQuery): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...current, ...patch })) {
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

function Chip({
  href,
  active,
  children,
}: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <a
      href={`/sales${href}`}
      aria-current={active ? "true" : undefined}
      className={`rounded-full px-3 py-1.5 text-sm no-underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal ${
        active ? "bg-ink text-cream" : "border border-ink/15 bg-white text-ink hover:border-teal/40"
      }`}
    >
      {children}
    </a>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div
      // biome-ignore lint/a11y/useSemanticElements: these are navigation links, not form controls — <fieldset>/<legend> would claim otherwise
      role="group"
      aria-label={label}
      className="flex flex-wrap items-center gap-1.5"
    >
      <span className="text-xs font-medium uppercase tracking-wide text-muted-2">{label}</span>
      {children}
    </div>
  );
}

export interface FilterBarProps {
  query: SalesQuery;
  neighborhoods: string[];
  channel: Channel;
  /** Blocks of the current area, in walking order. Empty outside walk mode. */
  zips: number[];
}

export function FilterBar({ query, neighborhoods, channel, zips }: FilterBarProps) {
  const toggle = (key: keyof SalesQuery, value: string): SalesQuery => ({
    [key]: query[key] === value ? "" : value,
    ...FIRST_PAGE,
  });

  const walking = channel === "walk";
  const openOn = query.open === "1";
  const openHref = buildQuery(query, toggle("open", "1"));

  const hasActiveFilters = Boolean(
    query.neighborhood || query.tier || query.outcome || query.open || query.es || query.zip,
  );

  return (
    <div className="mt-4 rounded-[18px] border border-ink/10 bg-cream/80 p-4">
      {/* Seventeen areas open on the bar pushed the queue off a phone screen; closed on every load
          the group costs one row and still names what is selected. */}
      <details className="group rounded-[12px] border border-ink/15 bg-white">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3.5 py-2.5 [&::-webkit-details-marker]:hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal">
          <span className="flex flex-wrap items-baseline gap-x-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-2">Area:</span>
            <span className="text-sm font-medium text-ink">{query.neighborhood || "All"}</span>
          </span>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="shrink-0 text-muted-2 transition-transform duration-200 group-open:rotate-180"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </summary>
        <div
          // biome-ignore lint/a11y/useSemanticElements: these are navigation links, not form controls — <fieldset>/<legend> would claim otherwise
          role="group"
          aria-label="Area"
          className="flex flex-wrap items-center gap-1.5 border-t border-ink/10 px-3.5 py-3"
        >
          <Chip
            href={buildQuery(query, { neighborhood: "", zip: "", ...FIRST_PAGE })}
            active={!query.neighborhood}
          >
            all
          </Chip>
          {neighborhoods.map((n) => (
            <Chip
              key={n}
              // A block belongs to one area, so leaving it set across a change of area empties the
              // queue with no visible cause.
              href={buildQuery(query, { ...toggle("neighborhood", n), zip: "" })}
              active={query.neighborhood === n}
            >
              {n}
            </Chip>
          ))}
        </div>
      </details>

      {walking && zips.length > 0 && (
        <div className="mt-3 border-t border-ink/10 pt-3">
          <Group label="Block">
            <Chip href={buildQuery(query, { zip: "", ...FIRST_PAGE })} active={!query.zip}>
              whole area
            </Chip>
            {zips.map((zip) => (
              <Chip
                key={zip}
                href={buildQuery(query, toggle("zip", String(zip)))}
                active={query.zip === String(zip)}
              >
                {String(zip).padStart(5, "0")}
              </Chip>
            ))}
          </Group>
        </div>
      )}

      <div className="mt-3 space-y-2 border-t border-ink/10 pt-3">
        <Group label="Tier">
          {/* Default. Tier X keeps its own collapsed group, so nothing is listed twice. */}
          <Chip href={buildQuery(query, { tier: "", ...FIRST_PAGE })} active={!query.tier}>
            show all
          </Chip>
          <Chip href={buildQuery(query, toggle("tier", "AB"))} active={query.tier === "AB"}>
            A + B
          </Chip>
          {["A", "B", "C"].map((t) => (
            <Chip key={t} href={buildQuery(query, toggle("tier", t))} active={query.tier === t}>
              {t}
            </Chip>
          ))}
        </Group>

        <Group label="State">
          <Chip href={buildQuery(query, { outcome: "", ...FIRST_PAGE })} active={!query.outcome}>
            {walking ? "to visit" : "to call"}
          </Chip>
          {(["no_answer", "interested", "demo_sent", "callback"] as Outcome[]).map((o) => (
            <Chip
              key={o}
              href={buildQuery(query, toggle("outcome", o))}
              active={query.outcome === o}
            >
              {outcomeLabel(o, channel)}
            </Chip>
          ))}
          <Chip
            href={buildQuery(query, { outcome: "all", ...FIRST_PAGE })}
            active={query.outcome === "all"}
          >
            everything
          </Chip>
        </Group>

        <Group label="Filters">
          <Chip href={openHref} active={openOn}>
            open now
          </Chip>
          <Chip href={buildQuery(query, toggle("es", "strong"))} active={query.es === "strong"}>
            Spanish signal
          </Chip>
        </Group>

        <Group label="Working">
          {/* Both sides are stated outright rather than toggled to empty: empty means "whatever
              this area does", so toggling off would bounce a rep who chose calls in Stratford
              straight back onto the route. */}
          <Chip href={buildQuery(query, { route: "0", zip: "", ...FIRST_PAGE })} active={!walking}>
            calls
          </Chip>
          <Chip href={buildQuery(query, { route: "1", ...FIRST_PAGE })} active={walking}>
            route
          </Chip>
        </Group>

        <Group label="View">
          <Chip href={buildQuery(query, { view: "" })} active={query.view !== "list"}>
            cards
          </Chip>
          <Chip href={buildQuery(query, { view: "list" })} active={query.view === "list"}>
            list
          </Chip>
        </Group>
      </div>

      {hasActiveFilters && (
        <div className="mt-2 flex justify-end border-t border-ink/10 pt-2">
          <a
            href={`/sales${buildQuery(query, {
              neighborhood: "",
              tier: "",
              outcome: "",
              open: "",
              es: "",
              zip: "",
              ...FIRST_PAGE,
            })}`}
            className="text-sm text-teal no-underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
          >
            Clear filters
          </a>
        </div>
      )}
    </div>
  );
}
