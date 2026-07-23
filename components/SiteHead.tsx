import type { Locale } from "@/lib/i18n/dict";
import { SITE_URL } from "@/lib/site";

const OG_LOCALE: Record<Locale, string> = { en: "en_US", es: "es_US" };

export function SiteHead({
  locale,
  title,
  description,
  url,
}: { locale: Locale; title: string; description: string; url: string }) {
  return (
    <>
      <link rel="icon" href="/logo.svg" type="image/svg+xml" />
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content="Marisol" />
      <meta property="og:locale" content={OG_LOCALE[locale]} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={`${SITE_URL}/og.png`} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={`${SITE_URL}/og.png`} />
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link
        href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,400;9..144,500&family=Inter:wght@400;500;600&display=swap"
        rel="stylesheet"
      />
    </>
  );
}
