import type { Channel } from "@/lib/sales/leadFilters";

export interface SalesQuery {
  neighborhood?: string;
  /** "all" drops the queue's own filter and shows every lead in the area, worked or not. */
  outcome?: string;
  low?: string;
  page?: string;
  lowPage?: string;
  /** "1" lists the vans instead of the shops with a door. */
  mobile?: string;
  zip?: string;
}

// A narrower result set makes the page the rep is on meaningless, so every filter link goes back to
// the first page of every list.
const FIRST_PAGE: SalesQuery = { page: "", lowPage: "" };

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

// A long chip list folded away behind what it currently selects. Open on the bar, the areas and
// the blocks of a walked town cost most of a phone screen before the first lead.
function Collapsible({
  label,
  value,
  children,
}: { label: string; value: string; children: React.ReactNode }) {
  return (
    <details className="group rounded-[12px] border border-ink/15 bg-white">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3.5 py-2.5 [&::-webkit-details-marker]:hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal">
        <span className="flex flex-wrap items-baseline gap-x-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-2">{label}:</span>
          <span className="text-sm font-medium text-ink">{value}</span>
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
        aria-label={label}
        className="flex flex-wrap items-center gap-1.5 border-t border-ink/10 px-3.5 py-3"
      >
        {children}
      </div>
    </details>
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
  const onMobile = query.mobile === "1";
  const showAll = query.outcome === "all";

  const hasActiveFilters = Boolean(
    query.neighborhood || query.outcome || query.mobile || query.zip,
  );

  return (
    <div className="mt-4 rounded-[18px] border border-ink/10 bg-cream/80 p-3 sm:p-4">
      {/* Seventeen areas open on the bar pushed the queue off a phone screen; closed on every load
          the group costs one row and still names what is selected. The blocks of a big area run to
          eleven and cost as much again, so they fold the same way. */}
      <Collapsible label="Area" value={query.neighborhood || "All"}>
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
      </Collapsible>

      {walking && !onMobile && zips.length > 0 && (
        <div className="mt-2">
          <Collapsible label="Block" value={query.zip ? query.zip.padStart(5, "0") : "Whole area"}>
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
          </Collapsible>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-ink/10 pt-3">
        {/* Both sides are stated outright rather than toggled to empty: a van has no door, so the
            two sets never overlap and "neither" is not a view of anything. */}
        <Group label="Doors">
          <Chip href={buildQuery(query, { mobile: "", ...FIRST_PAGE })} active={!onMobile}>
            salons
          </Chip>
          <Chip
            // A block is a walking unit, and the vans are dialled from anywhere.
            href={buildQuery(query, { mobile: "1", zip: "", ...FIRST_PAGE })}
            active={onMobile}
          >
            mobile
          </Chip>
        </Group>

        <Group label="Show">
          <Chip href={buildQuery(query, { outcome: "", ...FIRST_PAGE })} active={!showAll}>
            {walking ? "to visit" : "to call"}
          </Chip>
          <Chip href={buildQuery(query, { outcome: "all", ...FIRST_PAGE })} active={showAll}>
            everything
          </Chip>
        </Group>
      </div>

      {hasActiveFilters && (
        <div className="mt-2 flex justify-end border-t border-ink/10 pt-2">
          <a
            href={`/sales${buildQuery(query, {
              neighborhood: "",
              outcome: "",
              mobile: "",
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
