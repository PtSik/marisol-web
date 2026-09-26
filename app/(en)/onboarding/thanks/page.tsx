import { env } from "cloudflare:workers";
import { FunnelNav } from "@/components/onboarding/FunnelNav";
import { ThanksHeading } from "@/components/onboarding/ThanksHeading";
import { settleCheckout } from "@/lib/checkoutSettlement";
import {
  type Dict,
  LOCALE_PATH,
  type Locale,
  fill,
  getDict,
  onboardingHref,
  parseLocale,
} from "@/lib/i18n/dict";
import { getLead, isCancellationState } from "@/lib/leads";
import { TRIAL_DAYS } from "@/lib/plans";
import type { PortalEnv } from "@/lib/portalApi";
import { getSession, sessionIdFromCookies } from "@/lib/session";
import { CUSTOMER_PORTAL_URL, SALES_EMAIL_HREF, siteHref } from "@/lib/site";
import { SESSION_ID_RE, checkoutSettled, getCheckoutSession } from "@/lib/stripe";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

export const dynamic = "force-dynamic";

type ThanksProps = {
  searchParams: Promise<{ session_id?: string; lang?: string }>;
};

// The head takes its locale from `?lang` alone — resolving it from the lead would cost a second
// Stripe round trip, and Stripe returns here with the same `lang` the checkout was started in.
export async function generateMetadata({ searchParams }: ThanksProps) {
  const t = getDict(parseLocale((await searchParams).lang)).thanks;
  return { title: t.metaTitle, description: t.metaDescription };
}

interface ThanksEnv extends PortalEnv {
  STRIPE_SECRET_KEY?: string;
  LEADS_KV?: KVNamespace;
  RATE_LIMIT_KV?: KVNamespace;
}

function Shell({
  locale,
  email,
  children,
}: { locale: Locale; email?: string; children: ReactNode }) {
  return (
    // The route lives under the English layout, so the Spanish funnel marks its own language here.
    <div lang={locale}>
      <FunnelNav
        locale={locale}
        path="/onboarding/thanks"
        showLangSwitch={false}
        showSignOut={!!email}
      />
      <main className="mx-auto max-w-[720px] px-[22px] pb-[clamp(48px,7vw,88px)] pt-[clamp(40px,6vw,72px)]">
        {children}
      </main>
    </div>
  );
}

function ReferralNote({ t, locale }: { t: Dict["thanks"]; locale: Locale }) {
  return (
    <div className="mt-4 rounded-[16px] bg-ink px-[20px] py-[18px] text-cream">
      <p className="m-0 t-body-sm font-medium">{t.referralTitle}</p>
      <p className="m-0 mt-[6px] t-caption text-cream/[0.78]">
        {t.referralBody}{" "}
        <a
          href={siteHref(locale === "es" ? "/es/referrals" : "/referrals")}
          className="font-medium text-cream underline"
        >
          {t.referralLink}
        </a>
        .
      </p>
    </div>
  );
}

function NextSteps({ t, locale }: { t: Dict["thanks"]; locale: Locale }) {
  return (
    <>
      <ol className="mt-9 flex flex-col gap-3">
        {t.steps.map((step, i) => (
          <li
            key={step.title}
            className="flex items-start gap-[14px] rounded-[16px] bg-cream-100 px-[18px] py-4"
          >
            <span className="flex h-[28px] w-[28px] flex-none items-center justify-center rounded-full bg-ink t-caption font-semibold text-cream">
              {i + 1}
            </span>
            <span>
              <span className="block t-body-sm font-medium">{step.title}</span>
              <span className="mt-[2px] block t-caption text-muted">{step.desc}</span>
            </span>
          </li>
        ))}
      </ol>
      <ReferralNote t={t} locale={locale} />
    </>
  );
}

function ContactLine({
  t,
  locale,
  portal = false,
}: { t: Dict["thanks"]; locale: Locale; portal?: boolean }) {
  return (
    <p className="mt-8 text-center t-body-sm text-muted">
      {t.contactIntro}
      <a href={SALES_EMAIL_HREF} className="font-medium text-teal">
        {t.contactEmail}
      </a>
      {t.contactMiddle}
      <a href={siteHref(LOCALE_PATH[locale])} className="font-medium text-teal">
        {t.contactBack}
      </a>
      .
      {portal && CUSTOMER_PORTAL_URL && (
        <>
          {t.portalBefore}
          <a href={CUSTOMER_PORTAL_URL} className="font-medium text-teal">
            {t.portalLink}
          </a>
          .
        </>
      )}
    </p>
  );
}

