"use client";

import { ForgotPassword, SigninForm } from "@/components/auth/AuthModal";
import type { Dict } from "@/lib/i18n/dict";
import { useState } from "react";

// The same two forms the modal shows, for the standalone /login page every portal redirect lands on.
export function SignInPanel({ t }: { t: Dict["auth"] }) {
  const [forgotOpen, setForgotOpen] = useState(false);

  return (
    <div className="mt-6">
      {forgotOpen ? (
        <ForgotPassword t={t} onBack={() => setForgotOpen(false)} />
      ) : (
        <SigninForm t={t} onForgot={() => setForgotOpen(true)} />
      )}
    </div>
  );
}
