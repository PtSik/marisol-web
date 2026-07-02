import { LogoMark } from "@/components/Logo";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";

export const metadata = {
  title: "Get started — Kaijiro",
  description: "Tell us about your shop and we set up your AI receptionist for you.",
};

export default function OnboardingPage() {
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
          <a href="/" className="text-sm text-muted no-underline">
            ← Back to site
          </a>
        </div>
      </nav>
      <main className="pt-[clamp(32px,5vw,56px)]">
        <OnboardingWizard />
      </main>
    </>
  );
}
