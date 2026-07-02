import { LogoMark } from "@/components/Logo";
import { SALES_EMAIL_HREF } from "@/lib/site";

export const metadata = {
  title: "You're in — Kaijiro",
  description: "Payment received — our team is setting up your AI receptionist.",
};

const NEXT_STEPS = [
  {
    title: "We review your details",
    desc: "Services, hours, staff and voice — loaded and double-checked by our team.",
  },
  {
    title: "You get forwarding instructions",
    desc: "A short email shows how to forward your current number. Takes about two minutes.",
  },
  {
    title: "Your receptionist goes live",
    desc: "We call you to confirm everything sounds right — then every call gets answered.",
  },
];

export default function ThanksPage() {
  return (
    <>
      <nav className="mx-auto max-w-shell px-[22px] pt-[14px]">
        <div className="flex w-full items-center justify-between gap-5 rounded-[18px] border border-ink/10 bg-cream/80 px-5 py-3 backdrop-blur-md">
          <a
            href="/"
            className="flex items-center gap-[7px] font-display text-[22px] tracking-tight no-underline"
          >
            <LogoMark className="h-5 w-5 rounded-[3.5px]" />
            Kaijiro
          </a>
        </div>
      </nav>
      <main className="mx-auto max-w-[640px] px-[22px] pb-[clamp(48px,7vw,88px)] pt-[clamp(40px,6vw,72px)]">
        <div className="text-center">
          <span className="inline-flex h-[54px] w-[54px] items-center justify-center rounded-full bg-[#2C7A4B]/10">
            <svg
              width="26"
              height="26"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#2C7A4B"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </span>
          <h1 className="mx-auto mt-5 max-w-[18ch] font-display text-[clamp(28px,5vw,44px)] font-light leading-[1.08] tracking-[-0.03em]">
            You're in. <span className="text-teal">We're on it.</span>
          </h1>
          <p className="mx-auto mt-[14px] max-w-[40ch] text-[15.5px] leading-[1.55] text-muted">
            Payment received. Our team starts your setup now and will reach out within one business
            day.
          </p>
        </div>

        <ol className="mt-9 flex flex-col gap-3">
          {NEXT_STEPS.map((step, i) => (
            <li
              key={step.title}
              className="flex items-start gap-[14px] rounded-[16px] bg-cream-100 px-[18px] py-4"
            >
              <span className="flex h-[28px] w-[28px] flex-none items-center justify-center rounded-full bg-ink text-[13px] font-semibold text-cream">
                {i + 1}
              </span>
              <span>
                <span className="block text-[15px] font-medium">{step.title}</span>
                <span className="mt-[2px] block text-[13.5px] leading-[1.5] text-muted">
                  {step.desc}
                </span>
              </span>
            </li>
          ))}
        </ol>

        <p className="mt-8 text-center text-[14px] text-muted">
          Questions in the meantime?{" "}
          <a href={SALES_EMAIL_HREF} className="font-medium text-teal">
            Email us
          </a>{" "}
          or head{" "}
          <a href="/" className="font-medium text-teal">
            back to the site
          </a>
          .
        </p>
      </main>
    </>
  );
}
