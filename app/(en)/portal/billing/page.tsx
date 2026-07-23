import { env } from "cloudflare:workers";
import { PortalHeading, PortalNotice } from "@/components/portal/PortalHeading";
import { getLead } from "@/lib/leads";
import { PLAN_LABELS, PRICE, TRIAL_DAYS } from "@/lib/plans";
import type { PortalEnv } from "@/lib/portalApi";
import { requirePortalSession } from "@/lib/session";
import { CUSTOMER_PORTAL_URL, SALES_EMAIL_HREF } from "@/lib/site";
import { UPGRADABLE_STATUSES, getSubscription } from "@/lib/stripe";

export const dynamic = "force-dynamic";

function fmtDate(seconds?: number | null): string | undefined {
  if (!seconds) return undefined;
  return new Date(seconds * 1000).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

const STATUS_LABEL: Record<string, string> = {
  trialing: "Free trial",
  active: "Active",
  past_due: "Payment failed",
  canceled: "Cancelled",
  unpaid: "Unpaid",
  incomplete: "Awaiting payment",
};

const UPGRADE_NOTICE: Record<string, string> = {
  done: "You're on Premium — SMS reminders are on, and the difference is prorated to this period.",
  partial:
    "You're on Premium. Reminders need one last switch on our side — we're on it and will email you.",
  already: "You're already on Premium.",
  failed: "That upgrade didn't go through. Try again, or email us and we'll switch you over.",
};

export default async function PortalBillingPage({
  searchParams,
}: {
  searchParams: Promise<{ upgrade?: string }>;
}) {
  const cfEnv = env as unknown as PortalEnv;
  const session = await requirePortalSession(cfEnv.RATE_LIMIT_KV);
  const lead = session.leadId ? await getLead(cfEnv.LEADS_KV, session.leadId) : null;
  const { upgrade } = await searchParams;

  const subscription =
    cfEnv.STRIPE_SECRET_KEY && lead?.stripeSubscriptionId
      ? await getSubscription(cfEnv.STRIPE_SECRET_KEY, lead.stripeSubscriptionId)
      : null;

  const plan = lead?.plan ?? "base";
  const billing = lead?.billing ?? "monthly";
  const status = subscription?.status ?? "";
  const trialEnds = fmtDate(subscription?.trial_end);
  const renews = fmtDate(subscription?.current_period_end);
  const canUpgrade = plan === "base" && UPGRADABLE_STATUSES.has(status);

  return (
    <>
      <PortalHeading
        title="Billing"
        lead="Your plan, and everything else — card, invoices, cancellation — in Stripe."
      />

      {upgrade && UPGRADE_NOTICE[upgrade] && (
        <PortalNotice tone={upgrade === "done" || upgrade === "already" ? "good" : "warn"}>
          {UPGRADE_NOTICE[upgrade]}
        </PortalNotice>
      )}

      <div className="mt-7 rounded-[24px] bg-cream-100 p-[clamp(20px,4vw,34px)]">
        <p className="text-[11.5px] font-semibold uppercase tracking-[0.16em] text-muted-2">
          Current plan
        </p>
        <p className="mt-1.5 font-display text-[clamp(24px,3.6vw,32px)] tracking-[-0.02em]">
          {PLAN_LABELS[plan]} — ${PRICE[plan][billing]}/mo
        </p>
        <p className="mt-1 text-[14px] text-muted">
          {billing === "annual" ? "Billed annually" : "Billed monthly"}
          {status && ` · ${STATUS_LABEL[status] ?? status}`}
        </p>

        {status === "trialing" && trialEnds && (
          <p className="mt-4 text-[15px] leading-[1.55] text-muted">
            Your {TRIAL_DAYS}-day trial runs until{" "}
            <span className="font-medium text-ink">{trialEnds}</span>. Cancel before then and you're
            never charged.
          </p>
        )}
        {status === "active" && renews && (
          <p className="mt-4 text-[15px] leading-[1.55] text-muted">
            Renews on <span className="font-medium text-ink">{renews}</span>
            {subscription?.cancel_at_period_end && " — cancellation already scheduled"}.
          </p>
        )}
        {status === "past_due" && (
          <PortalNotice tone="warn">
            Stripe couldn't charge your card. Update it below — Marisol keeps answering while you
            do.
          </PortalNotice>
        )}

        {lead?.stripeCustomerId ? (
          <form method="post" action="/api/portal/billing-portal" className="mt-6">
            <button
              type="submit"
              className="inline-flex min-h-[50px] w-full items-center justify-center rounded-[13px] bg-ink px-7 py-[14px] text-[15px] font-medium text-cream sm:w-auto"
            >
              Manage billing in Stripe
            </button>
          </form>
        ) : (
          <a
            href={CUSTOMER_PORTAL_URL}
            className="mt-6 inline-flex min-h-[50px] items-center justify-center rounded-[13px] bg-ink px-7 py-[14px] text-[15px] font-medium text-cream no-underline"
          >
            Manage billing in Stripe
          </a>
        )}

        <p className="mt-4 text-[13.5px] leading-[1.5] text-muted-2">
          Downgrading or adding a location?{" "}
          <a href={SALES_EMAIL_HREF} className="font-medium text-teal">
            Email us
          </a>{" "}
          — we'll move you over without downtime.
        </p>
      </div>

      {canUpgrade && (
        <div className="mt-3 rounded-[24px] border border-teal/25 bg-teal/[0.07] p-[clamp(20px,4vw,34px)]">
          <p className="text-[11.5px] font-semibold uppercase tracking-[0.16em] text-teal">
            Upgrade
          </p>
          <p className="mt-1.5 font-display text-[clamp(21px,3vw,27px)] tracking-[-0.02em]">
            {PLAN_LABELS.premium} — ${PRICE.premium[billing]}/mo
          </p>
          <p className="mt-2 max-w-[54ch] text-[15px] leading-[1.55] text-muted">
            SMS appointment reminders, rebooking nudges, unlimited answered calls and a second
            location.
          </p>
          <p className="mt-2 max-w-[54ch] text-[14px] leading-[1.55] text-muted-2">
            {status === "trialing"
              ? `Premium starts right away and your trial is untouched — nothing is charged${
                  trialEnds ? ` before ${trialEnds}` : " before it ends"
                }.`
              : "Premium starts right away. You're only charged the difference for the days left in this period."}
          </p>

          <form method="post" action="/api/portal/upgrade" className="mt-5">
            <button
              type="submit"
              className="inline-flex min-h-[50px] w-full items-center justify-center rounded-[13px] bg-teal px-7 py-[14px] text-[15px] font-medium text-cream sm:w-auto"
            >
              Upgrade to Premium
            </button>
          </form>
        </div>
      )}
    </>
  );
}
