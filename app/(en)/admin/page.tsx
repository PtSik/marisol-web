import { env } from "cloudflare:workers";
import { LogoMark } from "@/components/Logo";
import { ADMIN_COOKIE, isAdminCookieValid } from "@/lib/adminAuth";
import { type CallLead, type CheckoutLead, listLeads } from "@/lib/leads";
import { voiceAgentFetch } from "@/lib/voiceAgent";
import { cookies } from "next/headers";
import type { ReactNode } from "react";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Clients — Marisol admin",
  robots: { index: false, follow: false },
};

interface AdminEnv {
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
  setup_complete: "amber",
  paid: "amber",
  created: "muted",
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
        {lead.basics.vertical} · {lead.plan ?? "base"} / {lead.billing}
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
            <dt className="text-muted">Forwarding</dt>
            <dd>{lead.setup.forwardMode}</dd>
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
      {lead.shopId && <CalendarInviteAction lead={lead} connected={isCalendarConnected(shop)} />}
    </article>
  );
}

function isCalendarConnected(shop?: Shop): boolean {
  return shop?.integration === "google_calendar";
}

function CalendarInviteAction({ lead, connected }: { lead: CheckoutLead; connected: boolean }) {
  if (connected) return null;
  if (lead.calendarEmailSentAt) {
    return (
      <p className="mt-3 text-sm text-muted">
        Calendar invite sent {fmtDate(lead.calendarEmailSentAt)} — not connected yet.
      </p>
    );
  }
  return (
    <form method="post" action={`/api/admin/leads/${lead.id}/calendar-email`} className="mt-3">
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

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; calendar?: string }>;
}) {
  const cfEnv = env as unknown as AdminEnv;
  const { error, calendar } = await searchParams;
  const jar = await cookies();
  const authed = await isAdminCookieValid(jar.get(ADMIN_COOKIE)?.value, cfEnv.ADMIN_DASH_KEY);
  if (!authed) return <LoginForm error={Boolean(error)} />;

  const leads = await listLeads(cfEnv.LEADS_KV);
  const checkout = leads.filter((l): l is CheckoutLead => l.intent === "checkout");
  const callLeads = leads.filter((l): l is CallLead => l.intent === "call");

  let shops: Map<string, Shop> | undefined;
  const res = await voiceAgentFetch(cfEnv, "/admin/shops").catch(() => null);
  if (res?.ok) {
    const data = (await res.json().catch(() => null)) as { shops?: Shop[] } | null;
    if (data?.shops) shops = new Map(data.shops.map((s) => [s.id, s]));
  }

  const shopFor = (l: CheckoutLead) => (l.shopId ? shops?.get(l.shopId) : undefined);
  const active = checkout.filter((l) => l.status === "provisioned");
  const inProgress = checkout.filter(
    (l) => l.status === "created" || l.status === "paid" || l.status === "setup_complete",
  );
  const cancelled = checkout.filter((l) => l.status === "cancelled");

  return (
    <>
      <nav className="mx-auto max-w-shell px-[22px] pt-[14px]">
        <div className="flex w-full items-center justify-between gap-5 rounded-[18px] border border-ink/10 bg-cream/80 px-5 py-3 backdrop-blur-md">
          <a
            href="/"
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
        {leads.length === 0 && <p className="mt-10 text-muted">No leads yet.</p>}
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
