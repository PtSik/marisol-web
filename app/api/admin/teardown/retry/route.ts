import { env } from "cloudflare:workers";
import { ADMIN_COOKIE, isAdminCookieValid } from "@/lib/adminAuth";
import {
  type CancellationEnv,
  enqueueResourceCancellation,
  enqueueSubscriptionCancellation,
} from "@/lib/cancellation";
import { getLeadStrict } from "@/lib/leads";
import { resolveTeardown, retryTeardown } from "@/lib/teardownQueue";
import { cookies } from "next/headers";

export async function POST(request: Request): Promise<Response> {
  const cfEnv = env as unknown as CancellationEnv & { ADMIN_DASH_KEY?: string };
  const jar = await cookies();
  if (!(await isAdminCookieValid(jar.get(ADMIN_COOKIE)?.value, cfEnv.ADMIN_DASH_KEY))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const form = await request.formData();
  const leadId = form.get("leadId");
  if (typeof leadId === "string" && leadId) {
    const lead = await getLeadStrict(cfEnv.LEADS_KV, leadId);
    if (!lead || lead.status !== "cancellation_pending")
      return Response.json({ error: "lead is not awaiting cleanup" }, { status: 409 });
    if (!lead.additionalLocation && lead.stripeSubscriptionId) {
      await enqueueSubscriptionCancellation(cfEnv, {
        leadId: lead.id,
        subscriptionId: lead.stripeSubscriptionId,
        reason: "Resume pending cancellation",
      });
    } else {
      await enqueueResourceCancellation(cfEnv, {
        leadId: lead.id,
        shopId: lead.shopId,
        number: lead.assignedNumber,
        numberSid: lead.twilioNumberSid,
        reason: "Resume pending cancellation",
      });
    }
    return Response.redirect(new URL("/admin", request.url), 303);
  }
  const id = form.get("id");
  if (typeof id !== "string" || !id)
    return Response.json({ error: "missing job" }, { status: 400 });
  if (form.get("action") === "resolve") {
    const note = form.get("note");
    if (typeof note !== "string" || !note.trim() || form.get("confirmed") !== "yes")
      return Response.json(
        { error: "Confirm manual cleanup and provide a resolution note" },
        { status: 400 },
      );
    await resolveTeardown(cfEnv.OUTREACH_DB, id, note);
  } else {
    await retryTeardown(cfEnv.OUTREACH_DB, id);
  }
  return Response.redirect(new URL("/admin", request.url), 303);
}
