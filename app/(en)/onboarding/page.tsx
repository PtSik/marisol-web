import { env } from "cloudflare:workers";
import { FunnelNav } from "@/components/onboarding/FunnelNav";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import { getDict, parseLocale } from "@/lib/i18n/dict";
import { getSession, sessionIdFromCookies } from "@/lib/session";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

interface OnboardingEnv {
  RATE_LIMIT_KV?: KVNamespace;
}

type OnboardingProps = { searchParams: Promise<{ lang?: string }> };

export async function generateMetadata({ searchParams }: OnboardingProps) {
  const t = getDict(parseLocale((await searchParams).lang)).onboarding;
  return { title: t.metaTitle, description: t.metaDescription };
}

export default async function OnboardingPage({ searchParams }: OnboardingProps) {
  const { lang } = await searchParams;
  const locale = parseLocale(lang);
  const { RATE_LIMIT_KV } = env as unknown as OnboardingEnv;
  const session = await getSession(RATE_LIMIT_KV, await sessionIdFromCookies());
  // Sign-in sends the client back here, so the locale has to survive the detour.
  if (!session) redirect(locale === "es" ? "/login?lang=es" : "/login");

  return (
    // The route lives under the English layout, so the Spanish funnel marks its own language here.
    <div lang={locale}>
      <FunnelNav locale={locale} path="/onboarding" wide />
      <main className="pt-[clamp(32px,5vw,56px)]">
        <OnboardingWizard locale={locale} accountEmail={session.email} />
      </main>
    </div>
  );
}
