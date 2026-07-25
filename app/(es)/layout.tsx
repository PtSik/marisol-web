import { SiteHead } from "@/components/SiteHead";
import { getDict } from "@/lib/i18n/dict";
import { siteMetadata } from "@/lib/metadata";
import type { ReactNode } from "react";
import "../globals.css";

const { title, description } = getDict("es").meta;

export const metadata = siteMetadata({ locale: "es", title, description, path: "/es" });

export default function EsRootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <head>
        <SiteHead />
      </head>
      <body className="font-sans bg-cream text-ink">{children}</body>
    </html>
  );
}
