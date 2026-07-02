import { Reveal } from "@/components/motion/Reveal";

const FEATURES = [
  {
    title: "Answers 24/7",
    desc: "Picks up on the first ring, any hour — so a missed call never becomes a lost customer.",
    icon: (
      <path d="M18.178 8c5.096 0 5.096 8 0 8-5.095 0-7.133-8-12.739-8-4.585 0-4.585 8 0 8 5.606 0 7.644-8 12.74-8z" />
    ),
  },
  {
    title: "Books & reschedules",
    desc: "Finds open slots, books the right staff, and moves appointments — no double-bookings, ever.",
    icon: (
      <>
        <path d="M21 7.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3.5" />
        <path d="M16 2v4" />
        <path d="M8 2v4" />
        <path d="M3 10h5" />
        <path d="M17.5 17.5 16 16.25V14" />
        <circle cx="16" cy="16" r="6" />
      </>
    ),
  },
  {
    title: "Sends SMS confirmations",
    desc: "Every booking gets a text with the details and a code to cancel or reschedule. No-shows drop.",
    icon: (
      <>
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
  },
  {
    title: "Knows your hours & services",
    desc: "Trained on your menu, pricing, and schedule, so answers are accurate — never made up.",
    icon: (
      <>
        <path d="m3 17 2 2 4-4" />
        <path d="m3 7 2 2 4-4" />
        <path d="M13 6h8" />
        <path d="M13 12h8" />
        <path d="M13 18h8" />
      </>
    ),
  },
];

export function Features() {
  return (
    <section
      aria-label="What it handles"
      className="mx-auto max-w-content px-[22px] py-[clamp(48px,7vw,88px)]"
    >
      <Reveal className="mb-[clamp(34px,5vw,52px)] text-center">
        <span className="inline-block rounded-full bg-cream-200 px-[13px] py-[7px] text-[11.5px] font-semibold uppercase tracking-[0.16em] text-muted-2">
          What it handles
        </span>
        <h2 className="mx-auto mt-[18px] max-w-[16ch] font-display text-[clamp(28px,5vw,46px)] font-light leading-[1.08] tracking-[-0.03em]">
          A receptionist that never <span className="text-teal">clocks out</span>.
        </h2>
      </Reveal>

      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        {FEATURES.map((f, i) => (
          <Reveal
            key={f.title}
            delay={i * 90}
            className="rounded-[22px] bg-cream-200 p-5 sm:p-[26px]"
          >
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-cream">
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className="text-ink"
              >
                {f.icon}
              </svg>
            </div>
            <h3 className="mb-[6px] font-display text-[clamp(16px,4.4vw,22px)] tracking-[-0.02em]">
              {f.title}
            </h3>
            <p className="text-[13.5px] leading-[1.5] text-muted sm:text-[14.5px] sm:leading-[1.55]">
              {f.desc}
            </p>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
