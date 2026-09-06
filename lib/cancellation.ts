import { type CheckoutLead, getLeadStrict, putLead, shopLeadKey } from "@/lib/leads";
import { notifyTeam } from "@/lib/notify";
import { getShop, listAccountShopsStrict } from "@/lib/portalApi";
import { type ProvisioningEnv, deprovisionLead, deprovisionShop } from "@/lib/provisioning";
import {
  type TeardownJob,
  claimTeardown,
  enqueueTeardown,
  finishTeardown,
  teardownDb,
} from "@/lib/teardownQueue";

export interface CancellationEnv extends ProvisioningEnv {
  OUTREACH_DB?: D1Database;
}
export class UnresolvableTeardown extends Error {}

interface SubscriptionTask {
  leadId?: string;
  subscriptionId?: string;
  reason: string;
}
interface ResourceTask {
  leadId?: string;
  shopId?: string;
  number?: string;
  numberSid?: string;
  reason: string;
}

export async function enqueueSubscriptionCancellation(
  env: CancellationEnv,
  task: SubscriptionTask,
): Promise<void> {
  if (!task.subscriptionId) throw new Error("Cancellation is missing subscription identity");
  await enqueueTeardown(
    env.OUTREACH_DB,
    `subscription:${task.subscriptionId}`,
    "subscription",
    task,
  );
}

export async function enqueueResourceCancellation(
  env: CancellationEnv,
  task: ResourceTask,
): Promise<void> {
  const identity = task.shopId
    ? `shop:${task.shopId}`
    : task.numberSid
      ? `number:${task.numberSid}`
      : `lead:${task.leadId}`;
  await enqueueTeardown(env.OUTREACH_DB, identity, "resource", task);
}

async function markPending(env: CancellationEnv, lead: CheckoutLead): Promise<void> {
  if (lead.status === "cancelled") return;
  lead.status = "cancellation_pending";
  lead.cancellationPendingAt ??= new Date().toISOString();
  await putLead(env.LEADS_KV, lead);
}

// Discovery itself is durable: a temporary account-list outage must not lose extra locations.
async function discoverResources(env: CancellationEnv, task: SubscriptionTask): Promise<void> {
  if (!task.leadId)
    throw new UnresolvableTeardown("Subscription has no lead_id; manual reconciliation required");
  const primary = await getLeadStrict(env.LEADS_KV, task.leadId);
  if (!primary)
    throw new UnresolvableTeardown("Subscription lead is missing; manual reconciliation required");
  if (primary.stripeSubscriptionId && primary.stripeSubscriptionId !== task.subscriptionId) {
    throw new UnresolvableTeardown("Subscription identity changed; manual reconciliation required");
  }
  await markPending(env, primary);
  const shop = primary.shopId ? await getShop(env, primary.shopId) : null;
  if (primary.shopId && !shop) throw new Error("Primary shop lookup unavailable");
  // Persist the anchor before account listing so a discovery outage cannot strand its line.
  await enqueueResourceCancellation(env, {
    leadId: primary.id,
    shopId: primary.shopId,
    number: primary.assignedNumber ?? shop?.twilio_number,
    numberSid: primary.twilioNumberSid,
    reason: task.reason,
  });
  const accountId = primary.accountId ?? shop?.account_id;
  if (!accountId) return;
  const shops = await listAccountShopsStrict(env, accountId);
  if (!shops) throw new Error("Account salons lookup unavailable");
  for (const row of shops) {
    if (row.id === primary.shopId || row.status === "cancelled") continue;
    if (!env.LEADS_KV) throw new Error("LEADS_KV is not configured");
    const leadId = await env.LEADS_KV.get(shopLeadKey(row.id));
    const lead = leadId ? await getLeadStrict(env.LEADS_KV, leadId) : null;
    await enqueueResourceCancellation(env, {
      leadId: lead?.id,
      shopId: row.id,
      number: lead?.assignedNumber ?? row.twilio_number,
      numberSid: lead?.twilioNumberSid,
      reason: task.reason,
    });
    if (lead) await markPending(env, lead);
  }
}

async function cleanResource(env: CancellationEnv, task: ResourceTask): Promise<void> {
  const lead = task.leadId ? await getLeadStrict(env.LEADS_KV, task.leadId) : null;
  if (task.leadId && !lead)
    throw new UnresolvableTeardown("Resource lead is missing; manual reconciliation required");
  if (
    lead &&
    ((lead.shopId && lead.shopId !== task.shopId) ||
      (lead.twilioNumberSid && lead.twilioNumberSid !== task.numberSid))
  ) {
    throw new UnresolvableTeardown("Resource identity changed; manual reconciliation required");
  }
  if (task.shopId) {
    const shop = await getShop(env, task.shopId);
    if (!shop) throw new Error("Resource shop lookup unavailable");
    if (shop.twilio_number && shop.twilio_number !== task.number)
      throw new UnresolvableTeardown("Shop number changed; manual reconciliation required");
  }
  if (lead) await markPending(env, lead);
  const result = lead
    ? await deprovisionLead(env, {
        ...lead,
        shopId: task.shopId,
        assignedNumber: task.number,
        twilioNumberSid: task.numberSid,
      })
    : task.shopId
      ? await deprovisionShop(env, task.shopId, task.number)
      : null;
  if (!result?.complete) throw new Error(`Cleanup incomplete: ${JSON.stringify(result)}`);
  if (lead) {
    lead.status = "cancelled";
    lead.deprovisionedAt = new Date().toISOString();
    lead.cancellationPendingAt = undefined;
    await putLead(env.LEADS_KV, lead);
  }
}

export async function processCancellationJob(
  env: CancellationEnv,
  job: TeardownJob,
): Promise<void> {
  if (job.kind === "subscription") await discoverResources(env, JSON.parse(job.payload));
  else await cleanResource(env, JSON.parse(job.payload));
}

export async function runCancellationJobs(env: CancellationEnv, limit = 10): Promise<void> {
  const db = teardownDb(env.OUTREACH_DB);
  for (let i = 0; i < limit; i++) {
    const job = await claimTeardown(db);
    if (!job) return;
    let failure: string | undefined;
    let blocked = false;
    try {
      await processCancellationJob(env, job);
    } catch (error) {
      blocked = error instanceof UnresolvableTeardown;
      failure = error instanceof Error ? error.message : "Teardown failed";
    }
    await finishTeardown(db, job, failure, Date.now(), blocked);
    // Alert on entry to manual review, or exponentially spaced transient failures.
    const alertFailure = failure && (blocked || (job.attempts & (job.attempts - 1)) === 0);
    if (alertFailure || (!failure && job.kind === "resource")) {
      await notifyTeam(
        env,
        blocked
          ? "🛑 Teardown requires manual review"
          : failure
            ? "🛑 Teardown needs retry"
            : "✅ Teardown complete",
        {
          jobId: job.id,
          attempts: job.attempts,
          error: failure,
        },
      ).catch((error) => console.error("[teardown] notification failed", error));
    }
  }
}
