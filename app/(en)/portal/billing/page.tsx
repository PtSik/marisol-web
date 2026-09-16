import { env } from "cloudflare:workers";
import { PortalHeading, PortalNotice } from "@/components/portal/PortalHeading";
import { getLead, getLeadIdForAccount } from "@/lib/leads";
import {
  PLAN_LABELS,
  PLAN_OPTIONS,
  PRICE,
  type Plan,
  TRIAL_DAYS,
  normalizePlan,
} from "@/lib/plans";
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

const PLAN_CHANGE_NOTICE: Record<string, string> = {
  done: "Your new plan is live.",
  partial:
    "Your new plan is live. One step needs finishing on our side — we're on it and will email you.",
  already: "You're already on that plan.",
  failed: "That plan change didn't go through. Try again, or email us and we'll switch you over.",
};

const PLAN_PITCH: Record<Plan, string> = {
  basic: "24/7 calls, Google Calendar booking, call summaries and transfers.",
  complete:
    "Carrier-approved SMS appointment reminders, rescheduling messages, missed-call follow-up and a monthly results report.",
  growth:
    "Everything in Complete, plus win-back outreach, no-show follow-up and client memory that refills your calendar.",
};

export default async function PortalBillingPage({
  searchParams,
}: {
  searchParams: Promise<{ upgrade?: string; cancel?: string; resume?: string }>;
}) {
  const cfEnv = env as unknown as PortalEnv;
  const session = await requirePortalSession(cfEnv, { allowPending: true });
  const leadId = session.leadId ?? (await getLeadIdForAccount(cfEnv.LEADS_KV, session.accountId));
  const lead = leadId ? await getLead(cfEnv.LEADS_KV, leadId) : null;
  const { upgrade, cancel, resume } = await searchParams;

  const subscription =
    cfEnv.STRIPE_SECRET_KEY && lead?.stripeSubscriptionId
      ? await getSubscription(cfEnv.STRIPE_SECRET_KEY, lead.stripeSubscriptionId)
      : null;

  const plan = normalizePlan(lead?.plan);
  const billing = lead?.billing ?? "monthly";
  const status = subscription?.status ?? "";
  const trialEnds = fmtDate(subscription?.trial_end);
  const renews = fmtDate(subscription?.current_period_end);
  const planChoices =
    UPGRADABLE_STATUSES.has(status) && !subscription?.cancel_at_period_end
      ? PLAN_OPTIONS.filter((candidate) => candidate !== plan)
      : [];

  return (
    <>
      <PortalHeading
        title="Billing"
        lead="Manage your plan and cancellation here. Stripe securely handles payment methods and invoices."
      />

      {upgrade && PLAN_CHANGE_NOTICE[upgrade] && (
        <PortalNotice tone={upgrade === "done" || upgrade === "already" ? "good" : "warn"}>
          {PLAN_CHANGE_NOTICE[upgrade]}
        </PortalNotice>
      )}
      {cancel === "scheduled" || cancel === "already" ? (
        <PortalNotice tone="good">
          Cancellation is scheduled. Your service stays available through the date shown below.
        </PortalNotice>
      ) : cancel === "failed" ? (
        <PortalNotice tone="warn">
          We couldn't schedule the cancellation. Try again or email us and we'll handle it.
        </PortalNotice>
      ) : null}
      {resume === "done" || resume === "already" ? (
        <PortalNotice tone="good">Your subscription will continue.</PortalNotice>
      ) : resume === "failed" ? (
        <PortalNotice tone="warn">
          We couldn't resume the subscription. Try again or email us and we'll handle it.
        </PortalNotice>
      ) : null}

      <div className="mt-7 rounded-[24px] bg-cream-100 p-[clamp(20px,4vw,34px)]">
        <p className="text-[11.5px] font-semibold uppercase tracking-[0.16em] text-muted-2">
          Current plan
        </p>
        <p className="mt-1.5 font-display text-[clamp(24px,3.6vw,32px)] tracking-[-0.02em]">
          {PLAN_LABELS[plan]} — ${PRICE[plan][billing]}/mo
        </p>
        <p className="mt-1 text-[14px] text-muted">
          {billing === "annual" ? "Billed annually" : "Billed monthly"}
          {subscription?.cancel_at_period_end
            ? " · Cancellation scheduled"
            : status && ` · ${STATUS_LABEL[status] ?? status}`}
        </p>

        {status === "trialing" && trialEnds && (
          <p className="mt-4 text-[15px] leading-[1.55] text-muted">
            {subscription?.cancel_at_period_end ? (
              <>
                Your plan stays available until{" "}
                <span className="font-medium text-ink">{trialEnds}</span>. Your subscription will
                end automatically and you will not be charged.
              </>
            ) : (
              <>
                Your {TRIAL_DAYS}-day trial runs until{" "}
                <span className="font-medium text-ink">{trialEnds}</span>. Cancel before then and
                you're never charged.
              </>
            )}
          </p>
        )}
        {status === "active" && renews && (
          <p className="mt-4 text-[15px] leading-[1.55] text-muted">
            {subscription?.cancel_at_period_end ? "Your plan ends" : "Renews"} on{" "}
            <span className="font-medium text-ink">{renews}</span>
            {subscription?.cancel_at_period_end ? ". It will not renew." : "."}
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
              Manage card and invoices in Stripe
            </button>
          </form>
        ) : (
          <a
            href={CUSTOMER_PORTAL_URL}
            className="mt-6 inline-flex min-h-[50px] items-center justify-center rounded-[13px] bg-ink px-7 py-[14px] text-[15px] font-medium text-cream no-underline"
          >
            Manage card and invoices in Stripe
          </a>
        )}

        {!subscription?.cancel_at_period_end &&
          ["trialing", "active", "past_due"].includes(status) && (
            <div className="mt-6 border-t border-ink/10 pt-5">
              <p className="text-[14px] font-medium text-ink">Cancel subscription</p>
              <p className="mt-2 max-w-[52ch] text-[13.5px] leading-[1.5] text-muted-2">
                Your subscription will stop at the end of the current trial or billing period.
                Marisol will keep working until then.
              </p>
              <form method="post" action="/api/portal/cancel-subscription" className="mt-4">
                <button type="submit" className="btn btn-md btn-secondary text-danger">
                  Cancel my subscription
                </button>
              </form>
            </div>
          )}

        {subscription?.cancel_at_period_end && ["trialing", "active"].includes(status) && (
          <form method="post" action="/api/portal/resume-subscription" className="mt-6">
            <button type="submit" className="btn btn-md btn-secondary">
              Keep my subscription
            </button>
          </form>
        )}

        <p className="mt-4 text-[13.5px] leading-[1.5] text-muted-2">
          Need help changing your plan or adding a location?{" "}
          <a href={SALES_EMAIL_HREF} className="font-medium text-teal">
            Email us
          </a>{" "}
          — we'll move you over without downtime.
        </p>
      </div>

      {planChoices.map((target) => (
        <div
          key={target}
          className="mt-3 rounded-[24px] border border-teal/25 bg-teal/[0.07] p-[clamp(20px,4vw,34px)]"
        >
          <p className="text-[11.5px] font-semibold uppercase tracking-[0.16em] text-teal">
            {PLAN_OPTIONS.indexOf(target) > PLAN_OPTIONS.indexOf(plan) ? "Upgrade" : "Downgrade"}
          </p>
          <p className="mt-1.5 font-display text-[clamp(21px,3vw,27px)] tracking-[-0.02em]">
            {PLAN_LABELS[target]} — ${PRICE[target][billing]}/mo
          </p>
          <p className="mt-2 max-w-[54ch] text-[15px] leading-[1.55] text-muted">
            {PLAN_PITCH[target]}
          </p>
          <p className="mt-2 max-w-[54ch] text-[14px] leading-[1.55] text-muted-2">
            {status === "trialing"
              ? `${PLAN_LABELS[target]} starts right away and your trial is untouched — nothing is charged${
                  trialEnds ? ` before ${trialEnds}` : " before it ends"
                }.`
              : PLAN_OPTIONS.indexOf(target) > PLAN_OPTIONS.indexOf(plan)
                ? `${PLAN_LABELS[target]} starts right away. You're only charged the difference for the days left in this period.`
                : `${PLAN_LABELS[target]} starts right away. Stripe applies the prorated credit to your account.`}
          </p>

          <form method="post" action="/api/portal/upgrade" className="mt-5">
            <input type="hidden" name="plan" value={target} />
            <button
              type="submit"
              className="inline-flex min-h-[50px] w-full items-center justify-center rounded-[13px] bg-teal px-7 py-[14px] text-[15px] font-medium text-cream sm:w-auto"
            >
              Change to {PLAN_LABELS[target]}
            </button>
          </form>
        </div>
      ))}
    </>
  );
}
