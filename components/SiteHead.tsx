// Everything social (og:*, twitter:*) is declared in each route's `metadata` instead — rendering any
// of it here as well duplicates the tag on pages that set their own.
export function SiteHead() {
  return (
    <>
      <link rel="icon" href="/logo.svg" type="image/svg+xml" />
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link
        href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,400;9..144,500&family=Inter:wght@400;500;600&display=swap"
        rel="stylesheet"
      />
    </>
  );
}
