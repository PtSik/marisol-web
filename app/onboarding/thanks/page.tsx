import { env } from "cloudflare:workers";
import { LogoMark } from "@/components/Logo";
import { SetupForm } from "@/components/onboarding/SetupForm";
import { getLead } from "@/lib/leads";
import { VERTICAL_IDS, type Vertical } from "@/lib/onboarding";
import { CUSTOMER_PORTAL_URL, SALES_EMAIL_HREF } from "@/lib/site";
import { SESSION_ID_RE, getCheckoutSession } from "@/lib/stripe";
import type { ReactNode } from "react";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "You're in — Kaijiro",
  description: "Payment received — finish your setup and your AI receptionist goes live.",
};

interface ThanksEnv {
  STRIPE_SECRET_KEY?: string;
  LEADS_KV?: KVNamespace;
}

const NEXT_STEPS = [
  {
    title: "We review your details",
    desc: "Services, hours, staff and voice — loaded and double-checked.",
  },
  {
    title: "You get forwarding instructions",
    desc: "A short email shows how to forward your current number. Takes about two minutes.",
  },
  {
    title: "Your receptionist goes live",
    desc: "We confirm everything sounds right — then every call gets answered.",
  },
];

function CheckIcon() {
  return (
    <span className="inline-flex h-[54px] w-[54px] items-center justify-center rounded-full bg-[#2C7A4B]/10">
      <svg
        width="26"
        height="26"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#2C7A4B"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </span>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <>
      <nav className="mx-auto max-w-shell px-[22px] pt-[14px]">
        <div className="flex w-full items-center justify-between gap-5 rounded-[18px] border border-ink/10 bg-cream/80 px-5 py-3 backdrop-blur-md">
          <a
            href="/"
            className="flex items-center gap-[7px] font-display text-[22px] tracking-tight no-underline"
          >
            <LogoMark className="h-5 w-5 rounded-[3.5px]" />
            Kaijiro
          </a>
        </div>
      </nav>
      <main className="mx-auto max-w-[720px] px-[22px] pb-[clamp(48px,7vw,88px)] pt-[clamp(40px,6vw,72px)]">
        {children}
      </main>
    </>
  );
}

function Heading({ title, lead }: { title: ReactNode; lead: string }) {
  return (
    <div className="text-center">
      <CheckIcon />
      <h1 className="mx-auto mt-5 max-w-[20ch] font-display text-[clamp(28px,5vw,44px)] font-light leading-[1.08] tracking-[-0.03em]">
        {title}
      </h1>
      <p className="mx-auto mt-[14px] max-w-[44ch] text-[15.5px] leading-[1.55] text-muted">
        {lead}
      </p>
    </div>
  );
}

function NextSteps() {
  return (
    <ol className="mt-9 flex flex-col gap-3">
      {NEXT_STEPS.map((step, i) => (
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

function ContactLine({ portal = false }: { portal?: boolean }) {
  return (
    <p className="mt-8 text-center text-[14px] text-muted">
      Questions in the meantime?{" "}
      <a href={SALES_EMAIL_HREF} className="font-medium text-teal">
        Email us
      </a>{" "}
      or head{" "}
      <a href="/" className="font-medium text-teal">
        back to the site
      </a>
      .
      {portal && CUSTOMER_PORTAL_URL && (
        <>
          {" "}
          You can manage or cancel your subscription anytime in the{" "}
          <a href={CUSTOMER_PORTAL_URL} className="font-medium text-teal">
            billing portal
          </a>
          .
        </>
      )}
    </p>
  );
}

function SessionNotFound() {
  return (
    <Shell>
      <div className="text-center">
        <h1 className="mx-auto max-w-[24ch] font-display text-[clamp(28px,5vw,44px)] font-light leading-[1.08] tracking-[-0.03em]">
          We couldn't find that checkout session.
        </h1>
        <p className="mx-auto mt-[14px] max-w-[44ch] text-[15.5px] leading-[1.55] text-muted">
          If you just paid, use the link Stripe redirected you to — or start again below.
        </p>
        <a
          href="/onboarding"
          className="mt-7 inline-flex min-h-[50px] items-center justify-center rounded-[13px] bg-ink px-7 py-[14px] text-[15px] font-medium text-cream no-underline"
        >
          Back to onboarding
        </a>
      </div>
      <ContactLine />
    </Shell>
  );
}

export default async function ThanksPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id } = await searchParams;
  const { STRIPE_SECRET_KEY, LEADS_KV } = env as unknown as ThanksEnv;

  if (!STRIPE_SECRET_KEY) {
    return (
      <Shell>
        <Heading
          title={
            <>
              You're in. <span className="text-teal">We're on it.</span>
            </>
          }
          lead="Payment received. Our team starts your setup now and will reach out within one business day."
        />
        <NextSteps />
        <ContactLine />
      </Shell>
    );
  }

  if (!session_id || !SESSION_ID_RE.test(session_id)) {
    return <SessionNotFound />;
  }

  const session = await getCheckoutSession(STRIPE_SECRET_KEY, session_id);
  if (!session) {
    return <SessionNotFound />;
  }

  if (session.payment_status !== "paid") {
    return (
      <Shell>
        <div className="text-center">
          <h1 className="mx-auto max-w-[22ch] font-display text-[clamp(28px,5vw,44px)] font-light leading-[1.08] tracking-[-0.03em]">
            Payment is still processing…
          </h1>
          <p className="mx-auto mt-[14px] max-w-[44ch] text-[15.5px] leading-[1.55] text-muted">
            This usually takes a few seconds. Refresh this page in a moment — your setup form
            appears as soon as the payment confirms.
          </p>
        </div>
        <ContactLine />
      </Shell>
    );
  }

  const leadId = session.metadata?.lead_id;
  const lead = leadId ? await getLead(LEADS_KV, leadId) : null;
  if (lead?.status === "setup_complete") {
    return (
      <Shell>
        <Heading
          title={
            <>
              Setup complete. <span className="text-teal">We take it from here.</span>
            </>
          }
          lead="Your receptionist is being configured with everything you shared — forwarding instructions land in your inbox shortly."
        />
        <NextSteps />
        <ContactLine portal />
      </Shell>
    );
  }

  const metaVertical = session.metadata?.vertical;
  const vertical: Vertical = VERTICAL_IDS.includes(metaVertical as Vertical)
    ? (metaVertical as Vertical)
    : "barbershop";

  return (
    <Shell>
      <Heading
        title={
          <>
            Payment received. <span className="text-teal">Finish your setup.</span>
          </>
        }
        lead="Add your hours, services and staff below — your receptionist is configured from exactly this. Takes about three minutes."
      />
      <SetupForm sessionId={session_id} vertical={vertical} />
      <NextSteps />
      <ContactLine portal />
    </Shell>
  );
}
