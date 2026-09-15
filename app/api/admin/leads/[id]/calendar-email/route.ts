import { env } from "cloudflare:workers";
import { ADMIN_COOKIE, isAdminCookieValid } from "@/lib/adminAuth";
import { getLead, isPreparedLead, putLead } from "@/lib/leads";
import { sendCalendarInvite } from "@/lib/notify";
import { buildCalendarConnectUrl } from "@/lib/provisioning";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

interface CalendarEmailEnv {
  LEADS_KV?: KVNamespace;
  ADMIN_DASH_KEY?: string;
  VOICE_AGENT_API?: Fetcher;
  VOICE_AGENT_API_URL?: string;
  ADMIN_API_KEY?: string;
  RESEND_API_KEY?: string;
  RESEND_FROM?: string;
  CLIENT_EMAIL_FROM?: string;
}

function back(request: Request, status: string): Response {
  const url = new URL("/admin", request.url);
  url.searchParams.set("calendar", status);
  return Response.redirect(url.toString(), 303);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const cfEnv = env as unknown as CalendarEmailEnv;
  const jar = await cookies();
  if (!(await isAdminCookieValid(jar.get(ADMIN_COOKIE)?.value, cfEnv.ADMIN_DASH_KEY))) {
    return Response.redirect(new URL("/admin?error=1", request.url).toString(), 303);
  }

  const { id } = await params;
  const lead = await getLead(cfEnv.LEADS_KV, id);
  if (!lead?.shopId) return back(request, "missing");
  if (lead.status !== "provisioned" && !isPreparedLead(lead)) return back(request, "missing");
  const form = await request.formData();
  if (form.get("accessConfirmed") !== "yes") return back(request, "failed");
  const grantedAt = lead.calendarAccessGrantedAt ?? new Date().toISOString();
  lead.calendarAccessGrantedAt = grantedAt;
  await putLead(cfEnv.LEADS_KV, lead);
  if (lead.calendarEmailSentAt) return back(request, "already-sent");

  const calendarConnectUrl = await buildCalendarConnectUrl(cfEnv, lead.shopId);
  if (!calendarConnectUrl) return back(request, "failed");

  const sent = await sendCalendarInvite(cfEnv, {
    email: lead.basics.email,
    businessName: lead.basics.businessName,
    ownerName: lead.basics.ownerName,
    calendarConnectUrl,
  });
  if (!sent) return back(request, "send-failed");

  lead.calendarEmailSentAt = new Date().toISOString();
  await putLead(cfEnv.LEADS_KV, lead);
  return back(request, "sent");
}
