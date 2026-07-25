import { GoogleGlyph } from "@/components/GoogleGlyph";
import { LogoMark } from "@/components/Logo";
import { SignInPanel } from "@/components/auth/SignInPanel";
import { en } from "@/lib/i18n/en";
import { SALES_EMAIL, SALES_EMAIL_HREF } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Sign in — Marisol",
  description: "Sign in to manage your Marisol receptionist.",
  robots: { index: false, follow: false },
};

const ERRORS: Record<string, string> = {
  oauth_failed: "Google sign-in didn't complete. Please try again.",
  rate_limited: "Too many sign-in attempts. Wait a minute and try again.",
  session_failed: "We couldn't start your session. Please try again.",
  not_configured: "Sign-in isn't available right now. Email us and we'll help.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const message = error ? (ERRORS[error] ?? ERRORS.oauth_failed) : null;
  const t = en.auth;

  return (
    <main className="mx-auto flex min-h-[80vh] max-w-shell items-center justify-center px-[22px]">
      <div className="w-full max-w-[400px] rounded-[20px] border border-ink/10 bg-cream-100 p-8">
        <a
          href="/"
          className="flex items-center gap-[7px] font-display text-[22px] tracking-tight no-underline"
        >
          <LogoMark className="h-5 w-5 rounded-[3.5px]" />
          Marisol
        </a>
        <h1 className="mt-6 font-display text-[26px] font-light leading-[1.15] tracking-[-0.02em]">
          {t.signinTitle}
        </h1>
        <p className="mt-2 text-[14.5px] leading-[1.55] text-muted">{t.signinSubtitle}</p>
        {message && (
          <p
            role="alert"
            className="mt-5 rounded-[12px] border border-[#B4452C]/25 bg-[#B4452C]/8 px-4 py-3 text-[13.5px] leading-[1.5] text-[#B4452C]"
          >
            {message}
          </p>
        )}
        <a
          href="/api/auth/google/start"
          className="mt-6 inline-flex min-h-[50px] w-full items-center justify-center gap-[10px] rounded-[13px] border border-ink/15 bg-white px-6 py-[14px] text-[15px] font-medium text-ink no-underline"
        >
          <GoogleGlyph />
          {t.google}
        </a>

        <div className="my-5 flex items-center gap-3 text-[12px] uppercase tracking-[0.1em] text-muted-3">
          <span className="h-px flex-1 bg-ink/10" />
          {t.or}
          <span className="h-px flex-1 bg-ink/10" />
        </div>

        <SignInPanel t={t} />

        <p className="mt-5 text-center text-[13px] leading-[1.55] text-muted-2">
          {t.noAccount}
          <a href="/" className="font-medium text-teal">
            {t.signUpLink}
          </a>
        </p>
        <p className="mt-4 text-[13px] leading-[1.55] text-muted-2">
          Trouble signing in?{" "}
          <a href={SALES_EMAIL_HREF} className="font-medium text-teal">
            {SALES_EMAIL}
          </a>
        </p>
      </div>
    </main>
  );
}
