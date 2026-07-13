import type { CheckoutLead } from "@/lib/leads";
import type { DayId, ForwardMode, ServiceEntry, WeekHours } from "@/lib/onboarding";
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

function esc(value: unknown): string {
  return String(value).replace(
    /[&<>"']/g,
    (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch] as string,
  );
}

function section(title: string, rows: [string, unknown][]): string {
  const body = rows
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(
      ([k, v]) =>
        `<tr><td style="padding:3px 14px 3px 0;color:#6F6457;font-size:13px;white-space:nowrap;vertical-align:top">${esc(k)}</td><td style="padding:3px 0;font-size:14px">${esc(typeof v === "object" ? JSON.stringify(v) : v)}</td></tr>`,
    )
    .join("");
  if (!body) return "";
  return `<div style="background:#F6EFE6;border-radius:12px;padding:14px 18px;margin:10px 0"><p style="margin:0 0 6px;font-size:12px;color:#6F6457;text-transform:uppercase;letter-spacing:.04em">${esc(title)}</p><table style="border-collapse:collapse">${body}</table></div>`;
}

const DAY_ORDER: DayId[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

function formatHours(hours: WeekHours): string {
  return DAY_ORDER.map((d) => {
    const h = hours[d];
    const label = d[0].toUpperCase() + d.slice(1);
    return `${label} ${h.closed ? "closed" : `${h.open}–${h.close}`}`;
  }).join(" · ");
}

function formatServices(services: ServiceEntry[]): string {
  return services
    .filter((s) => s.name.trim())
    .map((s) => {
      const extra = [
        s.durationMin.trim() && `${s.durationMin} min`,
        s.price.trim() && `$${s.price}`,
      ]
        .filter(Boolean)
        .join(", ");
      return extra ? `${s.name} (${extra})` : s.name;
    })
    .join("; ");
}

function isCheckoutLead(payload: unknown): payload is CheckoutLead {
  return (
    typeof payload === "object" && payload !== null && "basics" in payload && "status" in payload
  );
}

function leadCard(lead: CheckoutLead): string {
  const { basics, setup } = lead;
  return [
    section("Business", [
      ["Name", basics.businessName],
      ["Vertical", basics.vertical],
      ["Owner", basics.ownerName],
      ["Email", basics.email],
      ["Business phone", basics.businessPhone],
      ["Owner mobile", basics.ownerMobile],
      ["Timezone", basics.timezone],
    ]),
    section("Plan", [
      ["Plan", lead.plan ?? "base"],
      ["Billing", lead.billing],
      ["Status", lead.status],
      ["Paid at", lead.paidAt],
    ]),
    setup
      ? section("Setup", [
          ["Hours", formatHours(setup.hours)],
          ["Services", formatServices(setup.services)],
          ["Staff", setup.staff.filter((m) => m.trim()).join(", ")],
          ["Calendar", setup.calendar],
          ["Forwarding", `${setup.forwardMode} · ${setup.forwardNumber}`],
          ["Notes", setup.notes],
        ])
      : "",
    lead.shopId || lead.assignedNumber || lead.provisionError
      ? section("Provisioning", [
          ["Marisol number", lead.assignedNumber],
          ["Shop ID", lead.shopId],
          ["Provisioned at", lead.provisionedAt],
          ["Error", lead.provisionError],
        ])
      : "",
  ].join("");
}

interface CallLeadPayload {
  intent: "call";
  createdAt?: string;
  call: {
    name?: string;
    email?: string;
    phone?: string;
    preferredTime?: string;
    question?: string;
  };
}

function isCallLead(payload: unknown): payload is CallLeadPayload {
  return (
    typeof payload === "object" &&
    payload !== null &&
    (payload as { intent?: unknown }).intent === "call" &&
    "call" in payload
  );
}

function renderPayload(payload: unknown): string {
  if (typeof payload === "string") return `<p style="font-size:15px">${esc(payload)}</p>`;
  if (isCallLead(payload)) {
    const c = payload.call;
    return section("Call request", [
      ["Name", c.name],
      ["Email", c.email],
      ["Phone", c.phone],
      ["Preferred time", c.preferredTime],
      ["Question", c.question],
      ["Received", payload.createdAt],
    ]);
  }
  if (isCheckoutLead(payload)) return leadCard(payload);
  if (typeof payload === "object" && payload !== null) {
    if ("reason" in payload && "lead" in payload && isCheckoutLead(payload.lead)) {
      const { reason, lead } = payload as { reason: unknown; lead: CheckoutLead };
      return `<div style="background:#FBEAE8;border:1px solid #E5B4AE;border-radius:12px;padding:12px 18px;margin:10px 0;color:#8C2B22;font-size:14px"><strong>Provisioning failed:</strong> ${esc(reason)}</div>${leadCard(lead)}`;
    }
    return section("Details", Object.entries(payload as Record<string, unknown>));
  }
  return `<p style="font-size:15px">${esc(payload)}</p>`;
}

export async function notifyTeam(
  { RESEND_API_KEY, LEAD_NOTIFY_EMAIL, RESEND_FROM }: NotifyEnv,
  subject: string,
  payload: unknown,
): Promise<void> {
  if (!RESEND_API_KEY || !LEAD_NOTIFY_EMAIL) return;
  const html = `<div style="font-family:Inter,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;color:#241B14;line-height:1.55"><p style="font-size:16px;font-weight:600;margin:0 0 4px">${esc(subject)}</p>${renderPayload(payload)}</div>`;
  await sendEmail(
    RESEND_API_KEY,
    RESEND_FROM ?? "Marisol Leads <leads@getmarisol.com>",
    LEAD_NOTIFY_EMAIL,
    subject,
    { html },
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
