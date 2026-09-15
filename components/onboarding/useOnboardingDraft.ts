"use client";
import {
  type DraftRecord,
  type OnboardingDraft,
  REVIEW_STEP,
  isOnboardingDraft,
} from "@/lib/onboardingDraft";
import { PLAN_OPTIONS, type Plan } from "@/lib/plans";
import { useCallback, useEffect, useRef, useState } from "react";

export function useOnboardingDraft(initial: OnboardingDraft, accountEmail: string) {
  const [draft, setDraft] = useState(initial);
  const [status, setStatus] = useState<"loading" | "saved" | "saving" | "error" | "conflict">(
    "loading",
  );
  const current = useRef(draft);
  current.current = draft;
  const revision = useRef(0);
  const saved = useRef("");
  const ready = useRef(false);
  const conflict = useRef(false);
  const pending = useRef<Promise<boolean> | null>(null);
  const cacheKey = `marisol-setup:${accountEmail}`;

  // One writer per tab. A second tab receives 409 instead of overwriting this tab's progress.
  const save = useCallback(async (): Promise<boolean> => {
    if (!ready.current || conflict.current) return false;
    if (pending.current) {
      if (!(await pending.current)) return false;
      return save();
    }
    const payload = JSON.stringify(current.current);
    if (payload === saved.current) return true;
    setStatus("saving");
    const task = (async () => {
      try {
        const res = await fetch("/api/onboarding/draft", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ revision: revision.current, draft: JSON.parse(payload) }),
        });
        if (res.status === 409) {
          conflict.current = true;
          setStatus("conflict");
          return false;
        }
        const body = (await res.json()) as { revision?: number };
        if (!res.ok || !body.revision) throw new Error("save failed");
        revision.current = body.revision;
        saved.current = payload;
        try {
          sessionStorage.setItem(
            cacheKey,
            JSON.stringify({ revision: revision.current, draft: current.current }),
          );
        } catch {}
        setStatus(JSON.stringify(current.current) === payload ? "saved" : "saving");
        return true;
      } catch {
        setStatus("error");
        return false;
      }
    })();
    pending.current = task;
    try {
      return await task;
    } finally {
      pending.current = null;
    }
  }, [cacheKey]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/onboarding/draft", { cache: "no-store" });
        if (!res.ok) throw new Error("load failed");
        const body = (await res.json()) as { record: DraftRecord | null };
        if (cancelled) return;
        let restored = body.record?.draft ?? current.current;
        revision.current = body.record?.revision ?? 0;
        saved.current = body.record ? JSON.stringify(restored) : "";
        try {
          const raw = sessionStorage.getItem(cacheKey);
          const local = raw ? JSON.parse(raw) : null;
          if (local && isOnboardingDraft(local.draft) && local.revision === revision.current)
            restored = local.draft;
        } catch {}
        restored = {
          ...restored,
          basics: { ...restored.basics, email: accountEmail },
          step: Math.min(restored.step, REVIEW_STEP),
        };
        // Same reasoning as `planPicked`: a draft that never reached the picker carries whatever
        // the wizard defaulted to, not a decision. Annual is where the pricing section opens, so
        // that is what an undecided customer should see — and be billed for if they pick a tier
        // without touching the toggle.
        if (!restored.planPicked) restored = { ...restored, billing: "annual" };
        const params = new URLSearchParams(window.location.search);
        const plan = params.get("plan");
        const billing = params.get("billing");
        // Arriving from a pricing card is itself a choice; "Start free trial" carries none, and
        // must not leave the picker claiming the default tier was already selected.
        if (PLAN_OPTIONS.includes(plan as Plan))
          restored = { ...restored, plan: plan as Plan, planPicked: true };
        if (billing === "monthly" || billing === "annual") restored = { ...restored, billing };
        if (params.get("cancelled") === "1") restored = { ...restored, step: REVIEW_STEP };
        // Spend the hand-off once. Left in the address bar it outranks the draft on every reload,
        // so a plan picked in the wizard would revert to whichever card started the funnel.
        if (plan || billing) {
          params.delete("plan");
          params.delete("billing");
          const query = params.toString();
          try {
            window.history.replaceState(
              null,
              "",
              `${window.location.pathname}${query ? `?${query}` : ""}`,
            );
          } catch {}
        }
        current.current = restored;
        setDraft(restored);
        ready.current = true;
        setStatus("saved");
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accountEmail, cacheKey]);

  useEffect(() => {
    if (!ready.current || conflict.current) return;
    try {
      sessionStorage.setItem(cacheKey, JSON.stringify({ revision: revision.current, draft }));
    } catch {}
    if (JSON.stringify(draft) !== saved.current) setStatus("saving");
    const timer = setTimeout(() => {
      void save();
    }, 700);
    return () => clearTimeout(timer);
  }, [draft, cacheKey, save]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (ready.current && JSON.stringify(current.current) !== saved.current) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  return { draft, setDraft, status, save, ready: ready.current };
}
