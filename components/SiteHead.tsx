// Everything social (og:*, twitter:*) is declared in each route's `metadata` instead — rendering any
// of it here as well duplicates the tag on pages that set their own.
export function SiteHead() {
  return (
    <>
      <link rel="icon" href="/logo.svg" type="image/svg+xml" />
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      {/* Fraunces is requested as a full variable font across four axes, not three static weights:
          SOFT and WONK only exist in the four-axis build, and the headline treatment depends on
          them. Costs roughly 2x the font payload, which is the argument for moving this to
          next/font (self-hosted, non-blocking) rather than leaving it on a blocking <link>. */}
      <link
        href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght,SOFT,WONK@9..144,400..800,0..100,0..1&family=Inter:wght@400;500;600&display=swap"
        rel="stylesheet"
      />
    </>
  );
}
