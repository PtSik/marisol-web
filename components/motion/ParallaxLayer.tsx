"use client";

import type { CSSProperties, ReactNode } from "react";
import { useRef } from "react";
import { useParallax } from "./useParallax";

interface ParallaxLayerProps {
  children: ReactNode;
  factor?: number;
  style?: CSSProperties;
}

export function ParallaxLayer({ children, factor = 0.2, style }: ParallaxLayerProps) {
  const ref = useRef<HTMLDivElement>(null);
  useParallax(ref, factor);
  return (
    <div ref={ref} style={{ willChange: "transform", ...style }}>
      {children}
    </div>
  );
}
