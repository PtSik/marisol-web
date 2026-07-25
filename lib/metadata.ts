import type { Locale } from "@/lib/i18n/dict";
import { SITE_URL } from "@/lib/site";

const OG_LOCALE: Record<Locale, string> = { en: "en_US", es: "es_US" };

// vinext replaces a parent `openGraph` wholesale rather than merging it, and cross-fills `twitter:*`
// from whatever openGraph ends up on the page — so every route has to hand back the complete object.
export function siteMetadata({
  locale,
  title,
  description,
  path = "",
}: { locale: Locale; title: string; description: string; path?: string }) {
  return {
    title,
    description,
    openGraph: {
      type: "website",
      siteName: "Marisol",
      locale: OG_LOCALE[locale],
      title,
      description,
      url: `${SITE_URL}${path}`,
      images: [{ url: `${SITE_URL}/og.png`, width: 1200, height: 630 }],
    },
  };
}
