import { env } from "cloudflare:workers";
import { LogoMark } from "@/components/Logo";
import {
  LEAD_COLUMNS,
  LeadColumnHeaders,
  LeadRow,
  type Shop,
  leadNeedsAction,
} from "@/components/admin/LeadRow";
import {
  CALL_COLUMNS,
  CallColumnHeaders,
  CallRow,
  REFERRAL_COLUMNS,
  ReferralColumnHeaders,
  ReferralRow,
  TEARDOWN_COLUMNS,
  TeardownColumnHeaders,
  TeardownRow,
} from "@/components/admin/rows";
import { Notice, Section, Stat, type Tone } from "@/components/admin/ui";
import { ADMIN_COOKIE, isAdminCookieValid } from "@/lib/adminAuth";
import { type CallLead, type CheckoutLead, listLeads } from "@/lib/leads";
import { type Referral, listReferrals } from "@/lib/referrals";
import { siteHref } from "@/lib/site";
import { listTeardowns } from "@/lib/teardownQueue";
import { voiceAgentFetch } from "@/lib/voiceAgent";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Clients — Marisol admin",
  robots: { index: false, follow: false },
};

interface AdminEnv {
  OUTREACH_DB?: D1Database;
  LEADS_KV?: KVNamespace;
  ADMIN_DASH_KEY?: string;
  VOICE_AGENT_API?: Fetcher;
  VOICE_AGENT_API_URL?: string;
  ADMIN_API_KEY?: string;
}

function LoginForm({ error }: { error: boolean }) {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-shell items-center justify-center px-[22px]">
      <form
        method="post"
        action="/api/admin/login"
        className="w-full max-w-[360px] rounded-[18px] border border-ink/10 bg-cream/80 p-7"
      >
        <div className="flex items-center gap-[7px] font-display text-[22px] tracking-tight">
          <LogoMark className="h-5 w-5 rounded-[3.5px]" />
          Marisol admin
        </div>
        <label htmlFor="admin-key" className="mt-5 block text-sm text-muted">
          Access key
        </label>
        <input
          id="admin-key"
          name="key"
          type="password"
          required
          // biome-ignore lint/a11y/noAutofocus: sole field on a dedicated login page
          autoFocus
          className="mt-1.5 w-full rounded-[10px] border border-ink/15 bg-white px-3 py-2.5 text-[15px]"
        />
        {error && <p className="mt-2 text-sm text-[#B3261E]">Wrong key. Try again.</p>}
        <button
          type="submit"
          className="mt-4 w-full rounded-[10px] bg-teal px-4 py-2.5 font-medium text-white"
        >
          Sign in
        </button>
      </form>
    </main>
  );
}

const CALENDAR_NOTICE: Record<string, string> = {
  sent: "Calendar invite sent.",
  "already-sent": "That client already got the calendar invite.",
  missing: "No shop for that lead — provision it first.",
  failed: "Couldn't build the connect link — check ADMIN_API_KEY and the voice-agent URL.",
  "send-failed": "Resend rejected the email — nothing was sent, try again.",
};

const PAYOUT_NOTICE: Record<string, string> = {
  paid: "Referral marked as paid out.",
  failed: "Couldn't mark that payout — it may already have been settled.",
};

const ACTIVATION_NOTICE: Record<string, string> = {
  activated: "Receptionist activated and the client welcome email was triggered.",
  "already-active": "That receptionist is already active.",
  "in-progress": "Activation already started. Reconcile external state before doing anything else.",
  failed: "Activation failed cleanly. Review the reason on the lead before retrying.",
  reconcile:
    "Activation may have left an external resource. Reconcile Twilio and shop state manually.",
  missing: "Lead not found.",
  cancelled: "A cancelled subscription cannot be activated.",
  "billing-inactive":
    "Activation stopped: Stripe does not show an active or trialing subscription.",
  "lock-unavailable":
    "Activation stopped before provisioning: apply the D1 activation-lock migration and retry.",
  "not-ready": "That lead has not submitted a reviewable setup.",
  "invalid-area-code": "Activation stopped: enter a valid three-digit US area code.",
};

