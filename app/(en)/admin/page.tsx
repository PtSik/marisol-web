import { env } from "cloudflare:workers";
import { LogoMark } from "@/components/Logo";
import { TeardownActions } from "@/components/portal/TeardownActions";
import { ADMIN_COOKIE, isAdminCookieValid } from "@/lib/adminAuth";
import { CARRIER_REFERENCE, CARRIER_STATUS_CHECKS, carrierCodes } from "@/lib/forwarding";
import {
  ACTIVATABLE_LEAD_STATUSES,
  type CallLead,
  type CheckoutLead,
  activationNeedsReconciliation,
  listLeads,
} from "@/lib/leads";
import { PAYOUT_LABEL, isPayoutMethod } from "@/lib/payout";
import { normalizePlan } from "@/lib/plans";
import { type Referral, listReferrals } from "@/lib/referrals";
import { siteHref } from "@/lib/site";
import { listTeardowns } from "@/lib/teardownQueue";
import { usAreaCode } from "@/lib/twilio";
import { voiceAgentFetch } from "@/lib/voiceAgent";
import { cookies } from "next/headers";
import type { ReactNode } from "react";

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

interface Shop {
  id: string;
  status?: string;
  integration?: string;
  reminders_enabled?: boolean;
}

type Tone = "teal" | "amber" | "red" | "muted";

const LEAD_TONE: Record<CheckoutLead["status"], Tone> = {
  provisioned: "teal",
  pending_review: "amber",
  activating: "amber",
  activation_failed: "red",
  setup_complete: "amber",
  paid: "amber",
  created: "muted",
  cancellation_pending: "red",
  cancelled: "red",
};

function Pill({ tone, children }: { tone: Tone; children: ReactNode }) {
  const tones: Record<Tone, string> = {
    teal: "bg-teal/10 text-teal",
    amber: "bg-[#B97E24]/10 text-[#8A5D17]",
    red: "bg-[#B3261E]/10 text-[#B3261E]",
    muted: "bg-ink/5 text-muted",
  };
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}

