import { SiteHead } from "@/components/SiteHead";
import { getDict } from "@/lib/i18n/dict";
import { SITE_URL } from "@/lib/site";
import type { ReactNode } from "react";
import "../globals.css";

const { title, description } = getDict("es").meta;

export const metadata = { title, description };

export default function EsRootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <head>
        <SiteHead locale="es" title={title} description={description} url={`${SITE_URL}/es`} />
      </head>
      <body className="font-sans bg-cream text-ink">{children}</body>
    </html>
  );
}
