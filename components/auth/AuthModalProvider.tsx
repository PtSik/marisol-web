"use client";

import { AuthModal, type AuthTab } from "@/components/auth/AuthModal";
import type { Dict, Locale } from "@/lib/i18n/dict";
import type { Billing, Plan } from "@/lib/plans";
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";

interface AuthModalState {
  open: boolean;
  tab: AuthTab;
  plan?: Plan;
  billing?: Billing;
}

interface AuthModalContextValue {
  openSignup: (plan?: Plan, billing?: Billing) => void;
  openSignin: () => void;
  close: () => void;
}

const AuthModalContext = createContext<AuthModalContextValue | null>(null);

export function useAuthModal(): AuthModalContextValue {
  const ctx = useContext(AuthModalContext);
  if (!ctx) throw new Error("useAuthModal must be used within AuthModalProvider");
  return ctx;
}

export function AuthModalProvider({
  t,
  locale,
  children,
}: { t: Dict["auth"]; locale: Locale; children: ReactNode }) {
  const [state, setState] = useState<AuthModalState>({ open: false, tab: "signup" });

  const openSignup = useCallback((plan?: Plan, billing?: Billing) => {
    setState({ open: true, tab: "signup", plan, billing });
  }, []);
  const openSignin = useCallback(() => {
    setState((s) => ({ ...s, open: true, tab: "signin" }));
  }, []);
  const close = useCallback(() => setState((s) => ({ ...s, open: false })), []);
  const setTab = useCallback((tab: AuthTab) => setState((s) => ({ ...s, tab })), []);

  const value = useMemo(() => ({ openSignup, openSignin, close }), [openSignup, openSignin, close]);

  return (
    <AuthModalContext.Provider value={value}>
      {children}
      <AuthModal
        open={state.open}
        tab={state.tab}
        plan={state.plan}
        billing={state.billing}
        onTabChange={setTab}
        onClose={close}
        t={t}
        locale={locale}
      />
    </AuthModalContext.Provider>
  );
}
