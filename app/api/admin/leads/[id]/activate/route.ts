import { env } from "cloudflare:workers";
import {
  type ActivationLockEnv,
  acquireActivationLock,
  releaseActivationLock,
} from "@/lib/activationLock";
import { ADMIN_COOKIE, isAdminCookieValid } from "@/lib/adminAuth";
import {
  ACTIVATABLE_LEAD_STATUSES,
  type CheckoutLead,
  activationNeedsReconciliation,
  getLead,
  isPreparedLead,
  putLead,
} from "@/lib/leads";
import { notifyTeam } from "@/lib/notify";
import { validateSetupPayload } from "@/lib/onboarding";
import { extraLocationCount, normalizePlan } from "@/lib/plans";
import { getShop, listAccountShopsStrict } from "@/lib/portalApi";
import {
  type ProvisioningEnv,
  patchShop,
  provisionLead,
  sendProvisionedWelcome,
} from "@/lib/provisioning";
import { UPGRADABLE_STATUSES, getSubscription, setSubscriptionExtraLocations } from "@/lib/stripe";
import { isUsAreaCode } from "@/lib/twilio";
import { voiceAgentFetch } from "@/lib/voiceAgent";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

interface ActivationEnv extends ProvisioningEnv, ActivationLockEnv {
  ADMIN_DASH_KEY?: string;
  STRIPE_PRICE_EXTRA_LOCATION_MONTHLY?: string;
  STRIPE_PRICE_EXTRA_LOCATION_ANNUAL?: string;
}

async function billAdditionalLocation(cfEnv: ActivationEnv, lead: CheckoutLead): Promise<void> {
  if (!lead.additionalLocation || !lead.accountId || !lead.stripeSubscriptionId) return;

  const subscription = cfEnv.STRIPE_SECRET_KEY
    ? await getSubscription(cfEnv.STRIPE_SECRET_KEY, lead.stripeSubscriptionId)
    : null;
  const shops = await listAccountShopsStrict(cfEnv, lead.accountId);
  // A freshly activated shop must be visible here. An empty list is indistinguishable from an API
  // outage, so never turn that ambiguity into quantity=0 and accidentally remove existing billing.
  if (!shops || shops.length === 0) {
    await notifyTeam(cfEnv, `💳 Extra-location count needs review — ${lead.basics.businessName}`, {
      accountId: lead.accountId,
      shopId: lead.shopId,
      subscription: lead.stripeSubscriptionId,
    });
    return;
  }
  const activeSalons = shops.filter((shop) => shop.status !== "cancelled").length;
  const quantity = extraLocationCount(normalizePlan(lead.plan), activeSalons);
  const billed =
    subscription &&
    cfEnv.STRIPE_PRICE_EXTRA_LOCATION_MONTHLY &&
    cfEnv.STRIPE_PRICE_EXTRA_LOCATION_ANNUAL
      ? await setSubscriptionExtraLocations(cfEnv.STRIPE_SECRET_KEY as string, {
          subscription,
          monthlyPriceId: cfEnv.STRIPE_PRICE_EXTRA_LOCATION_MONTHLY,
          annualPriceId: cfEnv.STRIPE_PRICE_EXTRA_LOCATION_ANNUAL,
          quantity,
        })
      : false;
  if (!billed) {
    await notifyTeam(cfEnv, `💳 Extra-location charge needs review — ${lead.basics.businessName}`, {
      accountId: lead.accountId,
      shopId: lead.shopId,
      subscription: lead.stripeSubscriptionId,
      quantity,
    });
  }
}

