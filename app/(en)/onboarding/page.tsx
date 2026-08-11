import { env } from "cloudflare:workers";
import { LangSwitch } from "@/components/LangSwitch";
import { LogoMark } from "@/components/Logo";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import { LOCALE_PATH, getDict, parseLocale } from "@/lib/i18n/dict";
import { getSession, sessionIdFromCookies } from "@/lib/session";
import { siteHref } from "@/lib/site";
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
  const home = LOCALE_PATH[locale];
  const t = getDict(locale).onboarding;
  const { RATE_LIMIT_KV } = env as unknown as OnboardingEnv;
  const session = await getSession(RATE_LIMIT_KV, await sessionIdFromCookies());
  // Sign-in sends the client back here, so the locale has to survive the detour.
  if (!session) redirect(locale === "es" ? "/login?lang=es" : "/login");

  return (
    // The route lives under the English layout, so the Spanish funnel marks its own language here.
    <div lang={locale}>
      <nav className="mx-auto max-w-shell px-[22px] pt-[14px]">
        {/* flex-wrap on both levels: without it, a narrow phone has no room for logo + back link +
            lang switch + sign out on one line, and since none of those labels declare
            whitespace-nowrap, the browser breaks mid-phrase ("Back" / "to site") instead of wrapping
            the row. */}
        <div className="flex w-full flex-wrap items-center justify-between gap-x-5 gap-y-3 rounded-[18px] border border-ink/10 bg-cream/80 px-5 py-3 backdrop-blur-md">
          <a
            href={siteHref(home)}
            className="flex items-center gap-[7px] font-display text-[22px] tracking-tight no-underline"
          >
            <LogoMark className="h-5 w-5 rounded-[3.5px]" />
            Marisol
          </a>
          <div className="flex flex-wrap items-center gap-4">
            <a href={siteHref(home)} className="whitespace-nowrap text-sm text-muted no-underline">
              {t.back}
            </a>
            <LangSwitch locale={locale} t={getDict(locale).lang} path="/onboarding" byQuery />
            <SignOutButton label={getDict(locale).auth.signOut} />
          </div>
        </div>
      </nav>
      <main className="pt-[clamp(32px,5vw,56px)]">
        <OnboardingWizard locale={locale} accountEmail={session.email} />
      </main>
    </div>
  );
}
