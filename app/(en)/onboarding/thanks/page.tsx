import { env } from "cloudflare:workers";
import { LogoMark } from "@/components/Logo";
import { ForwardingCard } from "@/components/onboarding/ForwardingCard";
import { SetupForm } from "@/components/onboarding/SetupForm";
import { SetupCompleteHeading, ThanksHeading } from "@/components/onboarding/ThanksHeading";
import {
  type Dict,
  LOCALE_PATH,
  type Locale,
  fill,
  getDict,
  onboardingHref,
  parseLocale,
} from "@/lib/i18n/dict";
import { getLead } from "@/lib/leads";
import { VERTICAL_IDS, type Vertical } from "@/lib/onboarding";
import { TRIAL_DAYS } from "@/lib/plans";
import { getSession, sessionIdFromCookies } from "@/lib/session";
import { CUSTOMER_PORTAL_URL, SALES_EMAIL_HREF } from "@/lib/site";
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

interface ThanksEnv {
  STRIPE_SECRET_KEY?: string;
  LEADS_KV?: KVNamespace;
  RATE_LIMIT_KV?: KVNamespace;
}

function ConflictNote({ name, t }: { name: string; t: Dict["thanks"] }) {
  return (
    <p className="mb-6 rounded-[14px] border border-[#B97E24]/30 bg-[#B97E24]/10 px-5 py-4 text-[14px] leading-[1.55] text-[#8A5D17]">
      {t.gate.conflictBefore}
      <strong>{name}</strong>
      {t.gate.conflictAfter}
    </p>
  );
}

function Shell({ locale, children }: { locale: Locale; children: ReactNode }) {
  const home = LOCALE_PATH[locale];
  return (
    // The route lives under the English layout, so the Spanish funnel marks its own language here.
    <div lang={locale}>
      <nav className="mx-auto max-w-shell px-[22px] pt-[14px]">
        <div className="flex w-full items-center justify-between gap-5 rounded-[18px] border border-ink/10 bg-cream/80 px-5 py-3 backdrop-blur-md">
          <a
            href={home}
            className="flex items-center gap-[7px] font-display text-[22px] tracking-tight no-underline"
          >
            <LogoMark className="h-5 w-5 rounded-[3.5px]" />
            Marisol
          </a>
        </div>
      </nav>
      <main className="mx-auto max-w-[720px] px-[22px] pb-[clamp(48px,7vw,88px)] pt-[clamp(40px,6vw,72px)]">
        {children}
      </main>
    </div>
  );
}