function back(request: Request, status: string): Response {
  const url = new URL("/admin", request.url);
  url.searchParams.set("activation", status);
  return Response.redirect(url.toString(), 303);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const cfEnv = env as unknown as ActivationEnv;
  const jar = await cookies();
  if (!(await isAdminCookieValid(jar.get(ADMIN_COOKIE)?.value, cfEnv.ADMIN_DASH_KEY))) {
    return Response.redirect(new URL("/admin?error=1", request.url).toString(), 303);
  }

  const { id } = await params;
  const lead = await getLead(cfEnv.LEADS_KV, id);
  if (!lead) return back(request, "missing");
  if (lead.status === "provisioned") return back(request, "already-active");
  if (lead.status === "cancelled" || lead.status === "cancellation_pending") {
    return back(request, "cancelled");
  }
  if (lead.status === "activating") {
    return back(request, "in-progress");
  }
  if (activationNeedsReconciliation(lead)) return back(request, "reconcile");
  if (!lead.setup || !ACTIVATABLE_LEAD_STATUSES.has(lead.status)) {
    return back(request, "not-ready");
  }
  const form = await request.formData().catch(() => null);
  if (!form) return back(request, "invalid-area-code");
  if (validateSetupPayload(lead.setup)) return back(request, "not-ready");
  const prepared = isPreparedLead(lead);
  if (lead.flowVersion === 2 && form.get("reviewConfirmed") !== "yes")
    return back(request, "not-ready");
  if (prepared && form.get("readinessConfirmed") !== "yes") return back(request, "not-ready");
  if (prepared) {
    const shop = lead.shopId ? await getShop(cfEnv, lead.shopId) : null;
    if (
      !shop ||
      shop.status !== "suspended" ||
      shop.account_id !== lead.accountId ||
      shop.twilio_number !== lead.assignedNumber
    )
      return back(request, "reconcile");
    if (lead.setup.calendar === "google_calendar") {
      const health = await voiceAgentFetch(cfEnv, `/admin/shops/${lead.shopId}/calendar-check`);
      if (!health?.ok) {
        let reason = "Calendar access could not be verified";
        if (health) {
          const body = (await health.json().catch(() => null)) as { error?: unknown } | null;
          if (typeof body?.error === "string" && body.error.trim()) reason = body.error.trim();
        }
        lead.provisionError = `Calendar check failed: ${reason}`;
        await putLead(cfEnv.LEADS_KV, lead).catch(() => {});
        return back(request, "calendar-not-ready");
      }
    }
  }
  const rawAreaCode = form.get("areaCodeOverride");
  if (rawAreaCode !== null && typeof rawAreaCode !== "string") {
    return back(request, "invalid-area-code");
  }
  const areaCodeOverride = rawAreaCode?.trim() || undefined;
  if (areaCodeOverride && !isUsAreaCode(areaCodeOverride)) {
    return back(request, "invalid-area-code");
  }
  // Re-check billing immediately before the first external side effect. A customer can cancel in
  // the gap between setup and manual review; webhook delivery must not be the only thing stopping
  // us from buying them a number afterward.
  if (!cfEnv.STRIPE_SECRET_KEY || !lead.stripeSubscriptionId) {
    return back(request, "billing-inactive");
  }
  const subscription = await getSubscription(cfEnv.STRIPE_SECRET_KEY, lead.stripeSubscriptionId);
  // Review-stage preparation buys a number. Never buy one for a customer whose trial is already
  // past due or set to cancel, even though those states can be eligible for legacy upgrades.
  const billingReady =
    lead.flowVersion === 2
      ? !!subscription &&
        (subscription.status === "trialing" || subscription.status === "active") &&
        !subscription.cancel_at_period_end
      : !!subscription && UPGRADABLE_STATUSES.has(subscription.status ?? "");
  if (!billingReady) {
    return back(request, "billing-inactive");
  }

  const lockToken = crypto.randomUUID();
  let acquired = false;
  try {
    acquired = await acquireActivationLock(cfEnv.OUTREACH_DB, lead.id, lockToken);
  } catch (error) {
    await notifyTeam(cfEnv, `🛑 Activation lock unavailable: ${lead.basics.businessName}`, {
      leadId: lead.id,
      error: error instanceof Error ? error.message : "activation lock unavailable",
    });
    return back(request, "lock-unavailable");
  }
  if (!acquired) return back(request, "in-progress");

  const latest = await getLead(cfEnv.LEADS_KV, lead.id);
  if (!latest || latest.status !== lead.status || latest.preparedAt !== lead.preparedAt) {
    await releaseActivationLock(cfEnv.OUTREACH_DB, lead.id, lockToken);
    return back(request, "not-ready");
  }
  lead.status = "activating";
  lead.activationStartedAt = new Date().toISOString();
  lead.activationLockToken = lockToken;
  lead.activationFailedAt = undefined;
  lead.provisionError = undefined;
  lead.activationAreaCodeOverride = areaCodeOverride;
  try {
    await putLead(cfEnv.LEADS_KV, lead);
  } catch {
    // No external resource exists yet, so this claim can safely be returned.
    await releaseActivationLock(cfEnv.OUTREACH_DB, lead.id, lockToken).catch(() => {});
    return back(request, "failed");
  }

  try {
    const result = prepared
      ? {
          ok: await patchShop(cfEnv, lead.shopId as string, { status: "active" }),
          shopId: lead.shopId,
          number: lead.assignedNumber,
          numberSid: lead.twilioNumberSid,
          cleanupComplete: false,
          reason: "prepared shop activation failed",
        }
      : await provisionLead(cfEnv, lead, {
          activate: lead.flowVersion !== 2,
          sendWelcome: false,
          areaCodeOverride,
          checkpoint: async (resources) => {
            lead.assignedNumber = resources.number;
            lead.twilioNumberSid = resources.numberSid;
            if (resources.shopId) lead.shopId = resources.shopId;
            await putLead(cfEnv.LEADS_KV, lead);
          },
        });
    if (!result.ok) {
      lead.status = "activation_failed";
      lead.activationFailedAt = new Date().toISOString();
      lead.provisionError = result.reason ?? "activation failed";
      // A retry is only safe when provisioning proved that every side effect was rolled back.
      if (result.cleanupComplete) {
        lead.activationStartedAt = undefined;
        lead.shopId = undefined;
        lead.assignedNumber = undefined;
        lead.twilioNumberSid = undefined;
      } else {
        // Keep enough identity for the operator (and deprovisionLead) to reconcile a resource whose
        // automatic rollback failed. Losing the SID here would leave a paid Twilio number orphaned.
        lead.shopId = result.shopId ?? lead.shopId;
        lead.assignedNumber = result.number ?? lead.assignedNumber;
        lead.twilioNumberSid = result.numberSid ?? lead.twilioNumberSid;
      }
      await putLead(cfEnv.LEADS_KV, lead);
      if (result.cleanupComplete) {
        try {
          await releaseActivationLock(cfEnv.OUTREACH_DB, lead.id, lockToken);
          lead.activationLockToken = undefined;
          await putLead(cfEnv.LEADS_KV, lead);
        } catch (error) {
          await notifyTeam(
            cfEnv,
            `🛑 Activation lock cleanup failed: ${lead.basics.businessName}`,
            {
              leadId: lead.id,
              error: error instanceof Error ? error.message : "activation lock cleanup failed",
            },
          );
          return back(request, "reconcile");
        }
      }
      return back(request, result.cleanupComplete ? "failed" : "reconcile");
    }

    if (lead.flowVersion === 2 && !prepared) {
      lead.status = "pending_review";
      lead.shopId = result.shopId;
      lead.assignedNumber = result.number;
      lead.twilioNumberSid = result.numberSid;
      lead.preparedAt = new Date().toISOString();
      lead.activationStartedAt = undefined;
      lead.provisionError = undefined;
      // Persist resources before releasing the mutation lock. A failed write remains blocked.
      await putLead(cfEnv.LEADS_KV, lead);
      await releaseActivationLock(cfEnv.OUTREACH_DB, lead.id, lockToken);
      lead.activationLockToken = undefined;
      await putLead(cfEnv.LEADS_KV, lead);
      return back(request, "prepared");
    }
    if (prepared) lead.readinessReviewedAt = new Date().toISOString();
    lead.status = "provisioned";
    lead.shopId = result.shopId;
    lead.assignedNumber = result.number;
    lead.twilioNumberSid = result.numberSid;
    lead.provisionedAt = new Date().toISOString();
    lead.provisionError = undefined;
    // Persisting the live resources is the critical operation. A notification failure must not turn
    // a successfully recorded activation into activation_failed.
    await putLead(cfEnv.LEADS_KV, lead);
    await notifyTeam(
      cfEnv,
      `✅ Activated ${lead.basics.businessName} → ${result.number}`,
      lead,
    ).catch((error) => console.error("[activation] success notification failed", error));
    await billAdditionalLocation(cfEnv, lead);
    await sendProvisionedWelcome(cfEnv, lead, result);
    return back(request, "activated");
  } catch (error) {
    // Unknown failures after activationStartedAt are deliberately not retryable. The operator must
    // reconcile Stripe/Twilio/shop state before clearing the marker, or a retry could buy a second
    // number after the first attempt actually succeeded.
    lead.status = "activation_failed";
    lead.activationFailedAt = new Date().toISOString();
    lead.provisionError = error instanceof Error ? error.message : "activation failed";
    // Both paths must be attempted. The common failure here is the success-state KV write above;
    // retrying the same write may fail too, but the team still needs the external resource ids.
    const [alerted, persisted] = await Promise.allSettled([
      notifyTeam(cfEnv, `🛑 Activation needs reconciliation: ${lead.basics.businessName}`, lead),
      putLead(cfEnv.LEADS_KV, lead),
    ]);
    if (alerted.status === "rejected") {
      console.error("[activation] reconciliation notification failed", alerted.reason);
    }
    if (persisted.status === "rejected") {
      console.error("[activation] reconciliation state write failed", persisted.reason);
    }
    return back(request, "reconcile");
  }
}
