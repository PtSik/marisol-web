import { Reveal } from "@/components/motion/Reveal";

const FEATURES = [
  {
    title: "Answers 24/7",
    desc: "Picks up on the first ring, any hour — so a missed call never becomes a lost customer.",
    icon: (
      <>
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </>
    ),
  },
  {
    title: "Books & reschedules",
    desc: "Finds open slots, books the right staff, and moves appointments — no double-bookings, ever.",
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
  {
    title: "Sends SMS confirmations",
    desc: "Every booking gets a text with the details and a code to cancel or reschedule. No-shows drop.",
    icon: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
  },
  {
    title: "Knows your hours & services",
    desc: "Trained on your menu, pricing, and schedule, so answers are accurate — never made up.",
    icon: (
      <>
        <path d="M20 7h-9" />
        <path d="M14 17H5" />
        <circle cx="17" cy="17" r="3" />
        <circle cx="7" cy="7" r="3" />
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
