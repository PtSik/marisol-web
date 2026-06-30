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

    el.classList.add("reveal-armed");
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
    return () => io.disconnect();
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
