"use client";

import { useEffect, useState } from "react";

const STATS = [
  { value: "99%", label: "Answered", desc: "of calls picked up, day or night" },
  { value: "0", label: "Missed", desc: "bookings lost while you're busy" },
  { value: "24/7", label: "Always on", desc: "nights, weekends, and holidays" },
];

export function StatCards() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setActive((a) => (a + 1) % STATS.length), 4200);
    return () => clearInterval(id);
  }, []);

  const next = () => setActive((a) => (a + 1) % STATS.length);

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
        {STATS.map((s) => (
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
        {STATS.map((s, i) => (
          <button
            key={s.label}
            type="button"
            aria-label={`Show ${s.label} stat`}
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
