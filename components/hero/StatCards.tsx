"use client";

import { type Dict, fill } from "@/lib/i18n/dict";
import { useEffect, useState } from "react";

export function StatCards({
  stats,
  ariaTemplate,
}: { stats: Dict["hero"]["stats"]; ariaTemplate: string }) {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setActive((a) => (a + 1) % stats.length), 4200);
    return () => clearInterval(id);
  }, [stats.length]);

  const next = () => setActive((a) => (a + 1) % stats.length);

  return (
    <>
      <div
        className="stat-grid"
        data-active={active}
        onClick={next}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            next();
          }
        }}
      >
        {stats.map((s) => (
          <div key={s.label} className="stat-card">
            <div className="font-display text-[clamp(40px,6.5vw,64px)] font-light leading-none tracking-[-0.03em] text-offwhite">
              {s.value}
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-offwhite">
                {s.label}
              </div>
              <div className="mt-[7px] text-[13.5px] leading-[1.45] text-offwhite/85">{s.desc}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="stat-dots relative z-[3] items-center justify-center gap-2 pb-[clamp(20px,5vw,30px)] pt-[2px]">
        {stats.map((s, i) => (
          <button
            key={s.label}
            type="button"
            aria-label={fill(ariaTemplate, { label: s.label })}
            onClick={() => setActive(i)}
            className={`h-2 rounded-full transition-all ${
              i === active ? "w-5 bg-offwhite" : "w-2 bg-offwhite/40"
            }`}
          />
        ))}
      </div>
    </>
  );
}
