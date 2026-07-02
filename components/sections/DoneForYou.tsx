import { Reveal } from "@/components/motion/Reveal";

const ITEMS = [
  {
    title: "We port your number",
    desc: "Your line forwards to us — the number on your door never changes.",
  },
  {
    title: "We build your menu & hours",
    desc: "Services, pricing, staff, and schedule — loaded and double-checked.",
  },
  {
    title: "We tune the voice & greeting",
    desc: "It sounds like your shop and connects to your calendar.",
  },
];

export function DoneForYou() {
  return (
    <section
      aria-label="Done for you"
      className="mx-auto max-w-content px-[22px] py-[clamp(48px,7vw,88px)]"
    >
      <div className="relative overflow-hidden rounded-[26px] bg-[#1F3A35] px-[clamp(24px,4vw,46px)] py-[clamp(34px,5vw,52px)]">
        <div
          style={{
            position: "absolute",
            left: "78%",
            top: "18%",
            width: "280px",
            height: "280px",
            borderRadius: "50%",
            background: "radial-gradient(circle,rgba(79,140,128,.55),rgba(79,140,128,0) 70%)",
            filter: "blur(8px)",
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: "8%",
            top: "84%",
            width: "200px",
            height: "200px",
            borderRadius: "50%",
            background: "radial-gradient(circle,rgba(242,166,90,.28),rgba(242,166,90,0) 70%)",
            filter: "blur(8px)",
            pointerEvents: "none",
          }}
        />

        <Reveal className="relative z-[2] mb-[clamp(20px,3vw,28px)] text-center">
          <span className="inline-block rounded-full bg-[#9CD0C4]/[0.16] px-[13px] py-[7px] text-[11.5px] font-semibold uppercase tracking-[0.16em] text-[#9CD0C4]">
            Done for you
          </span>
        </Reveal>

        <Reveal className="relative z-[2] mx-auto mb-[clamp(24px,3vw,36px)] max-w-[42ch] text-center">
          <h2 className="font-display text-[clamp(26px,4.4vw,42px)] font-light leading-[1.1] tracking-[-0.03em] text-cream">
            <span className="whitespace-nowrap">We set the whole thing up.</span>
            <br />
            <span className="text-[#9CD0C4]">You don't lift a finger.</span>
          </h2>
          <p className="mt-[14px] text-[15px] leading-[1.55] text-cream/80">
            Send us your details once and our team handles the rest. No software to install, no
            scripts to write.
          </p>
        </Reveal>

        <ul className="relative z-[2] flex flex-wrap gap-x-[clamp(16px,3vw,26px)] gap-y-6 sm:gap-y-[clamp(16px,3vw,26px)]">
          {ITEMS.map((item, i) => (
            <Reveal
              as="li"
              key={item.title}
              delay={i * 90}
              className="flex min-w-[230px] flex-1 items-start gap-[13px]"
            >
              <span className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-[9px] bg-[#9CD0C4]/[0.16]">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#9CD0C4"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </span>
              <div>
                <div className="font-display text-[17px] tracking-[-0.01em] text-cream">
                  {item.title}
                </div>
                <div className="mt-[2px] text-[13.5px] text-cream/[0.66]">{item.desc}</div>
              </div>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
