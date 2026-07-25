import { LogoMark } from "@/components/Logo";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";
import { getDict } from "@/lib/i18n/dict";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Reset your password — Marisol",
  description: "Set a new password for your Marisol account.",
  robots: { index: false, follow: false },
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const t = getDict("en").auth;

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
          {t.resetPageTitle}
        </h1>
        <p className="mt-2 text-[14.5px] leading-[1.55] text-muted">{t.resetPageSubtitle}</p>
        <ResetPasswordForm token={token ?? ""} t={t} />
      </div>
    </main>
  );
}
