import type { GoogleIdentity } from "@/lib/googleLogin";
import type { Locale } from "@/lib/i18n/dict";
import { getLead, putLead } from "@/lib/leads";
import { notifyTeam } from "@/lib/notify";
import { type PortalEnv, createAccount, findAccountByEmail, patchAccount } from "@/lib/portalApi";
import { createSession } from "@/lib/session";
import { checkoutSettled, getCheckoutSession } from "@/lib/stripe";

export type ClaimResult =
  | { ok: true; portalSessionId: string; locale?: Locale }
  | { ok: false; error: string; locale?: Locale };

// Binds the Google identity to the paid checkout by session_id, not by email — so a client who paid
// with a non-Google address still lands on the right lead. An unsettled session never mints an
// account: the cs_… is verified against Stripe before anything is written.
export async function claimCheckoutSession(
  env: PortalEnv,
  identity: GoogleIdentity,
  sessionId: string,
): Promise<ClaimResult> {
  if (!env.STRIPE_SECRET_KEY) return { ok: false, error: "not_configured" };

  const session = await getCheckoutSession(env.STRIPE_SECRET_KEY, sessionId);
  if (!session || !checkoutSettled(session)) return { ok: false, error: "unpaid_session" };

  const leadId = session.metadata?.lead_id;
  const lead = leadId ? await getLead(env.LEADS_KV, leadId) : null;
  const locale = lead?.locale;

  let account = await findAccountByEmail(env, identity.email);

  // The lead is already owned by a different account — refuse rather than bind a second one. Since
  // the gate keys accounts on the Google identity (not the order email), knowing the cs_… is all it
  // takes to reach here; claimedAccountId is the single owner of record, so anyone else is turned
  // away with an alert instead of quietly getting portal access to a paid lead.
  if (lead?.claimedAccountId && lead.claimedAccountId !== account?.id) {
    await notifyTeam(env, "⚠️ Google gate: a second account tried to claim a taken lead", {
      email: identity.email,
      leadId,
      claimedAccountId: lead.claimedAccountId,
      attemptedAccountId: account?.id ?? "(no account)",
    });
    return { ok: false, error: "already_claimed", locale };
  }

  if (!account) {
    account = await createAccount(env, {
      email: identity.email,
      ...(leadId ? { lead_id: leadId } : {}),
    });
    if (!account) return { ok: false, error: "account_failed", locale };
  } else if (leadId && account.lead_id && account.lead_id !== leadId) {
    // This Google account already owns another checkout: never repoint it. Sign the client into the
    // account they already have and leave the two leads for the team to reconcile.
    await notifyTeam(env, "⚠️ Google gate: account claimed by a second lead", {
      email: identity.email,
      existingLeadId: account.lead_id,
      attemptedLeadId: leadId,
    });
  } else if (leadId && !account.lead_id) {
    const patched = await patchAccount(env, account.id, { lead_id: leadId });
    if (patched) account = patched;
  }

  const updated = await patchAccount(env, account.id, {
    google_sub: identity.sub,
    last_login_at: new Date().toISOString(),
  });
  if (updated) account = updated;

  if (lead) {
    lead.claimedAt = lead.claimedAt ?? new Date().toISOString();
    // Provisioning attaches the shop to this account, not one keyed on the order email — the two
    // emails differ whenever the client signs in with a non-order Google address.
    lead.claimedAccountId = account.id;
    await putLead(env.LEADS_KV, lead);
  }

  const portalSessionId = await createSession(env.RATE_LIMIT_KV, {
    accountId: account.id,
    email: account.email,
    shopId: account.shop_id ?? undefined,
    leadId: account.lead_id ?? undefined,
  });
  if (!portalSessionId) return { ok: false, error: "session_failed", locale };

  return { ok: true, portalSessionId, locale };
}
