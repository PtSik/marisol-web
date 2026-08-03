"use client";

import { LogoMark } from "@/components/Logo";
import { siteHref } from "@/lib/site";
import { usePathname } from "next/navigation";
import { useRef } from "react";

const LINKS = [
  { href: "/portal", label: "Overview" },
  { href: "/portal/forwarding", label: "Forwarding" },
  { href: "/portal/salons", label: "Salons" },
  { href: "/portal/setup", label: "Setup" },
  { href: "/portal/calendar", label: "Calendar" },
  { href: "/portal/billing", label: "Billing" },
  { href: "/portal/referrals", label: "Refer & earn" },
];

export interface NavShop {
  id: string;
  name: string;
}

function SalonSwitcher({ shops, activeShopId }: { shops: NavShop[]; activeShopId?: string }) {
  const pathname = usePathname();
  const formRef = useRef<HTMLFormElement>(null);

  if (shops.length < 2) return null;

  return (
    <form
      ref={formRef}
      method="post"
      action="/api/portal/switch-salon"
      className="order-2 sm:order-none"
    >
      <input type="hidden" name="return_to" value={pathname} />
      <label className="sr-only" htmlFor="salon-switcher">
        Switch salon
      </label>
      <select
        id="salon-switcher"
        name="shop_id"
        defaultValue={activeShopId}
        onChange={() => formRef.current?.requestSubmit()}
        className="rounded-[10px] border border-ink/15 bg-cream px-3 py-1.5 text-[14px] font-medium"
      >
        {shops.map((shop) => (
          <option key={shop.id} value={shop.id}>
            {shop.name}
          </option>
        ))}
      </select>
    </form>
  );
}

export function PortalNav({
  email,
  shops = [],
  activeShopId,
}: {
  email: string;
  shops?: NavShop[];
  activeShopId?: string;
}) {
  const pathname = usePathname();

  return (
    <nav className="mx-auto max-w-shell px-[22px] pt-[14px]">
      <div className="flex w-full flex-wrap items-center justify-between gap-x-5 gap-y-3 rounded-[18px] border border-ink/10 bg-cream/80 px-5 py-3 backdrop-blur-md">
        <a
          href={siteHref()}
          className="flex items-center gap-[7px] font-display text-[22px] tracking-tight no-underline"
        >
          <LogoMark className="h-5 w-5 rounded-[3.5px]" />
          Marisol
        </a>
        <ul className="order-3 flex w-full list-none flex-wrap items-center gap-x-1 gap-y-1 p-0 sm:order-none sm:w-auto">
          {LINKS.map((link) => {
            const active = pathname === link.href;
            return (
              <li key={link.href}>
                <a
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={`inline-block rounded-[10px] px-3 py-1.5 text-[14px] no-underline ${
                    active ? "bg-ink text-cream font-medium" : "text-muted hover:bg-ink/5"
                  }`}
                >
                  {link.label}
                </a>
              </li>
            );
          })}
        </ul>
        <div className="flex items-center gap-3">
          <SalonSwitcher shops={shops} activeShopId={activeShopId} />
          <form method="post" action="/api/auth/logout" className="flex items-center gap-3">
            <span className="hidden text-[13px] text-muted-2 sm:inline">{email}</span>
            <button type="submit" className="text-[14px] font-medium text-teal">
              Sign out
            </button>
          </form>
        </div>
      </div>
    </nav>
  );
}
