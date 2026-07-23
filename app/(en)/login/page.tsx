import { LogoMark } from "@/components/Logo";
import { SALES_EMAIL, SALES_EMAIL_HREF } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Sign in — Marisol",
  description: "Sign in to manage your Marisol receptionist.",
  robots: { index: false, follow: false },
};

const ERRORS: Record<string, string> = {
  unknown_email:
    "We don't have an account for that Google address. Sign in with the address you used at checkout, or email us and we'll move your account across.",
  oauth_failed: "Google sign-in didn't complete. Please try again.",
  rate_limited: "Too many sign-in attempts. Wait a minute and try again.",
  session_failed: "We couldn't start your session. Please try again.",
  not_configured: "Sign-in isn't available right now. Email us and we'll help.",
};

function GoogleGlyph() {
  return (
    <svg viewBox="0 0 18 18" aria-hidden="true" className="h-[18px] w-[18px]">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  );
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const message = error ? (ERRORS[error] ?? ERRORS.oauth_failed) : null;

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
          Sign in to your portal
        </h1>
        <p className="mt-2 text-[14.5px] leading-[1.55] text-muted">
          Use the Google account with the email address from your order.
        </p>
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
          Continue with Google
        </a>
        <p className="mt-5 text-[13px] leading-[1.55] text-muted-2">
          Signing in with a different address?{" "}
          <a href={SALES_EMAIL_HREF} className="font-medium text-teal">
            {SALES_EMAIL}
          </a>{" "}
          — we'll switch your account over.
        </p>
      </div>
    </main>
  );
}
