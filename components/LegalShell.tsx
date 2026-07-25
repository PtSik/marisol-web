import { LogoMark } from "@/components/Logo";
import { siteHref } from "@/lib/site";
import type { ReactNode } from "react";

export function LegalShell({
  title,
  updated,
  children,
}: { title: string; updated: string; children: ReactNode }) {
  return (
    <>
      <nav className="mx-auto max-w-shell px-[22px] pt-[14px]">
        <div className="flex w-full items-center justify-between gap-5 rounded-[18px] border border-ink/10 bg-cream/80 px-5 py-3 backdrop-blur-md">
          <a
            href={siteHref()}
            className="flex items-center gap-[7px] font-display text-[22px] tracking-tight no-underline"
          >
            <LogoMark className="h-5 w-5 rounded-[3.5px]" />
            Marisol
          </a>
          <a href={siteHref()} className="text-sm text-muted no-underline">
            ← Back to site
          </a>
        </div>
      </nav>
      <main className="mx-auto max-w-[72ch] px-[22px] pb-[clamp(48px,7vw,88px)] pt-[clamp(32px,5vw,56px)]">
        <h1 className="font-display text-[clamp(30px,5vw,44px)] font-light leading-[1.1] tracking-[-0.03em]">
          {title}
        </h1>
        <p className="mt-2 text-[13px] text-muted-4">Last updated: {updated}</p>
        <div className="legal-prose mt-8 flex flex-col gap-5 text-[15px] leading-[1.65] text-muted [&_h2]:mt-4 [&_h2]:font-display [&_h2]:text-[22px] [&_h2]:font-normal [&_h2]:tracking-[-0.02em] [&_h2]:text-ink [&_li]:ml-5 [&_ul]:flex [&_ul]:list-disc [&_ul]:flex-col [&_ul]:gap-2">
          {children}
        </div>
      </main>
    </>
  );
}