function NextSteps({ t }: { t: Dict["thanks"] }) {
  return (
    <ol className="mt-9 flex flex-col gap-3">
      {t.steps.map((step, i) => (
        <li
          key={step.title}
          className="flex items-start gap-[14px] rounded-[16px] bg-cream-100 px-[18px] py-4"
        >
          <span className="flex h-[28px] w-[28px] flex-none items-center justify-center rounded-full bg-ink text-[13px] font-semibold text-cream">
            {i + 1}
          </span>
          <span>
            <span className="block text-[15px] font-medium">{step.title}</span>
            <span className="mt-[2px] block text-[13.5px] leading-[1.5] text-muted">
              {step.desc}
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}

function ContactLine({
  t,
  locale,
  portal = false,
}: { t: Dict["thanks"]; locale: Locale; portal?: boolean }) {
  return (
    <p className="mt-8 text-center text-[14px] text-muted">
      {t.contactIntro}
      <a href={SALES_EMAIL_HREF} className="font-medium text-teal">
        {t.contactEmail}
      </a>
      {t.contactMiddle}
      <a href={LOCALE_PATH[locale]} className="font-medium text-teal">
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

function SessionNotFound({ t, locale }: { t: Dict["thanks"]; locale: Locale }) {
  return (
    <Shell locale={locale}>
      <div className="text-center">
        <h1 className="mx-auto max-w-[24ch] font-display text-[clamp(28px,5vw,44px)] font-light leading-[1.08] tracking-[-0.03em]">
          {t.notFoundTitle}
        </h1>
        <p className="mx-auto mt-[14px] max-w-[44ch] text-[15.5px] leading-[1.55] text-muted">
          {t.notFoundLead}
        </p>
        <a
          href={onboardingHref(locale)}
          className="mt-7 inline-flex min-h-[50px] items-center justify-center rounded-[13px] bg-ink px-7 py-[14px] text-[15px] font-medium text-cream no-underline"
        >
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

  if (!STRIPE_SECRET_KEY) {
    return (
      <Shell locale={locale}>
        <ThanksHeading title={t.startedTitle} lead={fill(t.startedLead, { days: TRIAL_DAYS })} />
        <NextSteps t={t} />
        <ContactLine t={t} locale={locale} />
      </Shell>
    );
  }

  if (!session_id || !SESSION_ID_RE.test(session_id)) {
    return <SessionNotFound t={t} locale={locale} />;
  }

  const session = await getCheckoutSession(STRIPE_SECRET_KEY, session_id);
  if (!session) {
    return <SessionNotFound t={t} locale={locale} />;
  }

  locale = parseLocale(session.metadata?.locale);
  t = getDict(locale).thanks;

  if (!checkoutSettled(session)) {
    return (
      <Shell locale={locale}>
        <div className="text-center">
          <h1 className="mx-auto max-w-[22ch] font-display text-[clamp(28px,5vw,44px)] font-light leading-[1.08] tracking-[-0.03em]">
            {t.processingTitle}
          </h1>
          <p className="mx-auto mt-[14px] max-w-[44ch] text-[15.5px] leading-[1.55] text-muted">
            {t.processingLead}
          </p>
        </div>
        <ContactLine t={t} locale={locale} />
      </Shell>
    );
  }

  // First-salon setup is a logged-in-only flow: an account already exists by the time checkout
  // happens, so a stranger with a stale link gets sent to sign in rather than shown the lead.
  const portalSession = await getSession(RATE_LIMIT_KV, await sessionIdFromCookies());
  if (!portalSession) redirect("/login");
  // And it has to be this account's own checkout — the setup API enforces the same rule. Checkouts
  // from before account-first onboarding carry no account_id and fall through to the conflict notice.
  const checkoutAccountId = session.metadata?.account_id;
  if (checkoutAccountId && checkoutAccountId !== portalSession.accountId) redirect("/portal");

  const leadId = session.metadata?.lead_id;
  const lead = leadId ? await getLead(LEADS_KV, leadId) : null;
  if (lead?.locale) {
    locale = lead.locale;
    t = getDict(locale).thanks;
  }

  if (lead?.status === "setup_complete" || lead?.status === "provisioned") {
    return (
      <Shell locale={locale}>
        <SetupCompleteHeading hasNumber={Boolean(lead.assignedNumber)} t={t} />
        {lead.assignedNumber && (
          <ForwardingCard
            twilioNumber={lead.assignedNumber}
            forwardMode={lead.setup?.forwardMode ?? "conditional"}
            t={getDict(locale).forwarding}
          />
        )}
        <NextSteps t={t} />
        <ContactLine t={t} locale={locale} portal />
      </Shell>
    );
  }

  const metaVertical = session.metadata?.vertical;
  const vertical: Vertical = VERTICAL_IDS.includes(metaVertical as Vertical)
    ? (metaVertical as Vertical)
    : "barbershop";

  // Signed into a different lead's account than this checkout: keep the form, flag the mismatch.
  let conflictName: string | undefined;
  if (portalSession.leadId && leadId && portalSession.leadId !== leadId) {
    const otherLead = await getLead(LEADS_KV, portalSession.leadId);
    conflictName = otherLead?.basics.businessName;
  }

  return (
    <Shell locale={locale}>
      {conflictName && <ConflictNote name={conflictName} t={t} />}
      <SetupForm sessionId={session_id} vertical={vertical} locale={locale} />
      <NextSteps t={t} />
      <ContactLine t={t} locale={locale} portal />
    </Shell>
  );
}
