"use client";

import { PlanCards } from "@/components/pricing/PlanCards";
import { en } from "@/lib/i18n/en";
import type { Billing, Plan } from "@/lib/plans";

export function PortalPlanCards({
  current,
  billing,
  trialing,
}: {
  current: Plan;
  billing: Billing;
  trialing: boolean;
}) {
  return (
    <div className="relative left-1/2 mt-10 w-[min(calc(100vw-44px),1080px)] -translate-x-1/2 text-center">
      <h2 className="font-display text-[clamp(26px,4vw,36px)] tracking-[-0.02em]">Compare plans</h2>
      <p className="mx-auto mt-2 max-w-[54ch] text-[14.5px] leading-[1.55] text-muted">
        {trialing
          ? "Your trial and its end date stay the same."
          : "The change takes effect now, with a prorated charge or credit for this billing period."}{" "}
        Any promotion eligible for the new plan continues automatically.
      </p>
      <PlanCards
        t={en.pricing}
        billing={billing}
        onBillingChange={() => {}}
        showBillingToggle={false}
        showTerms={false}
        showFooter={false}
        renderCta={(tier) =>
          tier === current ? (
            <button
              type="button"
              disabled
              className={`btn btn-md opacity-60 ${tier === "complete" ? "btn-on-dark" : "btn-secondary"}`}
            >
              Current plan
            </button>
          ) : (
            <form method="post" action="/api/portal/upgrade">
              <input type="hidden" name="plan" value={tier} />
              <button
                type="submit"
                className={`btn btn-md w-full ${tier === "complete" ? "btn-on-dark" : "btn-primary"}`}
              >
                Change to {en.pricing.tiers[tier].name}
              </button>
            </form>
          )
        }
      />
    </div>
  );
}
