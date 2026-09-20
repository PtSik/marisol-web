import { env } from "cloudflare:workers";
import { LogoMark } from "@/components/Logo";
import { FilterBar, buildQuery } from "@/components/sales/FilterBar";
import { LeadCard } from "@/components/sales/LeadCard";
import { LoginForm } from "@/components/sales/LoginForm";
import { Pager } from "@/components/sales/Pager";
import { routeHref } from "@/lib/sales/derive";
import {
  type LeadFilters,
  countLeads,
  counters,
  listLeads,
  neighborhoods,
  parsePageParam,
  zipsIn,
} from "@/lib/sales/leads";
import { channelFor, filtersFor, parseQuery } from "@/lib/sales/query";
import { SALES_COOKIE, SALES_REP_COOKIE, isSalesCookieValid, normaliseRep } from "@/lib/salesAuth";
import { cookies } from "next/headers";
import type { ReactNode } from "react";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Call queue — Marisol sales",
  robots: { index: false, follow: false },
};

interface SalesEnv {
  OUTREACH_DB?: D1Database;
  SALES_DASH_KEY?: string;
}

const NOTICE: Record<string, string> = {
  saved: "Result saved.",
  "research-saved": "Doc saved.",
  failed: "Nothing was saved — try again.",
};

function Counter({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="whitespace-nowrap">
      <div className="font-display text-[19px] leading-none tracking-tight sm:text-[24px]">
        {value}
      </div>
      <div className="mt-0.5 text-[11px] uppercase tracking-wide text-muted-2 sm:text-xs">
        {label}
      </div>
    </div>
  );
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
  const filters = filtersFor(query, channel);

  const showLow = query.low === "1";
  const lowFilters: LeadFilters = { ...filters, tiers: ["X"] };

  const now = new Date();

  const [queue, lowQueue, lowCount, openNowCount, areas, blocks, stats] = await Promise.all([
    listLeads(db, filters, now, parsePageParam(query.page)),
    showLow ? listLeads(db, lowFilters, now, parsePageParam(query.lowPage)) : null,
    showLow ? null : countLeads(db, lowFilters, now),
    // The other half of "36 of 57 open now". A rep on foot plans the next hour around it.
    channel === "walk" ? countLeads(db, { ...filters, openOnly: true }, now) : null,
    neighborhoods(db),
    channel === "walk" && filters.neighborhood ? zipsIn(db, filters.neighborhood) : null,
    counters(db, now, {
      neighborhood: filters.neighborhood,
      tiers: filters.tiers,
      channel,
      mobile: filters.mobile,
    }),
  ]);

  const leads = queue.leads;
  const queueTotal = queue.total;
  const lowPriority = lowQueue?.leads ?? [];
  const lowTotal = lowQueue?.total ?? lowCount ?? 0;

  const back = buildQuery(query, {});
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

  return (
    <>
      <nav className="mx-auto max-w-shell px-[22px] pt-[14px]">
        <div className="flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-[18px] border border-ink/10 bg-cream/80 px-4 py-3 sm:px-5">
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
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 sm:gap-x-6">
            <Counter label={walking ? "to visit" : "to call"} value={stats.queue} />
            <Counter label={walking ? "visited today" : "called today"} value={stats.calledToday} />
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
              {walking && openNowCount !== null && (
                <span className="ml-2 text-[16px] font-normal text-muted-2">
                  {openNowCount} of {queueTotal} open now
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
              {leads[0] && (
                <a
                  href={`/sales/${leads[0].slug}${back}`}
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
                : "Nothing left here — pick another area or block, or switch to everything."}
            </p>
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
            {showLow && (
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                {lowPriority.map((lead) => (
                  <LeadCard key={lead.id} lead={lead} back={back} channel={channel} />
                ))}
              </div>
            )}
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
      </main>
    </>
  );
}