function fmtDate(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const REVIEW_DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

function reviewHours(lead: CheckoutLead): string {
  if (!lead.setup) return "";
  return REVIEW_DAYS.map((day) => {
    const hours = lead.setup?.hours[day];
    return `${day.toUpperCase()} ${hours?.closed ? "closed" : `${hours?.open}–${hours?.close}`}`;
  }).join(" · ");
}

function reviewServices(lead: CheckoutLead): string {
  return (lead.setup?.services ?? [])
    .filter((service) => service.name.trim())
    .map((service) => {
      const duration = service.durationMaxMin?.trim()
        ? `${service.durationMin}–${service.durationMaxMin} min`
        : `${service.durationMin} min`;
      const price = service.priceMax?.trim()
        ? `$${service.price}–$${service.priceMax}`
        : service.price.trim()
          ? `$${service.price}`
          : "price not set";
      return `${service.name.trim()} (${duration}, ${price})`;
    })
    .join("; ");
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

function LeadTile({ lead, shop }: { lead: CheckoutLead; shop?: Shop }) {
  return (
    <article className="rounded-[18px] border border-ink/10 bg-cream/80 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-[19px] tracking-tight">{lead.basics.businessName}</h3>
        <div className="flex gap-1.5">
          <Pill tone={LEAD_TONE[lead.status]}>{lead.status.replace("_", " ")}</Pill>
          {shop?.status && shop.status !== "active" && <Pill tone="red">shop: {shop.status}</Pill>}
        </div>
      </div>
      <p className="mt-0.5 text-sm text-muted">
        {lead.basics.vertical} · {normalizePlan(lead.plan)} / {lead.billing}
      </p>
      {lead.assignedNumber && (
        <p className="mt-3 text-[17px] font-semibold">{lead.assignedNumber}</p>
      )}
      <dl className="mt-3 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-muted">Owner</dt>
        <dd>{lead.basics.ownerName}</dd>
        <dt className="text-muted">Email</dt>
        <dd className="break-all">{lead.basics.email}</dd>
        <dt className="text-muted">Mobile</dt>
        <dd>{lead.basics.ownerMobile}</dd>
        <dt className="text-muted">Business line</dt>
        <dd>{lead.basics.businessPhone}</dd>
        <dt className="text-muted">Address</dt>
        <dd>{lead.basics.address?.trim() || "not provided"}</dd>
        <dt className="text-muted">Timezone</dt>
        <dd>{lead.basics.timezone}</dd>
        {lead.paidAt && (
          <>
            <dt className="text-muted">Paid</dt>
            <dd>{fmtDate(lead.paidAt)}</dd>
          </>
        )}
        {lead.provisionedAt && (
          <>
            <dt className="text-muted">Provisioned</dt>
            <dd>{fmtDate(lead.provisionedAt)}</dd>
          </>
        )}
        {lead.setup && (
          <>
            <dt className="text-muted">Hours</dt>
            <dd>{reviewHours(lead)}</dd>
            <dt className="text-muted">Services</dt>
            <dd>{reviewServices(lead) || "none"}</dd>
            <dt className="text-muted">Staff</dt>
            <dd>
              {lead.setup.staff
                .filter((member) => member.name.trim())
                .map((member) => member.name.trim())
                .join(", ") || "none"}
            </dd>
            <dt className="text-muted">Calendar request</dt>
            <dd>{lead.setup.calendar === "google_calendar" ? "Google Calendar" : "none"}</dd>
            <dt className="text-muted">Forwarding</dt>
            <dd>
              {lead.setup.forwardNumber} · {lead.setup.carrier ?? "unknown"}
              {lead.assignedNumber && (
                <span className="block text-muted">
                  {carrierCodes(lead.setup.carrier, lead.assignedNumber)
                    .map((c) => `on ${c.dial.join(" + ")} · off ${c.off.join(" + ")}`)
                    .join(" | ")}
                </span>
              )}
              {lead.setup.carrier &&
                lead.setup.carrier !== "unknown" &&
                CARRIER_REFERENCE[lead.setup.carrier].map((note) => (
                  <span key={note} className="block text-muted">
                    {note}
                  </span>
                ))}
              <span className="block text-muted">Check: {CARRIER_STATUS_CHECKS}</span>
            </dd>
            <dt className="text-muted">Notes</dt>
            <dd className="whitespace-pre-wrap">{lead.setup.notes.trim() || "none"}</dd>
          </>
        )}
        {shop && (
          <>
            <dt className="text-muted">Calendar</dt>
            <dd>
              {shop.integration === "google_calendar" ? "Google Calendar ✓" : "not connected"}
            </dd>
            <dt className="text-muted">Reminders</dt>
            <dd>{shop.reminders_enabled ? "on (premium)" : "off"}</dd>
          </>
        )}
      </dl>
      {lead.provisionError && (
        <p className="mt-3 rounded-[10px] bg-[#B3261E]/10 px-3 py-2 text-sm text-[#B3261E]">
          Provisioning failed: {lead.provisionError}
        </p>
      )}
      <ActivationAction lead={lead} />
      {lead.shopId && <CalendarInviteAction lead={lead} connected={isCalendarConnected(shop)} />}
    </article>
  );
}

function ActivationAction({ lead }: { lead: CheckoutLead }) {
  if (lead.status === "cancellation_pending")
    return (
      <form method="post" action="/api/admin/teardown/retry" className="mt-3">
        <input type="hidden" name="leadId" value={lead.id} />
        <button type="submit" className="rounded border px-4 py-2">
          Queue pending cleanup
        </button>
      </form>
    );
  if (lead.status === "provisioned" || lead.status === "cancelled") {
    return null;
  }
  if (lead.status === "activating" || activationNeedsReconciliation(lead)) {
    return (
      <p className="mt-3 rounded-[10px] bg-[#B97E24]/10 px-3 py-2 text-sm text-[#8A5D17]">
        Activation may have left external resources. Reconcile Twilio and shop state before
        retrying.
      </p>
    );
  }
  if (!lead.setup || !ACTIVATABLE_LEAD_STATUSES.has(lead.status)) return null;
  const clientAreaCode = usAreaCode(lead.setup.forwardNumber || lead.basics.businessPhone);
  return (
    <form method="post" action={`/api/admin/leads/${lead.id}/activate`} className="mt-3">
      <label className="mb-2 block text-xs text-muted">
        <span className="mb-1 block font-medium text-ink">Twilio area code</span>
        <input
          name="areaCodeOverride"
          inputMode="numeric"
          pattern="[2-9][0-9]{2}"
          maxLength={3}
          defaultValue={lead.activationAreaCodeOverride ?? ""}
          placeholder={clientAreaCode ?? "305"}
          className="w-full rounded-[10px] border border-black/10 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-teal/50"
        />
        <span className="mt-1 block">
          Leave blank to use {clientAreaCode ?? "the client number"}. Override only after the owner
          approves a neighbouring area code.
        </span>
      </label>
      <label className="mb-2 flex items-start gap-2 text-xs text-muted">
        <input type="checkbox" required className="mt-0.5" />
        <span>I reviewed the phone, area code, hours, services, staff and forwarding setup.</span>
      </label>
      <button
        type="submit"
        className="w-full rounded-[10px] border border-teal/30 bg-teal/10 px-4 py-2 text-sm font-medium text-teal"
      >
        {lead.status === "activation_failed"
          ? "Review and retry activation"
          : "Activate receptionist"}
      </button>
      <span className="mt-1.5 block text-xs text-muted">
        This buys a Twilio number and emails the client after the shop is live.
      </span>
    </form>
  );
}

function isCalendarConnected(shop?: Shop): boolean {
  return shop?.integration === "google_calendar";
}

function CalendarInviteAction({ lead, connected }: { lead: CheckoutLead; connected: boolean }) {
  if (connected) return null;
  if (lead.calendarEmailSentAt && lead.calendarAccessGrantedAt) {
    return (
      <p className="mt-3 text-sm text-muted">
        Calendar invite sent {fmtDate(lead.calendarEmailSentAt)} — not connected yet.
      </p>
    );
  }
  return (
    <form method="post" action={`/api/admin/leads/${lead.id}/calendar-email`} className="mt-3">
      <label className="mb-2 block text-sm">
        <input type="checkbox" name="accessConfirmed" value="yes" required /> I added{" "}
        {lead.basics.email} as a Google test user or verified production access.
      </label>
      <button
        type="submit"
        className="w-full rounded-[10px] border border-teal/30 bg-teal/10 px-4 py-2 text-sm font-medium text-teal"
      >
        Send calendar invite
      </button>
      <span className="mt-1.5 block text-xs text-muted">
        Add {lead.basics.email} as a Google Cloud test user first.
      </span>
    </form>
  );
}

function payoutLabel(method?: string | null): string {
  return isPayoutMethod(method) ? PAYOUT_LABEL[method] : (method ?? "cash");
}

const REFERRAL_TONE: Record<Referral["status"], Tone> = {
  pending: "muted",
  qualified: "amber",
  claimable: "teal",
  payout_requested: "amber",
  paid_out: "teal",
  void: "red",
};

function ReferralTile({ referral }: { referral: Referral }) {
  return (
    <article className="rounded-[18px] border border-ink/10 bg-cream/80 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-[19px] tracking-tight">${referral.amount_cents / 100}</h3>
        <Pill tone={REFERRAL_TONE[referral.status]}>{referral.status.replace("_", " ")}</Pill>
      </div>
      <dl className="mt-3 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-muted">Referrer</dt>
        <dd className="break-all">{referral.referrer?.email ?? referral.referrer_account_id}</dd>
        <dt className="text-muted">Referred</dt>
        <dd className="break-all">{referral.referred_email ?? referral.referred_lead_id}</dd>
        {referral.mature_at && (
          <>
            <dt className="text-muted">Matures</dt>
            <dd>{fmtDate(referral.mature_at)}</dd>
          </>
        )}
        {referral.payout_ref && (
          <>
            <dt className="text-muted">Payout ref</dt>
            <dd className="break-all">{referral.payout_ref}</dd>
          </>
        )}
      </dl>
      {referral.status === "payout_requested" && (
        <form method="post" action={`/api/admin/referrals/${referral.id}/payout`} className="mt-3">
          <p className="mb-1.5 text-sm font-medium">
            Send ${referral.amount_cents / 100} via{" "}
            {payoutLabel(referral.payout_method ?? referral.referrer?.payout_method)} —{" "}
            {referral.referrer?.payout_handle ?? "no handle on file"}
          </p>
          <button
            type="submit"
            className="w-full rounded-[10px] border border-teal/30 bg-teal/10 px-4 py-2 text-sm font-medium text-teal"
          >
            Mark paid out
          </button>
          <span className="mt-1.5 block text-xs text-muted">Send the cash first.</span>
        </form>
      )}
    </article>
  );
}

function CallTile({ lead }: { lead: CallLead }) {
  return (
    <article className="rounded-[18px] border border-ink/10 bg-cream/80 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-[19px] tracking-tight">{lead.call.name}</h3>
        <Pill tone="amber">call request</Pill>
      </div>
      <dl className="mt-3 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-muted">Phone</dt>
        <dd>{lead.call.phone}</dd>
        <dt className="text-muted">Email</dt>
        <dd className="break-all">{lead.call.email}</dd>
        {lead.call.preferredTime && (
          <>
            <dt className="text-muted">Preferred time</dt>
            <dd>{lead.call.preferredTime}</dd>
          </>
        )}
        <dt className="text-muted">Received</dt>
        <dd>{fmtDate(lead.createdAt)}</dd>
      </dl>
      {lead.call.question && <p className="mt-3 text-sm">{lead.call.question}</p>}
    </article>
  );
}

function Section({
  title,
  count,
  children,
}: { title: string; count: number; children: ReactNode }) {
  if (count === 0) return null;
  return (
    <section className="mt-10">
      <h2 className="font-display text-[24px] tracking-tight">
        {title} <span className="text-[16px] text-muted">({count})</span>
      </h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </section>
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

  const shopFor = (l: CheckoutLead) => (l.shopId ? shops?.get(l.shopId) : undefined);
  const active = checkout.filter((l) => l.status === "provisioned");
  const inProgress = checkout.filter((l) => l.status !== "provisioned" && l.status !== "cancelled");
  const cancelled = checkout.filter((l) => l.status === "cancelled");

  return (
    <>
      <nav className="mx-auto max-w-shell px-[22px] pt-[14px]">
        <div className="flex w-full items-center justify-between gap-5 rounded-[18px] border border-ink/10 bg-cream/80 px-5 py-3 backdrop-blur-md">
          <a
            href={siteHref()}
            className="flex items-center gap-[7px] font-display text-[22px] tracking-tight no-underline"
          >
            <LogoMark className="h-5 w-5 rounded-[3.5px]" />
            Marisol <span className="text-[15px] text-muted">admin</span>
          </a>
          <span className="text-sm text-muted">
            {checkout.length} leads · {active.length} active
          </span>
        </div>
      </nav>
      <main className="mx-auto max-w-shell px-[22px] pb-20 pt-[clamp(24px,4vw,40px)]">
        {!shops && (
          <p className="rounded-[12px] border border-[#B97E24]/30 bg-[#B97E24]/10 px-4 py-2.5 text-sm text-[#8A5D17]">
            Couldn't reach the voice-agent admin API — shop status, calendar and reminders are
            hidden.
          </p>
        )}
        {calendar && CALENDAR_NOTICE[calendar] && (
          <p
            className={`mt-3 rounded-[12px] border px-4 py-2.5 text-sm ${
              calendar === "sent"
                ? "border-teal/30 bg-teal/10 text-teal"
                : "border-[#B97E24]/30 bg-[#B97E24]/10 text-[#8A5D17]"
            }`}
          >
            {CALENDAR_NOTICE[calendar]}
          </p>
        )}
        {payout && PAYOUT_NOTICE[payout] && (
          <p
            className={`mt-3 rounded-[12px] border px-4 py-2.5 text-sm ${
              payout === "paid"
                ? "border-teal/30 bg-teal/10 text-teal"
                : "border-[#B97E24]/30 bg-[#B97E24]/10 text-[#8A5D17]"
            }`}
          >
            {PAYOUT_NOTICE[payout]}
          </p>
        )}
        {activation && ACTIVATION_NOTICE[activation] && (
          <p
            className={`mt-3 rounded-[12px] border px-4 py-2.5 text-sm ${
              activation === "activated"
                ? "border-teal/30 bg-teal/10 text-teal"
                : "border-[#B97E24]/30 bg-[#B97E24]/10 text-[#8A5D17]"
            }`}
          >
            {ACTIVATION_NOTICE[activation]}
          </p>
        )}
        {leads.length === 0 && <p className="mt-10 text-muted">No leads yet.</p>}
        {teardownJobs === null && (
          <p className="mt-4">Teardown queue unavailable. Check the D1 migration and binding.</p>
        )}
        {teardownJobs && (
          <Section title="Teardown incomplete" count={teardownJobs.length}>
            {teardownJobs.map((job) => (
              <article key={job.id} className="mt-3 rounded-xl border p-4">
                <p className="font-medium">{job.id}</p>
                <p>
                  {job.status} · {job.attempts} attempts
                </p>
                {job.last_error && <p>{job.last_error}</p>}
                <TeardownActions id={job.id} status={job.status} />
              </article>
            ))}
          </Section>
        )}
        <Section title="Active clients" count={active.length}>
          {active.map((l) => (
            <LeadTile key={l.id} lead={l} shop={shopFor(l)} />
          ))}
        </Section>
        <Section title="In progress" count={inProgress.length}>
          {inProgress.map((l) => (
            <LeadTile key={l.id} lead={l} shop={shopFor(l)} />
          ))}
        </Section>
        <Section title="Referrals" count={openReferrals.length}>
          {openReferrals.map((r) => (
            <ReferralTile key={r.id} referral={r} />
          ))}
        </Section>
        <Section title="Call requests" count={callLeads.length}>
          {callLeads.map((l) => (
            <CallTile key={l.id} lead={l} />
          ))}
        </Section>
        {cancelled.length > 0 && (
          <details className="mt-10">
            <summary className="cursor-pointer font-display text-[24px] tracking-tight">
              Cancelled <span className="text-[16px] text-muted">({cancelled.length})</span>
            </summary>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {cancelled.map((l) => (
                <LeadTile key={l.id} lead={l} shop={shopFor(l)} />
              ))}
            </div>
          </details>
        )}
      </main>
    </>
  );
}
