"use client";

import type { CSSProperties, ReactNode, RefObject } from "react";
import { useEffect, useRef } from "react";

interface RevealProps {
  children: ReactNode;
  delay?: number;
  className?: string;
  as?: "div" | "li";
}

export function Reveal({ children, delay = 0, className, as = "div" }: RevealProps) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!("IntersectionObserver" in window)) return;

    // Anything already on screen when the effect runs has *already been painted*, so arming it
    // would fade out content the reader is looking at. Worse, the observer below shrinks its root
    // by 10% of the viewport, so an element sitting in that bottom strip never qualifies as
    // intersecting and never gets `is-visible` back — at 1440x900 that was the client-names band,
    // which faded away on load and stayed blank until the reader happened to scroll.
    // Leave everything in the first screen exactly as the server painted it.
    if (el.getBoundingClientRect().top < window.innerHeight) return;

    el.classList.add("reveal-armed");

    // The compositor layer is only worth holding while the transition is actually running.
    // `will-change` is declared in the .reveal-armed rule, so removing an inline property here
    // cleared nothing — every revealed element kept its own layer for the life of the page (36 of
    // them, measured). Setting it inline to `auto` is what actually overrides the rule.
    const drop = () => {
      el.style.willChange = "auto";
    };
    el.addEventListener("transitionend", drop, { once: true });

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            io.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -10% 0px" },
    );
    io.observe(el);
    return () => {
      el.removeEventListener("transitionend", drop);
      io.disconnect();
    };
  }, []);

  const style = { "--reveal-delay": `${delay}ms` } as CSSProperties;

  if (as === "li") {
    return (
      <li
        ref={ref as RefObject<HTMLLIElement | null>}
        data-reveal
        className={className}
        style={style}
      >
        {children}
      </li>
    );
  }
  return (
    <div
      ref={ref as RefObject<HTMLDivElement | null>}
      data-reveal
      className={className}
      style={style}
    >
      {children}
    </div>
  );
}
