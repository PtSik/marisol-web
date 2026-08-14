import { env } from "cloudflare:workers";
import { LogoMark } from "@/components/Logo";
import { FilterBar, type SalesQuery, buildQuery } from "@/components/sales/FilterBar";
import { LeadCard } from "@/components/sales/LeadCard";
import { LeadTable } from "@/components/sales/LeadTable";
import { Pager } from "@/components/sales/Pager";
import { type DemoPoolEnv, poolStatus, sweepDemoPool } from "@/lib/sales/demoPool";
import type { EsStrength, Tier } from "@/lib/sales/derive";
import {
  type LeadFilters,
  type Outcome,
  type SalesLead,
  countLeads,
  counters,
  getLead as getSalesLead,
  isOutcome,
  leadHistory,
  listLeads,
  neighborhoods,
  parsePageParam,
} from "@/lib/sales/leads";
import { SALES_COOKIE, SALES_REP_COOKIE, isSalesCookieValid, normaliseRep } from "@/lib/salesAuth";
import { cookies } from "next/headers";
import type { ReactNode } from "react";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Call queue — Marisol sales",
  robots: { index: false, follow: false },
};

interface SalesEnv extends DemoPoolEnv {
  SALES_DASH_KEY?: string;
}

// The queue opens on everything worth calling; tier X stays in its own collapsed group.
const ALL_TIERS: Tier[] = ["A", "B", "C"];
const AB_TIERS: Tier[] = ["A", "B"];

const NOTICE: Record<string, string> = {
  saved: "Result saved.",
  "demo-en": "Demo is live — text them the number below.",
  "demo-es": "Demo en español listo — envíales el número de abajo.",
  "demo-cancelled": "Demo cancelled, number back in the pool.",
  "pool-full": "Every demo number is in use — cancel a dead one, or wait for the next to free up.",
  "demo-failed": "Couldn't set up the demo — nothing was leased, try again.",
  failed: "Nothing was saved — try again.",
};

function LoginForm({ error }: { error: boolean }) {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-shell items-center justify-center px-[22px]">
      <form
        method="post"
        action="/api/sales/login"
        className="w-full max-w-[360px] rounded-[18px] border border-ink/10 bg-cream/80 p-7"
      >
        <div className="flex items-center gap-[7px] font-display text-[22px] tracking-tight">
          <LogoMark className="h-5 w-5 rounded-[3.5px]" />
          Marisol sales
        </div>
        <label htmlFor="sales-rep" className="mt-5 block text-sm text-muted">
          Your name
        </label>
        <input
          id="sales-rep"
          name="rep"
          type="text"
          required
          maxLength={24}
          autoComplete="nickname"
          placeholder="goes on the calls you log"
          className="mt-1.5 w-full rounded-[10px] border border-ink/15 bg-white px-3 py-2.5 text-base"
        />
        <label htmlFor="sales-key" className="mt-4 block text-sm text-muted">
          Team key
        </label>
        <input
          id="sales-key"
          name="key"
          type="password"
          required
          className="mt-1.5 w-full rounded-[10px] border border-ink/15 bg-white px-3 py-2.5 text-base"
        />
        {error && <p className="mt-2 text-sm text-[#B3261E]">Wrong key or name. Try again.</p>}
        <button
          type="submit"
          className="mt-4 w-full rounded-[10px] bg-teal px-4 py-2.5 font-medium text-white"
        >
          Start calling
        </button>
      </form>
    </main>
  );
}

function Counter({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="whitespace-nowrap">
      <div className="font-display text-[24px] leading-none tracking-tight">{value}</div>
      <div className="mt-0.5 text-xs uppercase tracking-wide text-muted-2">{label}</div>
    </div>
  );
}

function parseQuery(raw: Record<string, string | undefined>): SalesQuery {
  const tier =
    raw.tier === "A" || raw.tier === "B" || raw.tier === "C" || raw.tier === "AB" ? raw.tier : "";
  return {
    neighborhood: raw.neighborhood ?? "",
    tier,
    outcome: raw.outcome ?? "",
    open: raw.open === "1" ? "1" : "",
    es: raw.es === "strong" || raw.es === "weak" ? raw.es : "",
    mode: raw.mode === "focus" ? "focus" : "",
    view: raw.view === "list" ? "list" : "",
    lead: raw.lead ?? "",
    low: raw.low === "1" ? "1" : "",
    page: raw.page ?? "",
    lowPage: raw.lowPage ?? "",
  };
}

