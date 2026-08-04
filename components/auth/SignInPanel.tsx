"use client";

import { ForgotPassword, SigninForm } from "@/components/auth/AuthModal";
import type { Dict, Locale } from "@/lib/i18n/dict";
import { useState } from "react";

// The same two forms the modal shows, for the standalone /login page every portal redirect lands on.
export function SignInPanel({ t, locale }: { t: Dict["auth"]; locale: Locale }) {
  const [forgotOpen, setForgotOpen] = useState(false);

  return (
    <div className="mt-6">
      {forgotOpen ? (
        <ForgotPassword t={t} onBack={() => setForgotOpen(false)} />
      ) : (
        <SigninForm t={t} locale={locale} onForgot={() => setForgotOpen(true)} />
      )}
    </div>
  );
}
