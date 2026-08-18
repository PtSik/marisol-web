import { env } from "cloudflare:workers";
import { LogoMark } from "@/components/Logo";
import { buildQuery } from "@/components/sales/FilterBar";
import { LeadCard } from "@/components/sales/LeadCard";
import { LoginForm } from "@/components/sales/LoginForm";
import { ResearchDoc } from "@/components/sales/ResearchDoc";
import { type DemoPoolEnv, sweepDemoPool } from "@/lib/sales/demoPool";
import {
  type LeadNeighbours,
  getLeadBySlug,
  leadHistory,
  leadName,
  neighbours,
} from "@/lib/sales/leads";
import { channelFor, filtersFor, parseQuery } from "@/lib/sales/query";
import { SALES_COOKIE, SALES_REP_COOKIE, isSalesCookieValid, normaliseRep } from "@/lib/salesAuth";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const db = (env as unknown as SalesEnv).OUTREACH_DB;
  const name = db ? await leadName(db, slug) : null;
  return {
    title: `${name ?? slug.replace(/-/g, " ")} — Marisol sales`,
    robots: { index: false, follow: false },
  };
}

interface SalesEnv extends DemoPoolEnv {
  SALES_DASH_KEY?: string;
}

const NOTICE: Record<string, string> = {
  saved: "Result saved.",
  "demo-en": "Demo is live — text them the number below.",
  "demo-es": "Demo en español listo — envíales el número de abajo.",
  "demo-cancelled": "Demo cancelled, number back in the pool.",
  "research-saved": "Doc saved.",
  "pool-full": "Every demo number is in use — cancel a dead one, or wait for the next to free up.",
  "demo-failed": "Couldn't set up the demo — nothing was leased, try again.",
  failed: "Nothing was saved — try again.",
};

function Shell({ back, rep, children }: { back: string; rep: string; children: React.ReactNode }) {
  return (
    <>
      <nav className="mx-auto max-w-shell px-[22px] pt-[14px]">
        <div className="flex w-full items-center justify-between gap-3 rounded-[18px] border border-ink/10 bg-cream/80 px-4 py-3">
          <a href={`/sales${back}`} className="min-w-0 truncate text-sm text-teal no-underline">
            ← Queue
          </a>
          <a
            href={`/sales${back}`}
            className="flex shrink-0 items-center gap-[7px] font-display text-[19px] tracking-tight no-underline"
          >
            <LogoMark className="h-5 w-5 rounded-[3.5px]" />
            Marisol
          </a>
          {rep && (
            <a
              href="/sales?switch=1"
              className="min-w-0 shrink truncate text-right text-sm text-muted no-underline"
            >
              {rep}
            </a>
          )}
        </div>
      </nav>
      <main className="mx-auto max-w-shell px-[22px] pb-20 pt-4">{children}</main>
    </>
  );
}

// Prev/Next is what keeps a rep on a block moving shop to shop, so it sits above and below the card
// — a written-up lead is long enough that the top pair scrolls away.
function Steps({ back, steps }: { back: string; steps: LeadNeighbours }) {
  if (steps.index === -1) return null;
  // Back and Next, not the shop names: a name here is read as "this is the lead" for a beat before
  // the arrow corrects it, and two of them cost the row its whole width on a phone.
  const link =
    "flex min-h-11 items-center gap-1.5 rounded-[10px] border border-ink/15 bg-white px-4 text-sm font-medium no-underline hover:border-teal/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal";
  const inert =
    "flex min-h-11 items-center gap-1.5 rounded-[10px] border border-ink/10 px-4 text-sm text-muted-3";
  return (
    <nav
      aria-label="Leads either side of this one"
      className="flex items-center justify-between gap-2"
    >
      {steps.prev ? (
        <a
          href={`/sales/${steps.prev.slug}${back}`}
          className={link}
          aria-label={`Back to ${steps.prev.shop_name}`}
        >
          <span aria-hidden="true">←</span> Back
        </a>
      ) : (
        <span aria-hidden="true" className={inert}>
          ← Back
        </span>
      )}
      <span className="whitespace-nowrap text-sm tabular-nums text-muted-2">
        {steps.index + 1} / {steps.total}
      </span>
      {steps.next ? (
        <a
          href={`/sales/${steps.next.slug}${back}`}
          className={link}
          aria-label={`Next: ${steps.next.shop_name}`}
        >
          Next <span aria-hidden="true">→</span>
        </a>
      ) : (
        <span aria-hidden="true" className={inert}>
          Next →
        </span>
      )}
    </nav>
  );
}

export default async function LeadPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const cfEnv = env as unknown as SalesEnv;
  const { slug } = await params;
  const raw = await searchParams;
  const jar = await cookies();
  const authed = await isSalesCookieValid(jar.get(SALES_COOKIE)?.value, cfEnv.SALES_DASH_KEY);
  const query = parseQuery(raw);
  const back = buildQuery(query, {});
  if (!authed || raw.switch === "1")
    return <LoginForm error={Boolean(raw.error)} next={`/sales/${slug}${back}`} />;

  const repCookie = jar.get(SALES_REP_COOKIE)?.value;
  const rep = normaliseRep(repCookie && decodeURIComponent(repCookie)) ?? "";

  if (!cfEnv.OUTREACH_DB) {
    return (
      <Shell back={back} rep={rep}>
        <p className="rounded-[12px] border border-[#B97E24]/30 bg-[#B97E24]/10 px-4 py-2.5 text-sm text-[#8A5D17]">
          The outreach database is not bound to this worker yet — no leads to show.
        </p>
      </Shell>
    );
  }

  const db = cfEnv.OUTREACH_DB;
  const now = new Date();
  const lead = await getLeadBySlug(db, slug, now);
  if (!lead) {
    // Not a 404: every scraper run replaces `leads` wholesale, so a link that worked yesterday can
    // point at a shop the latest sourcing pass dropped. The rep needs the way back, not an error.
    return (
      <Shell back={back} rep={rep}>
        <p className="rounded-[12px] border border-[#B97E24]/30 bg-[#B97E24]/10 px-4 py-2.5 text-sm text-[#8A5D17]">
          No lead at this link — the last import may have dropped it. Back to the queue above.
        </p>
      </Shell>
    );
  }

  // The panel a rep keeps open is this Worker's only tick, and on a route that panel is this page —
  // without the sweep here, demos generated on foot would never expire. `claimSweepLock` throttles it.
  await sweepDemoPool(cfEnv);

  const channel = channelFor(query);
  const [steps, history] = await Promise.all([
    neighbours(db, filtersFor(query, channel), lead.id, now),
    leadHistory(db, lead.id),
  ]);
  const notice = raw.saved ? NOTICE[raw.saved] : undefined;

  return (
    <Shell back={back} rep={rep}>
      {notice && (
        <p
          className={`mb-3 rounded-[12px] border px-4 py-2.5 text-sm ${
            raw.saved === "failed"
              ? "border-[#B97E24]/30 bg-[#B97E24]/10 text-[#8A5D17]"
              : "border-teal/30 bg-teal/10 text-teal"
          }`}
        >
          {notice}
        </p>
      )}

      <Steps back={back} steps={steps} />
      <div className="mt-4">
        <LeadCard lead={lead} back={back} focus detailsOpen channel={channel} history={history} />
      </div>
      <ResearchDoc lead={lead} back={back} />
      <div className="mt-4">
        <Steps back={back} steps={steps} />
      </div>
    </Shell>
  );
}