function outcomeFilter(value: string): Outcome | "queue" | undefined {
  if (value === "all") return undefined;
  if (isOutcome(value)) return value;
  return "queue";
}

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const cfEnv = env as unknown as SalesEnv;
  const raw = await searchParams;
  const jar = await cookies();
  const authed = await isSalesCookieValid(jar.get(SALES_COOKIE)?.value, cfEnv.SALES_DASH_KEY);
  // `?switch=1` re-shows the sign-in form so a shared laptop can change hands without clearing
  // cookies — logged calls would otherwise carry the previous rep's name.
  if (!authed || raw.switch === "1") return <LoginForm error={Boolean(raw.error)} />;

  if (!cfEnv.OUTREACH_DB) {
    return (
      <main className="mx-auto max-w-shell px-[22px] py-16">
        <p className="rounded-[12px] border border-[#B97E24]/30 bg-[#B97E24]/10 px-4 py-2.5 text-sm text-[#8A5D17]">
          The outreach database is not bound to this worker yet — no leads to show.
        </p>
      </main>
    );
  }

  const query = parseQuery(raw);
  const db = cfEnv.OUTREACH_DB;
  const repCookie = jar.get(SALES_REP_COOKIE)?.value;
  const rep = normaliseRep(repCookie && decodeURIComponent(repCookie)) ?? "";

  const filters = {
    neighborhood: query.neighborhood || undefined,
    tiers: query.tier === "AB" ? AB_TIERS : query.tier ? [query.tier as Tier] : ALL_TIERS,
    outcome: outcomeFilter(query.outcome ?? ""),
    openOnly: query.open === "1",
    es: (query.es || undefined) as EsStrength | undefined,
  };

  // This Worker has no cron triggers, so the panel the reps keep open is the tick that expires
  // demos and notices that an owner called back. Same trade the referral settlement makes.
  await sweepDemoPool(cfEnv);

  const showLow = query.mode !== "focus" && query.low === "1";
  const lowFilters: LeadFilters = { ...filters, tiers: ["X"] };

  const now = new Date();
  // Focus mode renders one lead instead of the list, and "Start calling" takes the first of them —
  // page 1 is the top of the whole queue, whichever page the rep was on when they tapped it.
  const queuePage = query.mode === "focus" && !query.lead ? 1 : parsePageParam(query.page);

  const [queue, lowQueue, lowCount, areas, stats, pool] = await Promise.all([
    listLeads(db, filters, now, queuePage),
    showLow ? listLeads(db, lowFilters, now, parsePageParam(query.lowPage)) : null,
    showLow ? null : countLeads(db, lowFilters, now),
    neighborhoods(db),
    counters(db, now, { neighborhood: filters.neighborhood, tiers: filters.tiers }),
    poolStatus(db),
  ]);
  const leads = queue.leads;
  const queueTotal = queue.total;
  const lowPriority = lowQueue?.leads ?? [];
  const lowTotal = lowQueue?.total ?? lowCount ?? 0;

  const back = buildQuery(query, {});
  // A row picked out of the list view names its lead; the focus button just takes the top of the queue.
  const focusLead: SalesLead | undefined =
    query.mode === "focus"
      ? ((query.lead ? await getSalesLead(db, query.lead) : leads[0]) ?? undefined)
      : undefined;
  const history = focusLead ? await leadHistory(db, focusLead.id) : undefined;
  const notice = raw.saved ? NOTICE[raw.saved] : undefined;

  return (
    <>
      <nav className="mx-auto max-w-shell px-[22px] pt-[14px]">
        <div className="flex w-full flex-wrap items-center justify-between gap-4 rounded-[18px] border border-ink/10 bg-cream/80 px-5 py-3">
          <a
            href="/sales"
            className="flex items-center gap-[7px] font-display text-[22px] tracking-tight no-underline"
          >
            <LogoMark className="h-5 w-5 rounded-[3.5px]" />
            Marisol <span className="text-[15px] text-muted">sales</span>
          </a>
          {/* flex-wrap: 5 two-word stats plus gap-6 don't fit one row on a phone, and without wrap
              the browser squeezes each Counter until its label breaks mid-word ("TO" / "CALL")
              instead of dropping whole counters to a second line. */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <Counter label="to call" value={stats.queue} />
            <Counter label="called today" value={stats.calledToday} />
            <Counter label="demos queued" value={stats.demoRequested} />
            <Counter label="demos heard" value={stats.demosHeard} />
            <Counter label="numbers free" value={`${pool.free}/${pool.free + pool.busy}`} />
          </div>
          {rep && (
            <a href="/sales?switch=1" className="text-sm text-muted no-underline">
              {rep} <span className="text-muted-3">· not you?</span>
            </a>
          )}
        </div>
      </nav>

      <main className="mx-auto max-w-shell px-[22px] pb-20 pt-4">
        {notice && (
          <p
            className={`rounded-[12px] border px-4 py-2.5 text-sm ${
              raw.saved === "failed"
                ? "border-[#B97E24]/30 bg-[#B97E24]/10 text-[#8A5D17]"
                : "border-teal/30 bg-teal/10 text-teal"
            }`}
          >
            {notice}
          </p>
        )}

        {focusLead ? (
          <section className="mt-4">
            <div className="flex items-center justify-between gap-4">
              <h1 className="font-display text-[24px] tracking-tight">
                Next up <span className="text-[16px] text-muted">({queueTotal} left)</span>
              </h1>
              <a
                href={`/sales${buildQuery(query, { mode: "", lead: "" })}`}
                className="text-sm text-teal no-underline"
              >
                Back to the list
              </a>
            </div>
            <div className="mt-4">
              <LeadCard lead={focusLead} back={back} focus history={history} />
            </div>
          </section>
        ) : (
          <>
            <FilterBar query={query} neighborhoods={areas} />

            <section id="call-queue" className="mt-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h1 className="font-display text-[24px] tracking-tight">
                  Call queue <span className="text-[16px] text-muted">({queueTotal})</span>
                </h1>
                {leads.length > 0 && (
                  <a
                    href={`/sales${buildQuery(query, { mode: "focus" })}`}
                    className="rounded-[10px] bg-teal px-4 py-2 text-sm font-medium text-white no-underline"
                  >
                    Start calling
                  </a>
                )}
              </div>
              {leads.length > 0 && (
                <Pager
                  list="queue"
                  placement="top"
                  query={query}
                  page={queue.page}
                  totalPages={queue.totalPages}
                  total={queueTotal}
                />
              )}
              {leads.length === 0 ? (
                <p className="mt-4 text-muted">
                  Nothing matches these filters — widen the area or the state.
                </p>
              ) : query.view === "list" ? (
                <div className="mt-4">
                  <LeadTable leads={leads} query={query} />
                </div>
              ) : (
                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  {leads.map((lead) => (
                    <LeadCard key={lead.id} lead={lead} back={back} />
                  ))}
                </div>
              )}
              {leads.length > 0 && (
                <Pager
                  list="queue"
                  placement="bottom"
                  query={query}
                  page={queue.page}
                  totalPages={queue.totalPages}
                  total={queueTotal}
                />
              )}
            </section>

            {lowTotal > 0 && (
              <section id="low-priority" className="mt-10">
                <h2 className="font-display text-[24px] tracking-tight">
                  {showLow ? (
                    <>
                      Low priority <span className="text-[16px] text-muted">({lowTotal})</span>{" "}
                      <a
                        href={`/sales${buildQuery(query, { low: "" })}#low-priority`}
                        className="text-[16px] text-teal no-underline"
                      >
                        hide
                      </a>
                    </>
                  ) : (
                    <a
                      href={`/sales${buildQuery(query, { low: "1" })}#low-priority`}
                      className="text-ink no-underline"
                    >
                      Low priority <span className="text-[16px] text-muted">({lowTotal})</span>
                    </a>
                  )}
                </h2>
                <p className="mt-1 text-sm text-muted">
                  Chains and shops over 800 reviews — someone already answers their phone.
                </p>
                {lowQueue && lowPriority.length > 0 && (
                  <Pager
                    list="low"
                    placement="top"
                    query={query}
                    page={lowQueue.page}
                    totalPages={lowQueue.totalPages}
                    total={lowTotal}
                  />
                )}
                {showLow &&
                  (query.view === "list" ? (
                    <div className="mt-4">
                      <LeadTable leads={lowPriority} query={query} />
                    </div>
                  ) : (
                    <div className="mt-4 grid gap-4 lg:grid-cols-2">
                      {lowPriority.map((lead) => (
                        <LeadCard key={lead.id} lead={lead} back={back} />
                      ))}
                    </div>
                  ))}
                {lowQueue && lowPriority.length > 0 && (
                  <Pager
                    list="low"
                    placement="bottom"
                    query={query}
                    page={lowQueue.page}
                    totalPages={lowQueue.totalPages}
                    total={lowTotal}
                  />
                )}
              </section>
            )}
          </>
        )}
      </main>
    </>
  );
}
