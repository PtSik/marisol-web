import { type Segment, forwardingInstructions } from "@/lib/forwarding";
import { en } from "@/lib/i18n/en";
import type { CheckoutLead } from "@/lib/leads";
import type { DayId, ForwardMode, ServiceEntry, SetupDetails, WeekHours } from "@/lib/onboarding";
import { SITE_URL } from "@/lib/site";

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
): Promise<boolean> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to: [to], subject, ...body }),
  }).catch(() => null);
  return res?.ok ?? false;
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

function formatStaff(setup: SetupDetails): string {
  return setup.staff
    .filter((m) => m.name.trim())
    .map((m) =>
      setup.staffCustomHours && m.hours
        ? `${m.name.trim()} (${formatHours(m.hours)})`
        : m.name.trim(),
    )
    .join(", ");
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
          ["Staff", formatStaff(setup)],
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

function renderSegments(parts: Segment[]): string {
  return parts
    .map((part) => (typeof part === "string" ? esc(part) : `<strong>${esc(part.code)}</strong>`))
    .join("");
}

function forwardInstructions(mode: ForwardMode, twilioNumber: string): string {
  const { intro, steps, turnOff } = forwardingInstructions(mode, twilioNumber, en.forwarding);
  const items = steps
    .map((step) => `<li><strong>${esc(step.device)}:</strong> ${renderSegments(step.parts)}</li>`)
    .join("\n");
  return `${renderSegments(intro)}
<ul style="margin:8px 0 0;padding-left:20px">
${items}
</ul>
<p style="margin:8px 0 0;font-size:13px;color:#6F6457">${renderSegments(turnOff)}</p>
<p style="margin:10px 0 0;color:#6F6457;font-size:13px">Forwarding codes differ between carriers — if these don't work, just reply and we'll set it up with you in a couple of minutes.</p>`;
}

export interface ClientWelcome {
  email: string;
  businessName: string;
  ownerName: string;
  twilioNumber: string;
  forwardMode: ForwardMode;
}

function clientFrom({ CLIENT_EMAIL_FROM, RESEND_FROM }: NotifyEnv): string {
  return CLIENT_EMAIL_FROM ?? RESEND_FROM ?? "Marisol <hello@getmarisol.com>";
}

function firstNameOf(ownerName: string): string {
  return ownerName.trim().split(/\s+/)[0] || "there";
}

function portalFooter(): string {
  return `<p style="margin:24px 0 0;font-size:13px;color:#6F6457">Your hours, services, staff and billing live in <a href="${SITE_URL}/portal" style="color:#4F8C80">your portal</a> — sign in with Google whenever something changes.</p>`;
}

export async function sendClientWelcome(env: NotifyEnv, w: ClientWelcome): Promise<boolean> {
  const { RESEND_API_KEY } = env;
  if (!RESEND_API_KEY) return false;

  const html = `<div style="font-family:Inter,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;color:#241B14;line-height:1.55">
  <p style="font-size:16px">Hi ${esc(firstNameOf(w.ownerName))},</p>
  <p style="font-size:16px">Marisol is set up for <strong>${esc(w.businessName)}</strong> and ready to answer your calls 24/7.</p>
  <div style="background:#F6EFE6;border-radius:12px;padding:20px 24px;margin:20px 0">
    <p style="margin:0;font-size:13px;color:#6F6457;text-transform:uppercase;letter-spacing:.04em">Your Marisol number</p>
    <p style="margin:6px 0 0;font-size:24px;font-weight:600">${esc(w.twilioNumber)}</p>
  </div>
  <p style="font-size:16px;font-weight:600;margin:24px 0 4px">1. Forward your calls</p>
  <div style="font-size:15px">${forwardInstructions(w.forwardMode, w.twilioNumber)}</div>
  <p style="font-size:16px;font-weight:600;margin:24px 0 4px">2. Your calendar comes next</p>
  <div style="font-size:15px"><p style="margin:0">We'll email you a one-click link to connect your Google Calendar shortly. Until then Marisol still answers every call, takes the details, and texts them to you.</p></div>
  ${portalFooter()}
  <p style="font-size:15px;margin:24px 0 0">Questions? Just reply — we're here to help.</p>
</div>`;

  return sendEmail(
    RESEND_API_KEY,
    clientFrom(env),
    w.email,
    `Marisol is live for ${w.businessName} 🎉`,
    { html },
  );
}

export interface CalendarInvite {
  email: string;
  businessName: string;
  ownerName: string;
  calendarConnectUrl: string;
}

// Returns whether Resend accepted the mail — the admin action records the send only on success,
// so a failure leaves the button in place instead of silently swallowing the client's invite.
export async function sendCalendarInvite(env: NotifyEnv, c: CalendarInvite): Promise<boolean> {
  const { RESEND_API_KEY } = env;
  if (!RESEND_API_KEY) return false;

  const html = `<div style="font-family:Inter,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;color:#241B14;line-height:1.55">
  <p style="font-size:16px">Hi ${esc(firstNameOf(c.ownerName))},</p>
  <p style="font-size:16px">Marisol can book appointments straight into your Google Calendar — and read it so she never double-books you. Connect it in one click:</p>
  <p style="margin:20px 0 0"><a href="${c.calendarConnectUrl}" style="display:inline-block;background:#4F8C80;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600;font-size:15px">Connect Google Calendar</a></p>
  <p style="font-size:13px;color:#6F6457;margin:10px 0 0">Takes a few seconds on your phone or computer. Use the Google account whose calendar you book into.</p>
  ${portalFooter()}
  <p style="font-size:15px;margin:24px 0 0">Something not working? Just reply — we'll set it up with you.</p>
</div>`;

  return sendEmail(
    RESEND_API_KEY,
    clientFrom(env),
    c.email,
    `Connect your calendar to Marisol — ${c.businessName}`,
    { html },
  );
}

export interface VerificationEmail {
  email: string;
  verifyUrl: string;
}

export async function sendVerificationEmail(
  env: NotifyEnv,
  v: VerificationEmail,
): Promise<boolean> {
  const { RESEND_API_KEY } = env;
  if (!RESEND_API_KEY) return false;

  const html = `<div style="font-family:Inter,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;color:#241B14;line-height:1.55">
  <p style="font-size:16px">Welcome to Marisol!</p>
  <p style="font-size:16px">Confirm your email address to finish setting up your account.</p>
  <p style="margin:20px 0 0"><a href="${v.verifyUrl}" style="display:inline-block;background:#4F8C80;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600;font-size:15px">Verify email</a></p>
  <p style="font-size:13px;color:#6F6457;margin:10px 0 0">No rush — your account already works, this is just for your records.</p>
</div>`;

  return sendEmail(RESEND_API_KEY, clientFrom(env), v.email, "Verify your email for Marisol", {
    html,
  });
}

export interface PasswordResetEmail {
  email: string;
  resetUrl: string;
}

export async function sendPasswordResetEmail(
  env: NotifyEnv,
  r: PasswordResetEmail,
): Promise<boolean> {
  const { RESEND_API_KEY } = env;
  if (!RESEND_API_KEY) return false;

  const html = `<div style="font-family:Inter,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;color:#241B14;line-height:1.55">
  <p style="font-size:16px">Reset your Marisol password</p>
  <p style="font-size:16px">Click below to choose a new one. This link expires in 1 hour.</p>
  <p style="margin:20px 0 0"><a href="${r.resetUrl}" style="display:inline-block;background:#4F8C80;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600;font-size:15px">Reset password</a></p>
  <p style="font-size:13px;color:#6F6457;margin:10px 0 0">Didn't request this? You can safely ignore this email.</p>
</div>`;

  return sendEmail(RESEND_API_KEY, clientFrom(env), r.email, "Reset your Marisol password", {
    html,
  });
}
