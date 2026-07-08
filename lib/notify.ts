export interface NotifyEnv {
  RESEND_API_KEY?: string;
  LEAD_NOTIFY_EMAIL?: string;
  RESEND_FROM?: string;
}

export async function notifyTeam(
  { RESEND_API_KEY, LEAD_NOTIFY_EMAIL, RESEND_FROM }: NotifyEnv,
  subject: string,
  payload: unknown,
): Promise<void> {
  if (!RESEND_API_KEY || !LEAD_NOTIFY_EMAIL) return;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: RESEND_FROM ?? "Marisol Leads <leads@getmarisol.com>",
      to: [LEAD_NOTIFY_EMAIL],
      subject,
      text: JSON.stringify(payload, null, 2),
    }),
  }).catch(() => {});
}
