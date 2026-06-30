import { StatCards } from "@/components/hero/StatCards";
import { ParallaxLayer } from "@/components/motion/ParallaxLayer";
import { telHref } from "@/lib/site";

export function Hero() {
  return (
    <header className="mx-auto max-w-content px-[22px] pb-16 pt-[clamp(40px,9vw,84px)] text-center">
      <h1 className="mx-auto max-w-[14ch] font-display text-[clamp(40px,9.2vw,82px)] font-light leading-[1.02] tracking-[-0.035em]">
        Never miss <span className="text-teal">a call</span> again.
      </h1>
      <p className="mx-auto mt-[22px] max-w-[43ch] text-[clamp(16px,2.2vw,20px)] leading-[1.55] text-muted">
        A warm AI receptionist that answers every call, books the appointment, and texts the
        confirmation — day or night.
      </p>

      <div className="mx-auto mt-[30px] flex w-fit flex-col items-stretch gap-3 sm:w-auto sm:flex-row sm:justify-center">
        <a
          href="#demo"
          className="inline-flex min-h-[52px] items-center justify-center gap-[9px] rounded-xl bg-ink px-[26px] py-[15px] text-base font-medium text-cream no-underline shadow-[0_12px_30px_-14px_rgba(36,27,20,0.6)]"
        >
          <span
            aria-hidden="true"
            className="inline-flex h-[22px] w-[22px] items-center justify-center rounded-full bg-cream text-[10px] text-ink"
          >
            ▶
          </span>
          Talk to the receptionist
        </a>
        <a
          href={telHref}
          className="inline-flex min-h-[52px] items-center justify-center gap-[9px] rounded-xl border border-ink/10 bg-cream-200 px-6 py-[15px] text-base font-medium text-ink no-underline"
        >
          <svg
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
          </svg>
          Call the demo line
        </a>
      </div>

      <div className="mt-[clamp(40px,7vw,68px)]">
        <div className="frontdesk-panel relative flex aspect-[16/9] flex-col justify-center overflow-hidden rounded-[28px] shadow-[0_40px_80px_-50px_rgba(36,27,20,0.65)]">
          <ParallaxLayer factor={0.18} style={{ position: "absolute", inset: "-8%" }}>
            <div
              style={{
                position: "absolute",
                inset: 0,
                backgroundImage: "url('/assets/box-frontdesk-bg.png')",
                backgroundSize: "cover",
                backgroundPosition: "center",
                transformOrigin: "62% 42%",
                animation: "bloomDrift 15s ease-in-out infinite",
              }}
            />
          </ParallaxLayer>
          <div
            style={{
              position: "absolute",
              left: "62%",
              top: "42%",
              width: "60%",
              height: "80%",
              transform: "translate(-50%,-50%)",
              borderRadius: "50%",
              background:
                "radial-gradient(circle,rgba(255,180,112,.7) 0%,rgba(255,140,80,.28) 40%,rgba(255,140,80,0) 70%)",
              mixBlendMode: "screen",
              animation: "bloomGlow 6s ease-in-out infinite",
              pointerEvents: "none",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: "20%",
              top: "64%",
              width: "46%",
              height: "64%",
              transform: "translate(-50%,-50%)",
              borderRadius: "50%",
              background:
                "radial-gradient(circle,rgba(120,210,200,.55) 0%,rgba(100,180,180,.2) 45%,rgba(100,180,180,0) 72%)",
              mixBlendMode: "screen",
              animation: "coolGlow 13s ease-in-out infinite",
              pointerEvents: "none",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: "30%",
              top: "30%",
              width: "120px",
              height: "120px",
              borderRadius: "50%",
              background: "radial-gradient(circle,rgba(255,225,180,.5),rgba(255,225,180,0) 70%)",
              filter: "blur(2px)",
              animation: "orbA 11s ease-in-out infinite",
              pointerEvents: "none",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: "78%",
              top: "24%",
              width: "90px",
              height: "90px",
              borderRadius: "50%",
              background: "radial-gradient(circle,rgba(255,170,120,.45),rgba(255,170,120,0) 70%)",
              filter: "blur(2px)",
              animation: "orbB 14s ease-in-out infinite",
              pointerEvents: "none",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: "46%",
              top: "74%",
              width: "80px",
              height: "80px",
              borderRadius: "50%",
              background: "radial-gradient(circle,rgba(180,220,255,.4),rgba(180,220,255,0) 70%)",
              filter: "blur(2px)",
              animation: "orbC 17s ease-in-out infinite",
              pointerEvents: "none",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage:
                "radial-gradient(circle, rgba(255,255,255,.92) 3.2px, transparent 3.6px)",
              backgroundSize: "42px 42px",
              backgroundPosition: "center",
              opacity: 0.82,
              WebkitMaskImage:
                "linear-gradient(to right,transparent 0,#000 40px,#000 calc(100% - 40px),transparent 100%),linear-gradient(to bottom,transparent 0,#000 40px,#000 calc(100% - 40px),transparent 100%)",
              WebkitMaskComposite: "source-in",
              maskImage:
                "linear-gradient(to right,transparent 0,#000 40px,#000 calc(100% - 40px),transparent 100%),linear-gradient(to bottom,transparent 0,#000 40px,#000 calc(100% - 40px),transparent 100%)",
              maskComposite: "intersect",
              pointerEvents: "none",
            }}
          />

          <div className="frontdesk-caption absolute inset-5 flex items-end p-[clamp(18px,3vw,30px)]">
            <div className="max-w-[60ch] rounded-[14px] bg-ink/30 px-[18px] py-3 text-left text-cream backdrop-blur-md">
              <div className="mb-1 text-xs uppercase tracking-[0.14em] opacity-85">
                A live front desk
              </div>
              <div className="font-display text-[clamp(17px,3vw,24px)] font-light leading-[1.2] tracking-[-0.02em]">
                It picks up on the first ring — and sounds like someone who works there.
              </div>
            </div>
          </div>

          <StatCards />
        </div>
      </div>
    </header>
  );
}
