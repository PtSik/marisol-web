import { env } from "cloudflare:workers";
import { ForwardingCard } from "@/components/onboarding/ForwardingCard";
import { FunnelNav } from "@/components/onboarding/FunnelNav";
import { SetupForm } from "@/components/onboarding/SetupForm";
import { SetupCompleteHeading, ThanksHeading } from "@/components/onboarding/ThanksHeading";
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
import { getLead, isCancellationState, isWaitingForActivation } from "@/lib/leads";
import { VERTICAL_IDS, type Vertical } from "@/lib/onboarding";
import { TRIAL_DAYS } from "@/lib/plans";
import { type PortalEnv, getShop } from "@/lib/portalApi";
import { buildCalendarConnectUrl } from "@/lib/provisioning";
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

function ConflictNote({ name, t }: { name: string; t: Dict["thanks"] }) {
  return (
    <p className="mb-6 rounded-[14px] border border-gold/30 bg-gold/10 px-5 py-4 t-body-sm text-gold-ink">
      {t.gate.conflictBefore}
      <strong>{name}</strong>
      {t.gate.conflictAfter}
    </p>
  );
}

function Shell({
  locale,
  email,
  children,
}: { locale: Locale; email?: string; children: ReactNode }) {
  const home = LOCALE_PATH[locale];
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
  // And it has to be this account's own checkout — the setup API enforces the same rule. Checkouts
  // from before account-first onboarding carry no account_id and fall through to the conflict notice.
  const checkoutAccountId = session.metadata?.account_id;
  if (checkoutAccountId && checkoutAccountId !== portalSession.accountId) redirect("/portal");

  const leadId = session.metadata?.lead_id;
  let lead = leadId ? await getLead(LEADS_KV, leadId) : null;
  if (lead?.flowVersion === 2 && (lead.status === "created" || lead.status === "paid")) {
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

  if (lead?.flowVersion === 2 && isWaitingForActivation(lead.status)) {
    const cfEnv = env as unknown as ThanksEnv;
    const shop = lead.shopId ? await getShop(cfEnv, lead.shopId) : null;
    const connected =
      shop?.integration === "google_calendar" && Boolean(shop.calendar_routing?.write_calendar_id);
    const connectUrl =
      lead.shopId && lead.calendarAccessGrantedAt
        ? await buildCalendarConnectUrl(cfEnv, lead.shopId)
        : undefined;
    const es = locale === "es";
    return (
      <Shell locale={locale} email={email}>
        <ThanksHeading
          title={{
            before: es ? "Tu configuración está " : "Your setup is ",
            accent: es ? "en revisión" : "ready for review",
          }}
          lead={
            es
              ? "Tus datos están guardados. Marisol empezará a atender cuando terminemos las comprobaciones y activemos el servicio."
              : "Your details are saved. Marisol starts answering after we complete the checks and activate your service."
          }
        />
        <ol className="mt-8 space-y-4">
          <li className="rounded-2xl bg-cream-100 p-5">
            <h2 className="font-semibold">1. {es ? "Revisión del negocio" : "Business review"}</h2>
            <p className="mt-2 t-body-sm text-muted">
              {lead.preparedAt
                ? es
                  ? "Datos revisados. Número preparado; el teléfono sigue sin activarse."
                  : "Details reviewed. Your number is prepared; the phone is still inactive."
                : es
                  ? "Nuestro equipo está revisando tus servicios, horario, equipo y teléfonos."
                  : "Our team is checking your services, hours, team and phone numbers."}
            </p>
          </li>
          <li className="rounded-2xl bg-cream-100 p-5">
            <h2 className="font-semibold">
              2. {es ? "Calendario y citas existentes" : "Calendar and existing appointments"}
            </h2>
            <p className="mt-2 t-body-sm text-muted">
              {connected
                ? es
                  ? "Calendario conectado. Verificaremos las citas y las asignaciones contigo."
                  : "Calendar connected. We’ll verify existing appointments and staff assignments with you."
                : es
                  ? "Te ayudaremos a conectar tu calendario y comprobar las citas antes de activar el servicio."
                  : "We’ll help connect your calendar and check existing appointments before activation."}
            </p>
            {connectUrl && (
              <a className="btn btn-md btn-primary mt-4" href={connectUrl}>
                {connected
                  ? es
                    ? "Revisar calendarios"
                    : "Review calendars"
                  : es
                    ? "Conectar Google Calendar"
                    : "Connect Google Calendar"}
              </a>
            )}
          </li>
          <li className="rounded-2xl bg-cream-100 p-5">
            <h2 className="font-semibold">
              3. {es ? "Activación y prueba del teléfono" : "Activation and phone connection test"}
            </h2>
            <p className="mt-2 t-body-sm text-muted">
              {es
                ? "Después de verificar la configuración, activaremos Marisol y te guiaremos para conectar tu número y realizar una llamada de prueba."
                : "After the setup checks, we’ll activate Marisol and guide you through connecting your existing number and making a test call."}
            </p>
          </li>
        </ol>
        <p className="mt-5 t-body-sm text-muted">
          {es
            ? `Tu prueba de ${TRIAL_DAYS} días empieza al completar el pago, también durante la revisión.`
            : `Your ${TRIAL_DAYS}-day trial starts at checkout, including time spent in setup review.`}
        </p>
        <a
          href={`/onboarding/thanks?session_id=${encodeURIComponent(session.id)}${es ? "&lang=es" : ""}`}
          className="mt-4 inline-block t-body-sm text-teal underline"
        >
          {es ? "Actualizar estado" : "Refresh status"}
        </a>
        <ContactLine t={t} locale={locale} portal />
      </Shell>
    );
  }

  if (lead?.status && isWaitingForActivation(lead.status)) {
    return (
      <Shell locale={locale} email={email}>
        <SetupCompleteHeading t={t} />
        <NextSteps t={t} locale={locale} />
        <ContactLine t={t} locale={locale} portal />
      </Shell>
    );
  }

  if (lead?.status === "provisioned") {
    return (
      <Shell locale={locale} email={email}>
        <SetupCompleteHeading hasNumber={Boolean(lead.assignedNumber)} t={t} />
        {lead.assignedNumber && (
          <ForwardingCard
            twilioNumber={lead.assignedNumber}
            carrier={lead.setup?.carrier}
            t={getDict(locale).forwarding}
          />
        )}
        <a href="/portal" className="btn btn-lg btn-primary mx-auto mt-6 flex w-fit">
          {t.dashboardCta}
        </a>
        <NextSteps t={t} locale={locale} />
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
    <Shell locale={locale} email={email}>
      {conflictName && <ConflictNote name={conflictName} t={t} />}
      <SetupForm
        sessionId={session_id}
        vertical={vertical}
        locale={locale}
        completionContent={
          <>
            <NextSteps t={t} locale={locale} />
            <ContactLine t={t} locale={locale} portal />
          </>
        }
      />
    </Shell>
  );
}
