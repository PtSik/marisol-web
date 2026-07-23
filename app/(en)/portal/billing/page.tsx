import { env } from "cloudflare:workers";
import { PortalHeading, PortalNotice } from "@/components/portal/PortalHeading";
import { getLead } from "@/lib/leads";
import { PLAN_LABELS, PRICE, TRIAL_DAYS } from "@/lib/plans";
import type { PortalEnv } from "@/lib/portalApi";
import { requirePortalSession } from "@/lib/session";
import { CUSTOMER_PORTAL_URL, SALES_EMAIL_HREF } from "@/lib/site";
import { getSubscription } from "@/lib/stripe";

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

export default async function PortalBillingPage() {
  const cfEnv = env as unknown as PortalEnv;
  const session = await requirePortalSession(cfEnv.RATE_LIMIT_KV);
  const lead = session.leadId ? await getLead(cfEnv.LEADS_KV, session.leadId) : null;

  const subscription =
    cfEnv.STRIPE_SECRET_KEY && lead?.stripeSubscriptionId
      ? await getSubscription(cfEnv.STRIPE_SECRET_KEY, lead.stripeSubscriptionId)
      : null;

  const plan = lead?.plan ?? "base";
  const billing = lead?.billing ?? "monthly";
  const status = subscription?.status ?? "";
  const trialEnds = fmtDate(subscription?.trial_end);
  const renews = fmtDate(subscription?.current_period_end);

  return (
    <>
      <PortalHeading
        title="Billing"
        lead="Your plan, and everything else — card, invoices, cancellation — in Stripe."
      />

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
          Changing plan or adding a location?{" "}
          <a href={SALES_EMAIL_HREF} className="font-medium text-teal">
            Email us
          </a>{" "}
          — we'll move you over without downtime.
        </p>
      </div>
    </>
  );
}
