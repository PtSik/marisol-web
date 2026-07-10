import type { CheckoutLead } from "@/lib/leads";
import type { ForwardMode } from "@/lib/onboarding";
import { CUSTOMER_PORTAL_URL } from "@/lib/site";

export interface NotifyEnv {
  RESEND_API_KEY?: string;
  LEAD_NOTIFY_EMAIL?: string;
  RESEND_FROM?: string;
  CLIENT_EMAIL_FROM?: string;
  GCAL_SHARE_EMAIL?: string;
}

async function sendEmail(
  apiKey: string,
  from: string,
  to: string,
  subject: string,
  body: { text?: string; html?: string },
): Promise<void> {
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to: [to], subject, ...body }),
  }).catch(() => {});
}

export async function notifyTeam(
  { RESEND_API_KEY, LEAD_NOTIFY_EMAIL, RESEND_FROM }: NotifyEnv,
  subject: string,
  payload: unknown,
): Promise<void> {
  if (!RESEND_API_KEY || !LEAD_NOTIFY_EMAIL) return;
  const text = typeof payload === "string" ? payload : JSON.stringify(payload, null, 2);
  await sendEmail(
    RESEND_API_KEY,
    RESEND_FROM ?? "Marisol Leads <leads@getmarisol.com>",
    LEAD_NOTIFY_EMAIL,
    subject,
    { text },
  );
}

export async function sendProvisionAlert(
  env: NotifyEnv,
  lead: CheckoutLead,
  reason: string,
): Promise<void> {
  await notifyTeam(env, `⚠️ Provisioning failed (${reason}): ${lead.basics.businessName}`, {
    reason,
    lead,
  });
}

function forwardInstructions(mode: ForwardMode, dialable: string): string {
  const help = `<p style="margin:10px 0 0;color:#6F6457;font-size:13px">Forwarding codes differ between carriers — if these don't work, just reply and we'll set it up with you in a couple of minutes.</p>`;
  if (mode === "all") {
    return `Send <strong>every call</strong> straight to Marisol so she answers first:
<ul style="margin:8px 0 0;padding-left:20px">
<li><strong>Landline / desk phone:</strong> dial <strong>*72</strong>, then <strong>${dialable}</strong>, then call — you'll hear a confirmation tone.</li>
<li><strong>Mobile:</strong> dial <strong>**21*${dialable}#</strong> and press call.</li>
</ul>
<p style="margin:8px 0 0;font-size:13px;color:#6F6457">To turn it off later: <strong>*73</strong> (landline) or <strong>##21#</strong> (mobile).</p>${help}`;
  }
  return `Send calls to Marisol <strong>only when you can't pick up</strong> (busy or no answer) — you still answer first whenever you're free:
<ul style="margin:8px 0 0;padding-left:20px">
<li><strong>Landline / desk phone:</strong> dial <strong>*71</strong>, then <strong>${dialable}</strong>, then call.</li>
<li><strong>Mobile:</strong> dial <strong>**61*${dialable}#</strong> (no answer) and <strong>**67*${dialable}#</strong> (busy), pressing call after each.</li>
</ul>
<p style="margin:8px 0 0;font-size:13px;color:#6F6457">To turn it off later: <strong>*73</strong> (landline) or <strong>##002#</strong> (mobile).</p>${help}`;
}

export interface ClientWelcome {
  email: string;
  businessName: string;
  ownerName: string;
  twilioNumber: string;
  forwardMode: ForwardMode;
  calendarConnectUrl?: string;
}

export async function sendClientWelcome(env: NotifyEnv, w: ClientWelcome): Promise<void> {
  const { RESEND_API_KEY, CLIENT_EMAIL_FROM, RESEND_FROM } = env;
  if (!RESEND_API_KEY) return;
  const from = CLIENT_EMAIL_FROM ?? RESEND_FROM ?? "Marisol <hello@getmarisol.com>";
  const firstName = w.ownerName.trim().split(/\s+/)[0] || "there";

  const calendarStep = w.calendarConnectUrl
    ? `<p style="margin:0">Marisol can book appointments straight into your Google Calendar — connect it in one click:</p>
<p style="margin:12px 0 0"><a href="${w.calendarConnectUrl}" style="display:inline-block;background:#4F8C80;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600;font-size:15px">Connect Google Calendar</a></p>
<p style="font-size:13px;color:#6F6457;margin:10px 0 0">Takes a few seconds on your phone or computer. Until you connect it, Marisol still answers every call, takes the details, and texts them to you.</p>`
    : `<p style="margin:0">Marisol can drop every booking straight into your Google Calendar. Reply to this email and we'll walk you through it. Until then Marisol still answers every call, takes the details, and texts them to you.</p>`;

  const portalLink = CUSTOMER_PORTAL_URL
    ? `<p style="margin:24px 0 0;font-size:13px;color:#6F6457">Manage your subscription anytime in the <a href="${CUSTOMER_PORTAL_URL}" style="color:#4F8C80">billing portal</a>.</p>`
    : "";

  const html = `<div style="font-family:Inter,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;color:#241B14;line-height:1.55">
  <p style="font-size:16px">Hi ${firstName},</p>
  <p style="font-size:16px">Marisol is set up for <strong>${w.businessName}</strong> and ready to answer your calls 24/7.</p>
  <div style="background:#F6EFE6;border-radius:12px;padding:20px 24px;margin:20px 0">
    <p style="margin:0;font-size:13px;color:#6F6457;text-transform:uppercase;letter-spacing:.04em">Your Marisol number</p>
    <p style="margin:6px 0 0;font-size:24px;font-weight:600">${w.twilioNumber}</p>
  </div>
  <p style="font-size:16px;font-weight:600;margin:24px 0 4px">1. Forward your calls</p>
  <div style="font-size:15px">${forwardInstructions(w.forwardMode, w.twilioNumber.replace(/\D/g, ""))}</div>
  <p style="font-size:16px;font-weight:600;margin:24px 0 4px">2. Connect your calendar</p>
  <div style="font-size:15px">${calendarStep}</div>
  ${portalLink}
  <p style="font-size:15px;margin:24px 0 0">Questions? Just reply — we're here to help.</p>
</div>`;

  await sendEmail(RESEND_API_KEY, from, w.email, `Marisol is live for ${w.businessName} 🎉`, {
    html,
  });
}
