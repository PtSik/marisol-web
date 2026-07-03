import { Reveal } from "@/components/motion/Reveal";

const FAQS = [
  {
    q: "Does it sound robotic?",
    a: "No — callers hear a natural, warm voice with normal pauses. Most don't realize it's automated until it tells them, which it does at the start of every call.",
  },
  {
    q: "What happens if it can't help?",
    a: "It hands off gracefully. For anything outside booking — a complaint, a special request — it takes a message or transfers the call to you, based on rules you set.",
  },
  {
    q: "Do I keep my current phone number?",
    a: "Yes. You forward your existing line to Kaijiro, so the number on your door, cards, and Google listing stays exactly the same.",
  },
  {
    q: "How does it avoid double-booking?",
    a: "It checks live availability before confirming and writes straight to your calendar, so two callers can never grab the same slot for the same staff member.",
  },
  {
    q: "What does the customer get afterward?",
    a: "A confirmation text with the date, time, staff, and service — plus a short code they can use to reschedule or cancel by replying or calling back.",
  },
  {
    q: "How long does setup take?",
    a: "You share your hours, services and staff right after checkout — about three minutes of form. We configure everything and you're typically live within a couple of days; the only thing you do is forward your number.",
  },
  {
    q: "Is there a contract or notice period?",
    a: "No contract. It's a month-to-month (or annual) subscription you can cancel anytime from the billing portal — no notice period, no cancellation fee, and you keep your number.",
  },
  {
    q: "What if it doesn't work out?",
    a: (
      <>
        Every plan comes with a 14-day money-back guarantee — if it's not for you, we refund your
        first payment in full, no questions asked. Details in our{" "}
        <a href="/terms" className="font-medium text-teal">
          terms
        </a>
        .
      </>
    ),
  },
];

export function Faq() {
  return (
    <section id="faq" className="mx-auto max-w-[760px] px-[22px] py-[clamp(30px,4vw,46px)]">
      <Reveal className="mb-[clamp(30px,5vw,44px)] text-center">
        <span className="inline-block rounded-full bg-cream-200 px-[15px] py-[8px] text-[11.5px] font-semibold uppercase tracking-[0.16em] text-muted-2">
          FAQ
        </span>
        <h2 className="mx-auto mt-[clamp(22px,4vw,36px)] max-w-[16ch] font-display text-[clamp(28px,5vw,46px)] font-light leading-[1.08] tracking-[-0.03em]">
          Questions, <span className="text-teal">answered</span>.
        </h2>
      </Reveal>

      <div className="flex flex-col gap-3">
        {FAQS.map((item, i) => (
          <Reveal key={item.q} delay={i * 60}>
            <details className="group overflow-hidden rounded-[18px] bg-cream-200">
              <summary className="flex min-h-[60px] cursor-pointer list-none items-center justify-between gap-4 px-[22px] py-5 text-[clamp(15px,2.2vw,17px)] font-medium text-ink [&::-webkit-details-marker]:hidden">
                {item.q}
                <span className="flex h-[26px] w-[26px] flex-none items-center justify-center rounded-full transition-transform duration-300 group-open:rotate-180">
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    aria-hidden="true"
                    className="text-ink"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </span>
              </summary>
              <p className="m-0 px-[22px] pb-[22px] text-[14.5px] leading-[1.6] text-muted">
                {item.a}
              </p>
            </details>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