function SessionNotFound({
  t,
  locale,
  email,
}: { t: Dict["thanks"]; locale: Locale; email?: string }) {
  return (
    <Shell locale={locale} email={email}>
      <div className="text-center">
        <h1 className="mx-auto max-w-[24ch] font-display t-h2 font-bold text-balance">
          {t.notFoundTitle}
        </h1>
        <p className="mx-auto mt-[14px] max-w-[44ch] t-body text-muted">{t.notFoundLead}</p>
        <a href={onboardingHref(locale)} className="btn btn-lg btn-primary mt-7">
          {t.notFoundCta}
        </a>
      </div>
      <ContactLine t={t} locale={locale} />
    </Shell>
  );
}

export default async function ThanksPage({ searchParams }: ThanksProps) {
  const { session_id, lang } = await searchParams;
  const { STRIPE_SECRET_KEY, LEADS_KV, RATE_LIMIT_KV } = env as unknown as ThanksEnv;

  // Before the session is known the query is all we have; from there the lead and Stripe metadata win.
  let locale = parseLocale(lang);
  let t = getDict(locale).thanks;

  // Resolved up front only so every branch can offer a way out: this page is where a failed
  // provisioning run strands people, and until now none of these states had a sign-out.
  const portalSession = await getSession(RATE_LIMIT_KV, await sessionIdFromCookies());
  const email = portalSession?.email;

  if (!STRIPE_SECRET_KEY) {
    return (
      <Shell locale={locale} email={email}>
        <ThanksHeading title={t.startedTitle} lead={fill(t.startedLead, { days: TRIAL_DAYS })} />
        <NextSteps t={t} locale={locale} />
        <ContactLine t={t} locale={locale} />
      </Shell>
    );
  }

  if (!session_id || !SESSION_ID_RE.test(session_id)) {
    return <SessionNotFound t={t} locale={locale} email={email} />;
  }

  const session = await getCheckoutSession(STRIPE_SECRET_KEY, session_id);
  if (!session) {
    return <SessionNotFound t={t} locale={locale} email={email} />;
  }

  locale = parseLocale(session.metadata?.locale);
  t = getDict(locale).thanks;

  if (!checkoutSettled(session)) {
    return (
      <Shell locale={locale} email={email}>
        <div className="text-center">
          <h1 className="mx-auto max-w-[22ch] font-display t-h2 font-bold text-balance">
            {t.processingTitle}
          </h1>
          <p className="mx-auto mt-[14px] max-w-[44ch] t-body text-muted">{t.processingLead}</p>
        </div>
        <ContactLine t={t} locale={locale} />
      </Shell>
    );
  }

  // First-salon setup is a logged-in-only flow: an account already exists by the time checkout
  // happens, so a stranger with a stale link gets sent to sign in rather than shown the lead.
  if (!portalSession) redirect("/login");
  // And it has to be this account's own checkout, the same rule the portal enforces.
  const checkoutAccountId = session.metadata?.account_id;
  if (checkoutAccountId && checkoutAccountId !== portalSession.accountId) redirect("/portal");

  const leadId = session.metadata?.lead_id;
  let lead = leadId ? await getLead(LEADS_KV, leadId) : null;
  if (lead?.status === "created") {
    lead = await settleCheckout(LEADS_KV, session);
  }
  if (lead?.locale) {
    locale = lead.locale;
    t = getDict(locale).thanks;
  }

  if (lead?.status && isCancellationState(lead.status)) {
    const pending = lead.status === "cancellation_pending";
    return (
      <Shell locale={locale} email={email}>
        <ThanksHeading
          title={pending ? t.cancellationPendingTitle : t.cancelledTitle}
          lead={pending ? t.cancellationPendingLead : t.cancelledLead}
        />
        <form method="post" action="/api/portal/billing-portal" className="mt-7 text-center">
          <button type="submit" className="btn btn-lg btn-primary">
            {t.cancellationBillingCta}
          </button>
        </form>
        <ContactLine t={t} locale={locale} />
      </Shell>
    );
  }

  // Checkout is the last onboarding-owned screen. Once Stripe has settled the subscription,
  // account status belongs in the portal so the client always has Overview, Calendar and Billing.
  redirect("/portal");
}
