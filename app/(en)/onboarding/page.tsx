import { LogoMark } from "@/components/Logo";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import { LOCALE_PATH, getDict, parseLocale } from "@/lib/i18n/dict";

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
          <a href={home} className="text-sm text-muted no-underline">
            {t.back}
          </a>
        </div>
      </nav>
      <main className="pt-[clamp(32px,5vw,56px)]">
        <OnboardingWizard locale={locale} />
      </main>
    </div>
  );
}
