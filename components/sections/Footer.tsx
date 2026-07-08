import { LogoMark } from "@/components/Logo";
import { CUSTOMER_PORTAL_URL, DEMO_PHONE, telHref } from "@/lib/site";

export function Footer() {
  return (
    <footer className="border-t border-cream-200 bg-cream-100">
      <div className="mx-auto flex max-w-content flex-col gap-10 px-[22px] py-[clamp(34px,5vw,56px)] md:flex-row md:items-start md:justify-between">
        <div className="max-w-[34ch]">
          <div className="mb-[10px] flex items-center gap-[7px] font-display text-xl tracking-[-0.03em] sm:text-2xl">
            <LogoMark className="h-[22px] w-[22px] rounded-[4px]" />
            Marisol
          </div>
          <p className="m-0 text-[13.5px] leading-[1.55] text-muted-2">
            The AI front desk for barbershops, spas, salons, grooming studios and many more.
          </p>
          <p className="m-0 mt-2 text-[12.5px] text-muted-4">a Kaijiro Labs product</p>
          <a
            href={telHref}
            className="mt-[14px] inline-block font-display text-xl tracking-[-0.02em] text-ink no-underline"
          >
            {DEMO_PHONE}
          </a>
        </div>

        <div className="flex justify-between gap-8 border-t border-cream-200 pt-9 md:justify-start md:gap-[clamp(40px,7vw,64px)] md:border-0 md:pt-0">
          <nav className="flex flex-col gap-3 text-sm text-muted" aria-label="Product">
            <span className="mb-[2px] text-[11.5px] uppercase tracking-[0.12em] text-muted-4">
              Product
            </span>
            <a href="#demo" className="no-underline">
              Live demo
            </a>
            <a href="#how" className="no-underline">
              How it works
            </a>
            <a href="#pricing" className="no-underline">
              Pricing
            </a>
            <a href="#faq" className="no-underline">
              FAQ
            </a>
          </nav>
          <nav className="flex flex-col gap-3 text-sm text-muted" aria-label="Company">
            <span className="mb-[2px] text-[11.5px] uppercase tracking-[0.12em] text-muted-4">
              Company
            </span>
            <a href="/privacy" className="no-underline">
              Privacy
            </a>
            <a href="/terms" className="no-underline">
              Terms
            </a>
            <a href={telHref} className="no-underline">
              Contact
            </a>
            {CUSTOMER_PORTAL_URL && (
              <a href={CUSTOMER_PORTAL_URL} className="no-underline">
                Manage subscription
              </a>
            )}
          </nav>
        </div>
      </div>

      <div className="border-t border-cream-200">
        <div className="mx-auto flex max-w-content flex-wrap items-center justify-between gap-[10px] px-[22px] py-[18px] text-[12.5px] text-muted-4">
          <span>© 2026 Kaijiro Labs. All rights reserved.</span>
        </div>
      </div>
    </footer>
  );
}
