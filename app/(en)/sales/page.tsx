import { env } from "cloudflare:workers";
import { LogoMark } from "@/components/Logo";
import { FilterBar, type SalesQuery, buildQuery } from "@/components/sales/FilterBar";
import { LeadCard } from "@/components/sales/LeadCard";
import { LeadTable } from "@/components/sales/LeadTable";
import { Pager } from "@/components/sales/Pager";
import { type DemoPoolEnv, poolStatus, sweepDemoPool } from "@/lib/sales/demoPool";
import { type EsStrength, type Tier, routeHref } from "@/lib/sales/derive";
import { type Channel, channelForArea } from "@/lib/sales/leadFilters";
import {
  LEADS_PAGE_SIZE,
  type LeadFilters,
  type LeadPage,
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
  zipsIn,
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
    mobilePage: raw.mobilePage ?? "",
    route: raw.route === "1" || raw.route === "0" ? raw.route : "",
    zip: raw.zip && /^\d{1,5}$/.test(raw.zip) ? raw.zip : "",
  };
}

// An area the team works on foot opens on its route without anyone setting a filter; `route` is
// what a rep uses to override that in either direction.
function channelFor(query: SalesQuery): Channel {
  if (query.route === "1") return "walk";
  if (query.route === "0") return "call";
  return query.neighborhood ? channelForArea(query.neighborhood) : "call";
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

  const channel = channelFor(query);
  const filters: LeadFilters = {
    neighborhood: query.neighborhood || undefined,
    tiers: query.tier === "AB" ? AB_TIERS : query.tier ? [query.tier as Tier] : ALL_TIERS,
    outcome: outcomeFilter(query.outcome ?? ""),
    openOnly: query.open === "1",
    es: (query.es || undefined) as EsStrength | undefined,
    channel,
    zip: channel === "walk" && query.zip ? Number(query.zip) : undefined,
  };

  // This Worker has no cron triggers, so the panel the reps keep open is the tick that expires
  // demos and notices that an owner called back. Same trade the referral settlement makes.
  await sweepDemoPool(cfEnv);

  const showLow = query.mode !== "focus" && query.low === "1";
  const lowFilters: LeadFilters = { ...filters, tiers: ["X"] };

  // The route excludes vans, which are the highest-scoring leads we have — so on a route they get
  // their own list instead of vanishing. Dialled, never walked: `channel: "call"` also puts them
  // back in score order, the block-first ordering being meaningless without a door.
  const mobileFilters: LeadFilters = {
    ...filters,
    channel: "call",
    zip: undefined,
    mobile: true,
  };

  const now = new Date();
  // A row picked out of the list view names its lead; the focus button just takes the top of the queue.
  const namedFocus = query.mode === "focus" ? query.lead || null : null;
  // Focus mode renders one lead instead of the list, and "Start calling" takes the first of them —
  // page 1 is the top of the whole queue, whichever page the rep was on when they tapped it.
  const queuePage = query.mode === "focus" && !namedFocus ? 1 : parsePageParam(query.page);

  // Resolved ahead of the rest, because a card render reads none of the list, the areas or the
  // low-priority count — and `leads` is replaced wholesale by each scraper run, so a bookmarked
  // `lead=` id can be gone, and then all of it is needed after all.
  const namedLead = namedFocus ? await getSalesLead(db, namedFocus, now) : null;
  const cardOnly = namedLead !== null;

  const [
    listedQueue,
    queueCount,
    lowQueue,
    lowCount,
    mobileQueue,
    openNowCount,
    routeCount,
    areas,
    blocks,
    stats,
    pool,
  ] = await Promise.all([
    cardOnly ? null : listLeads(db, filters, now, queuePage),
    cardOnly ? countLeads(db, filters, now) : null,
    showLow ? listLeads(db, lowFilters, now, parsePageParam(query.lowPage)) : null,
    showLow || cardOnly ? null : countLeads(db, lowFilters, now),
    !cardOnly && channel === "walk"
      ? listLeads(db, mobileFilters, now, parsePageParam(query.mobilePage))
      : null,
    // Both halves of "36 of 57 open now", counted whichever way the filter is set — the rep is
    // deciding whether to turn it on, so the number it would leave them with has to be visible
    // before they do.
    !cardOnly && channel === "walk" ? countLeads(db, { ...filters, openOnly: true }, now) : null,
    !cardOnly && channel === "walk" ? countLeads(db, { ...filters, openOnly: false }, now) : null,
    cardOnly ? null : neighborhoods(db),
    !cardOnly && channel === "walk" && filters.neighborhood
      ? zipsIn(db, filters.neighborhood)
      : null,
    counters(db, now, {
      neighborhood: filters.neighborhood,
      tiers: filters.tiers,
      channel,
    }),
    poolStatus(db),
  ]);

  // The card's header wants a total and nothing else; the rest of the shape is never rendered.
  const queue: LeadPage = listedQueue ?? {
    leads: [],
    page: 1,
    pageSize: LEADS_PAGE_SIZE,
    total: queueCount ?? 0,
    totalPages: 1,
  };
  const leads = queue.leads;
  const queueTotal = queue.total;
  const lowPriority = lowQueue?.leads ?? [];
  const lowTotal = lowQueue?.total ?? lowCount ?? 0;
  const mobileLeads = mobileQueue?.leads ?? [];
  const mobileTotal = mobileQueue?.total ?? 0;

  const back = buildQuery(query, {});
  const focusLead: SalesLead | undefined =
    query.mode === "focus" ? ((namedFocus ? namedLead : leads[0]) ?? undefined) : undefined;
  const history = focusLead ? await leadHistory(db, focusLead.id) : undefined;
  const notice = raw.saved ? NOTICE[raw.saved] : undefined;

  // The count and the page rows come from two separate D1 statements, so a page can come back empty
  // while the queue is not (a concurrent write, or a read replica behind the count). Hiding the
  // pager there leaves the rep on an empty page with no control to get back.
  const walking = channel === "walk";
  // Built from the page the rep is looking at, in its order, so the walk Google hands back is the
  // one the route already planned. A rep on foot navigates by phone anyway.
  const walkRoute = walking
    ? routeHref(leads.map((lead) => lead.address ?? "").filter(Boolean))
    : null;
  const showQueuePager = queue.totalPages > 1 || leads.length > 0;
  const showLowPager = Boolean(lowQueue && (lowQueue.totalPages > 1 || lowPriority.length > 0));
  const showMobilePager = Boolean(mobileQueue && mobileQueue.totalPages > 1);

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
            <Counter label={walking ? "to visit" : "to call"} value={stats.queue} />
            <Counter label={walking ? "visited today" : "called today"} value={stats.calledToday} />
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
              <LeadCard lead={focusLead} back={back} focus channel={channel} history={history} />
            </div>
          </section>
        ) : (
          <>
            <FilterBar
              query={query}
              neighborhoods={areas ?? []}
              channel={channel}
              zips={blocks ?? []}
            />

            <section id="call-queue" className="mt-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h1 className="font-display text-[24px] tracking-tight">
                  {walking ? "Walk-in route" : "Call queue"}{" "}
                  <span className="text-[16px] text-muted">({queueTotal})</span>
                  {walking && routeCount !== null && openNowCount !== null && (
                    <span className="ml-2 text-[16px] font-normal text-muted-2">
                      {openNowCount} of {routeCount} open now
                    </span>
                  )}
                </h1>
                <div className="flex flex-wrap items-center gap-2">
                  {walkRoute && (
                    <a
                      href={walkRoute}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-[10px] border border-ink/15 bg-white px-4 py-2 text-sm font-medium text-ink no-underline hover:border-teal/40"
                    >
                      Navigate this page
                    </a>
                  )}
                  {leads.length > 0 && (
                    <a
                      href={`/sales${buildQuery(query, { mode: "focus" })}`}
                      className="rounded-[10px] bg-teal px-4 py-2 text-sm font-medium text-white no-underline"
                    >
                      {walking ? "Start walking" : "Start calling"}
                    </a>
                  )}
                </div>
              </div>
              {showQueuePager && (
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
                  {queue.totalPages > 1
                    ? "This page came back empty — the queue moved while you were on it. Step back with Prev."
                    : walking && filters.openOnly
                      ? "Nothing on this block is open right now — turn off “open now” to plan ahead, or pick another block."
                      : "Nothing matches these filters — widen the area or the state."}
                </p>
              ) : query.view === "list" ? (
                <div className="mt-4">
                  <LeadTable leads={leads} query={query} channel={channel} />
                </div>
              ) : (
                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  {leads.map((lead) => (
                    <LeadCard key={lead.id} lead={lead} back={back} channel={channel} />
                  ))}
                </div>
              )}
              {showQueuePager && (
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

            {walking && mobileTotal > 0 && (
              <section id="mobile-groomers" className="mt-10">
                <h2 className="font-display text-[24px] tracking-tight">
                  Call from the road <span className="text-[16px] text-muted">({mobileTotal})</span>
                </h2>
                <p className="mt-1 text-sm text-muted">
                  Mobile groomers in this area — no door to walk into, so phone them instead.
                </p>
                {showMobilePager && mobileQueue && (
                  <Pager
                    list="mobile"
                    placement="top"
                    query={query}
                    page={mobileQueue.page}
                    totalPages={mobileQueue.totalPages}
                    total={mobileTotal}
                  />
                )}
                {query.view === "list" ? (
                  <div className="mt-4">
                    <LeadTable leads={mobileLeads} query={query} channel="call" />
                  </div>
                ) : (
                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    {mobileLeads.map((lead) => (
                      <LeadCard key={lead.id} lead={lead} back={back} channel="call" />
                    ))}
                  </div>
                )}
                {showMobilePager && mobileQueue && (
                  <Pager
                    list="mobile"
                    placement="bottom"
                    query={query}
                    page={mobileQueue.page}
                    totalPages={mobileQueue.totalPages}
                    total={mobileTotal}
                  />
                )}
              </section>
            )}

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
                {lowQueue && showLowPager && (
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
                      <LeadTable leads={lowPriority} query={query} channel={channel} />
                    </div>
                  ) : (
                    <div className="mt-4 grid gap-4 lg:grid-cols-2">
                      {lowPriority.map((lead) => (
                        <LeadCard key={lead.id} lead={lead} back={back} channel={channel} />
                      ))}
                    </div>
                  ))}
                {lowQueue && showLowPager && (
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
