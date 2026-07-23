"use client";

import { REF_CODE_RE, REF_COOKIE, REF_COOKIE_MAX_AGE } from "@/lib/referrals";
import { useEffect } from "react";

// The referral code has to survive the gap between landing here and finishing checkout days
// later, so it lives in a cookie the onboarding route reads server-side.
export function RefCapture() {
  useEffect(() => {
    try {
      const code = new URLSearchParams(window.location.search).get("ref")?.trim().toUpperCase();
      if (!code || !REF_CODE_RE.test(code)) return;
      document.cookie = `${REF_COOKIE}=${code}; Max-Age=${REF_COOKIE_MAX_AGE}; Path=/; SameSite=Lax`;
    } catch {
      /* attribution must never break the page */
    }
  }, []);

  return null;
}