function resultNotice(
  value: string | undefined,
  copy: Record<string, string>,
  successKey: string,
): { tone: Tone; text: string } | null {
  if (!value || !copy[value]) return null;
  return { tone: value === successKey ? "teal" : "amber", text: copy[value] };
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    calendar?: string;
    payout?: string;
    activation?: string;
  }>;
}) {
  const cfEnv = env as unknown as AdminEnv;
  const { error, calendar, payout, activation } = await searchParams;
  const jar = await cookies();
  const authed = await isAdminCookieValid(jar.get(ADMIN_COOKIE)?.value, cfEnv.ADMIN_DASH_KEY);
  if (!authed) return <LoginForm error={Boolean(error)} />;

  const teardownJobs = await listTeardowns(cfEnv.OUTREACH_DB).catch(() => null);
  const leads = await listLeads(cfEnv.LEADS_KV);
  const checkout = leads.filter((l): l is CheckoutLead => l.intent === "checkout");
  const callLeads = leads.filter((l): l is CallLead => l.intent === "call");

  let shops: Map<string, Shop> | undefined;
  const res = await voiceAgentFetch(cfEnv, "/admin/shops").catch(() => null);
  if (res?.ok) {
    const data = (await res.json().catch(() => null)) as { shops?: Shop[] } | null;
    if (data?.shops) shops = new Map(data.shops.map((s) => [s.id, s]));
  }

  const referrals = await listReferrals(cfEnv, {});
  const openReferrals = referrals.filter((r) => r.status !== "void" && r.status !== "paid_out");
  const payoutsDue = openReferrals.filter((r) => r.status === "payout_requested");

  const shopFor = (l: CheckoutLead) => (l.shopId ? shops?.get(l.shopId) : undefined);
  const active = checkout.filter((l) => l.status === "provisioned");
  const cancelled = checkout.filter((l) => l.status === "cancelled");
  const open = checkout.filter((l) => l.status !== "provisioned" && l.status !== "cancelled");
  const needsAction = open.filter(leadNeedsAction);
  const waiting = open.filter((l) => !leadNeedsAction(l));

  const notices = [
    resultNotice(calendar, CALENDAR_NOTICE, "sent"),
    resultNotice(payout, PAYOUT_NOTICE, "paid"),
    resultNotice(activation, ACTIVATION_NOTICE, "activated"),
  ].filter((n): n is { tone: Tone; text: string } => n !== null);

  const sortedReferrals = [...openReferrals].sort(
    (a, b) => Number(b.status === "payout_requested") - Number(a.status === "payout_requested"),
  );

  return (
    <>
      <nav className="sticky top-0 z-10 mx-auto max-w-shell px-[22px] pt-[14px]">
        <div className="flex w-full items-center justify-between gap-5 rounded-[18px] border border-ink/10 bg-cream/80 px-5 py-3 backdrop-blur-md">
          <a
            href={siteHref()}
            className="flex items-center gap-[7px] font-display text-[22px] tracking-tight no-underline"
          >
            <LogoMark className="h-5 w-5 rounded-[3.5px]" />
            Marisol <span className="text-[15px] text-muted">admin</span>
          </a>
          <span className="text-sm tabular-nums text-muted">
            {checkout.length} leads · {active.length} active
          </span>
        </div>
      </nav>

      <main className="mx-auto max-w-shell px-[22px] pb-20 pt-[clamp(20px,3vw,32px)]">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Stat
            label="Needs action"
            value={needsAction.length}
            tone={needsAction.length ? "amber" : "muted"}
          />
          <Stat label="Active clients" value={active.length} tone="teal" />
          <Stat label="Waiting on client" value={waiting.length} />
          <Stat
            label="Payouts due"
            value={payoutsDue.length}
            tone={payoutsDue.length ? "amber" : "muted"}
          />
          <Stat label="Call requests" value={callLeads.length} />
        </div>

        {(notices.length > 0 || !shops || teardownJobs === null) && (
          <div className="mt-4 space-y-2">
            {!shops && (
              <Notice tone="amber">
                Couldn't reach the voice-agent admin API — shop status, calendar and reminders are
                hidden.
              </Notice>
            )}
            {teardownJobs === null && (
              <Notice tone="red" alert>
                Teardown queue unavailable. Check the D1 migration and binding.
              </Notice>
            )}
            {notices.map((n) => (
              <Notice key={n.text} tone={n.tone}>
                {n.text}
              </Notice>
            ))}
          </div>
        )}

        {leads.length === 0 && <p className="mt-10 text-muted">No leads yet.</p>}

        {teardownJobs && (
          <Section
            title="Teardown incomplete"
            count={teardownJobs.length}
            hint="cleanup jobs that did not finish"
            columns={TEARDOWN_COLUMNS}
            headers={<TeardownColumnHeaders />}
          >
            {teardownJobs.map((job) => (
              <TeardownRow key={job.id} job={job} />
            ))}
          </Section>
        )}

        <Section
          title="Needs action"
          count={needsAction.length}
          hint="waiting on you"
          columns={LEAD_COLUMNS}
          headers={<LeadColumnHeaders />}
        >
          {needsAction.map((l) => (
            <LeadRow key={l.id} lead={l} shop={shopFor(l)} defaultOpen={needsAction.length <= 3} />
          ))}
        </Section>

        <Section
          title="Payouts due"
          count={payoutsDue.length}
          hint="send the cash, then mark paid"
          columns={REFERRAL_COLUMNS}
          headers={<ReferralColumnHeaders />}
        >
          {payoutsDue.map((r) => (
            <ReferralRow key={r.id} referral={r} />
          ))}
        </Section>

        <Section
          title="Active clients"
          count={active.length}
          columns={LEAD_COLUMNS}
          headers={<LeadColumnHeaders />}
        >
          {active.map((l) => (
            <LeadRow key={l.id} lead={l} shop={shopFor(l)} />
          ))}
        </Section>

        <Section
          title="Waiting on client"
          count={waiting.length}
          hint="no setup submitted yet"
          columns={LEAD_COLUMNS}
          headers={<LeadColumnHeaders />}
        >
          {waiting.map((l) => (
            <LeadRow key={l.id} lead={l} shop={shopFor(l)} />
          ))}
        </Section>

        <Section
          title="Referrals"
          count={sortedReferrals.length}
          columns={REFERRAL_COLUMNS}
          headers={<ReferralColumnHeaders />}
        >
          {sortedReferrals.map((r) => (
            <ReferralRow key={r.id} referral={r} />
          ))}
        </Section>

        <Section
          title="Call requests"
          count={callLeads.length}
          columns={CALL_COLUMNS}
          headers={<CallColumnHeaders />}
        >
          {callLeads.map((l) => (
            <CallRow key={l.id} lead={l} />
          ))}
        </Section>

        {cancelled.length > 0 && (
          <details className="mt-9">
            <summary className="flex cursor-pointer items-baseline gap-3">
              <span className="font-display text-[21px] tracking-tight">Cancelled</span>
              <span className="text-sm tabular-nums text-muted-2">{cancelled.length}</span>
            </summary>
            <div className="mt-3 overflow-hidden rounded-[16px] border border-ink/10 bg-cream/80">
              {cancelled.map((l) => (
                <LeadRow key={l.id} lead={l} shop={shopFor(l)} />
              ))}
            </div>
          </details>
        )}
      </main>
    </>
  );
}
