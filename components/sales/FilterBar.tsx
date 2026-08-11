import { OUTCOME_LABELS, type Outcome } from "@/lib/sales/leads";

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
}

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
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-2">{label}</span>
      {children}
    </div>
  );
}

export interface FilterBarProps {
  query: SalesQuery;
  neighborhoods: string[];
}

export function FilterBar({ query, neighborhoods }: FilterBarProps) {
  const toggle = (key: keyof SalesQuery, value: string): SalesQuery => ({
    [key]: query[key] === value ? "" : value,
  });

  return (
    <div className="mt-4 space-y-2 rounded-[18px] border border-ink/10 bg-cream/80 p-4">
      <Group label="Area">
        <Chip href={buildQuery(query, { neighborhood: "" })} active={!query.neighborhood}>
          all
        </Chip>
        {neighborhoods.map((n) => (
          <Chip
            key={n}
            href={buildQuery(query, toggle("neighborhood", n))}
            active={query.neighborhood === n}
          >
            {n}
          </Chip>
        ))}
      </Group>

      <Group label="Tier">
        {/* Default. Tier X keeps its own collapsed group, so nothing is listed twice. */}
        <Chip href={buildQuery(query, { tier: "" })} active={!query.tier}>
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
        <Chip href={buildQuery(query, { outcome: "" })} active={!query.outcome}>
          to call
        </Chip>
        {(["no_answer", "interested", "demo_sent", "callback"] as Outcome[]).map((o) => (
          <Chip key={o} href={buildQuery(query, toggle("outcome", o))} active={query.outcome === o}>
            {OUTCOME_LABELS[o]}
          </Chip>
        ))}
        <Chip href={buildQuery(query, { outcome: "all" })} active={query.outcome === "all"}>
          everything
        </Chip>
      </Group>

      <Group label="Filters">
        <Chip href={buildQuery(query, toggle("open", "1"))} active={query.open === "1"}>
          open now
        </Chip>
        <Chip href={buildQuery(query, toggle("es", "strong"))} active={query.es === "strong"}>
          Spanish signal
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
  );
}
