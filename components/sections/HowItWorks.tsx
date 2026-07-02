import { Reveal } from "@/components/motion/Reveal";

const STEPS = [
  {
    num: "01",
    title: "Forward your number",
    icon: (
      <>
        <polyline points="18 2 22 6 18 10" />
        <line x1="8" y1="6" x2="22" y2="6" />
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
      </>
    ),
  },
  {
    num: "02",
    title: "The AI answers",
    icon: (
      <>
        <path d="M2 10v3" />
        <path d="M6 6v11" />
        <path d="M10 3v18" />
        <path d="M14 8v7" />
        <path d="M18 5v13" />
        <path d="M22 10v3" />
      </>
    ),
  },
  {
    num: "03",
    title: "Bookings land in your calendar",
    icon: (
      <>
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
        <path d="m9 16 2 2 4-4" />
      </>
    ),
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="mx-auto max-w-content px-[22px] py-[clamp(48px,7vw,88px)]">
      <div className="relative overflow-hidden rounded-[24px] px-[clamp(20px,4vw,40px)] py-[clamp(26px,4vw,40px)]">
        <div
          style={{
            position: "absolute",
            inset: "-8%",
            backgroundImage: "url('/assets/box-logos-tonal.png')",
            backgroundSize: "cover",
            backgroundPosition: "center",
            animation: "bloomDrift 18s ease-in-out infinite",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: "24%",
            top: "30%",
            width: "130px",
            height: "130px",
            borderRadius: "50%",
            background: "radial-gradient(circle,rgba(247,238,224,.5),rgba(247,238,224,0) 70%)",
            filter: "blur(2px)",
            animation: "orbA 12s ease-in-out infinite",
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: "62%",
            top: "64%",
            width: "110px",
            height: "110px",
            borderRadius: "50%",
            background: "radial-gradient(circle,rgba(192,150,98,.4),rgba(192,150,98,0) 70%)",
            filter: "blur(2px)",
            animation: "orbB 15s ease-in-out infinite",
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "radial-gradient(circle, rgba(255,255,255,.6) 1.1px, transparent 1.3px)",
            backgroundSize: "24px 24px",
            opacity: 0.6,
            animation: "gridDrift 30s linear infinite",
            pointerEvents: "none",
          }}
        />

        <Reveal className="relative z-[2] mb-[clamp(22px,4vw,34px)] text-center">
          <span className="inline-block rounded-full bg-cream-200 px-[13px] py-[7px] text-[11.5px] font-semibold uppercase tracking-[0.16em] text-muted-2">
            How it works
          </span>
          <h2 className="mx-auto mt-4 max-w-[18ch] font-display text-[clamp(26px,4.5vw,42px)] font-light leading-[1.08] tracking-[-0.03em]">
            Set up <span className="text-teal">once</span>, never pick up again.
          </h2>
        </Reveal>

        <div className="relative z-[2] flex flex-wrap items-stretch justify-center gap-[clamp(14px,3vw,28px)]">
          {STEPS.map((step, i) => (
            <Reveal
              key={step.num}
              delay={i * 90}
              className="flex min-w-[200px] flex-1 items-center gap-4 rounded-[18px] border border-ink/[0.07] bg-cream/80 px-5 py-[18px] backdrop-blur-sm"
            >
              <div className="flex h-12 w-12 flex-none items-center justify-center rounded-[13px] bg-cream shadow-[0_6px_16px_-10px_rgba(36,27,20,0.5)]">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  className="text-ink"
                >
                  {step.icon}
                </svg>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-display text-[13px] font-medium tracking-[0.04em] text-muted-3">
                  {step.num}
                </span>
                <span className="font-display text-[18px] tracking-[-0.01em] text-ink">
                  {step.title}
                </span>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
