import { SiteHead } from "@/components/SiteHead";
import { getDict } from "@/lib/i18n/dict";
import { SITE_URL } from "@/lib/site";
import type { ReactNode } from "react";
import "../globals.css";

const { title, description } = getDict("en").meta;

export const metadata = { title, description };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <SiteHead locale="en" title={title} description={description} url={SITE_URL} />
      </head>
      <body className="font-sans bg-cream text-ink">{children}</body>
    </html>
  );
}
