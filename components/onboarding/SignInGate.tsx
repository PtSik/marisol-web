import { GoogleGlyph } from "@/components/GoogleGlyph";
import { ThanksHeading } from "@/components/onboarding/ThanksHeading";
import type { Dict, Locale } from "@/lib/i18n/dict";

// The gate stands between a paid checkout and the setup form. A full Google button plus a quiet
// text escape hatch — two equal buttons and most clients take the lighter one, and the gate loses
// its point.
export function SignInGate({
  sessionId,
  locale,
  error,
  t,
}: { sessionId: string; locale: Locale; error?: string | null; t: Dict["thanks"] }) {
  const g = t.gate;
  const lang = locale === "es" ? "&lang=es" : "";
  const startHref = `/api/auth/google/start?intent=claim&session_id=${encodeURIComponent(sessionId)}`;
  const skipHref = `/onboarding/thanks?session_id=${encodeURIComponent(sessionId)}${lang}&skip=1`;

  return (
    <div className="text-center">
      <ThanksHeading title={g.title} lead={g.lead} />
      {error && (
        <p
          role="alert"
          className="mx-auto mt-6 max-w-[42ch] rounded-[12px] border border-[#B4452C]/25 bg-[#B4452C]/8 px-4 py-3 text-[13.5px] leading-[1.5] text-[#B4452C]"
        >
          {error}
        </p>
      )}
      <a
        href={startHref}
        className="mx-auto mt-7 inline-flex min-h-[50px] w-full max-w-[340px] items-center justify-center gap-[10px] rounded-[13px] border border-ink/15 bg-white px-6 py-[14px] text-[15px] font-medium text-ink no-underline"
      >
        <GoogleGlyph />
        {g.button}
      </a>
      {/* After a failed attempt the escape hatch stops being a whisper — a client who can't sign in
          needs a way forward they can actually see. */}
      {error ? (
        <a
          href={skipHref}
          className="mx-auto mt-4 inline-flex min-h-[46px] w-full max-w-[340px] items-center justify-center rounded-[13px] border border-ink/15 px-6 py-3 text-[14px] font-medium text-ink no-underline"
        >
          {g.skip}
        </a>
      ) : (
        <p className="mt-4 text-[13px] leading-[1.55] text-muted-2">
          <a href={skipHref} className="underline underline-offset-2 hover:text-muted">
            {g.skip}
          </a>
        </p>
      )}
    </div>
  );
}
