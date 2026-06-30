"use client";

import type { RefObject } from "react";
import { useEffect } from "react";

export function useParallax(ref: RefObject<HTMLElement | null>, factor = 0.2, maxPx = 36) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let raf = 0;
    let ticking = false;

    const update = () => {
      ticking = false;
      const host = el.parentElement ?? el;
      const rect = host.getBoundingClientRect();
      const vh = window.innerHeight || document.documentElement.clientHeight;
      if (rect.bottom < -200 || rect.top > vh + 200) return;
      const delta = rect.top + rect.height / 2 - vh / 2;
      const y = Math.max(-maxPx, Math.min(maxPx, -delta * factor));
      el.style.transform = `translate3d(0, ${y.toFixed(2)}px, 0)`;
    };

    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        raf = requestAnimationFrame(update);
      }
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [ref, factor, maxPx]);
}
