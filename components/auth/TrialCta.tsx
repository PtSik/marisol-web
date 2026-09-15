"use client";

import { useAuthModal } from "@/components/auth/AuthModalProvider";
import { type Locale, appHref } from "@/lib/i18n/dict";

export function TrialCta({
  label,
  authed,
  locale,
  className,
}: { label: string; authed: boolean; locale: Locale; className: string }) {
  const { openSignup } = useAuthModal();

  return authed ? (
    <a href={appHref(locale, "/portal")} className={className}>
      {label}
    </a>
  ) : (
    <button type="button" onClick={() => openSignup()} className={className}>
      {label}
    </button>
  );
}
