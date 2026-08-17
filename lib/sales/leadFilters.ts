// Which businesses count as leads, where they sit, and what the scraper reads off their site.
//
// This lives in lib/ rather than next to the scraper on purpose. The original get-leads.ts was only
// ever in `scripts/`, which .gitignore excludes, so when it was lost the sourcing rules went with it
// — and `scoreLead`/`tier` in derive.ts, which nothing in the app calls, quietly drifted from the
// data they had produced. Rules that decide who the team dials belong under test.
//
// Scoring itself is NOT here: `scoreLead` and `tier` stay in derive.ts, and both this module's
// callers and the /sales panel read them from there, so old and new leads can never diverge.

export interface Area {
  /** Stored as `neighborhood` in D1 and shown as the filter in /sales. */
  name: string;
  /** Appended to the Places text query. */
  searchIn: string;
  /**
   * Extra places to run the same queries against, for areas that cover more than one town. Without
   * these an area only collects whatever Places happens to return from `searchIn` — the first
   * Fort Lauderdale run picked up eight Pompano/Coral Springs shops by accident and would have
   * missed the rest of them.
   */
  alsoSearch?: string[];
  /**
   * The city as USPS writes it, when the area is an incorporated one. Matched before `zips` — and
   * it has to be, because Hialeah and Miami Lakes share 33014 and 33016, so the ZIP alone cannot
   * tell "1228 W 79th St, Hialeah, FL 33014" from "6934 Holly Rd, Miami Lakes, FL 33014". Both are
   * in D1 today, under different neighbourhoods. Omitted for the areas USPS calls "Miami".
   */
  city?: string[];
  /** Inclusive ZIP ranges, used when the city does not resolve. Must not overlap between areas. */
  zips: [number, number][];
  /**
   * How the team works this area. `walk` opens /sales on the route instead of the call queue, which
   * drops the leads a rep cannot walk into — a mobile groomer has no door, and it is the highest
   * scoring kind of lead we have.
   */
  channel?: Channel;
}

export type Channel = "call" | "walk";

// A lead's area comes from its own address, never from the query that found it: ~10 rows in the
// first Miami run were mislabelled because the query decided — EDUGROOMER was tagged "West Kendall"
// while sitting in Coconut Grove, Petfolk was tagged "Kendall" from Pinecrest.
export const AREAS: Record<string, Area> = {
  // Miami — the six that produced the current list. Kept so a full re-run reproduces it.
  hialeah: {
    name: "Hialeah",
    searchIn: "Hialeah, FL",
    city: ["hialeah"],
    // 33014/33016 also cover Miami Lakes; an address in either that names neither city is far more
    // likely to be Hialeah, which has 41 leads to Miami Lakes' 3.
    zips: [[33010, 33018]],
  },
  doral: {
    name: "Doral",
    searchIn: "Doral, FL",
    city: ["doral"],
    zips: [
      [33122, 33122],
      [33166, 33166],
      [33172, 33172],
      [33178, 33178],
    ],
  },
  westchester: {
    name: "Westchester",
    searchIn: "Westchester, Miami, FL",
    zips: [
      [33144, 33144],
      [33155, 33155],
      [33165, 33165],
    ],
  },
  "west-kendall": {
    name: "West Kendall",
    searchIn: "West Kendall, Miami, FL",
    zips: [
      [33175, 33175],
      [33183, 33183],
      [33185, 33186],
      [33193, 33193],
      [33196, 33196],
    ],
  },
  kendall: {
    name: "Kendall",
    searchIn: "Kendall, Miami, FL",
    city: ["south miami"],
    zips: [
      // 33143 is South Miami / Glenvar Heights, contiguous with 33156 and part of the same
      // affluent, English-speaking south-Dade cluster.
      [33143, 33143],
      [33156, 33156],
      [33173, 33173],
      [33176, 33176],
    ],
  },
  // City-only: every ZIP Miami Lakes uses is shared with Hialeah, so a range here would take rows
  // whose address says "Hialeah" outright.
  "miami-lakes": {
    name: "Miami Lakes",
    searchIn: "Miami Lakes, FL",
    city: ["miami lakes"],
    zips: [],
  },

  // Duval / St. Johns / Broward — separate metros, not Miami neighbourhoods. The Spanish signal that
  // carries Miami is close to absent in Jacksonville and St. Augustine, so expect those two to score
  // 3-5 points lower for the same quality of shop.
  jacksonville: {
    name: "Jacksonville",
    searchIn: "Jacksonville, FL",
    // Jacksonville is the largest US city by land area; one text query returns downtown and stops.
    alsoSearch: [
      "Jacksonville Beach, FL",
      "Mandarin, Jacksonville, FL",
      "Southside, Jacksonville, FL",
    ],
    city: [
      "jacksonville",
      "jacksonville beach",
      "atlantic beach",
      "neptune beach",
      // Clay County commuter suburbs — twenty to thirty-five minutes from downtown.
      "orange park",
      "middleburg",
    ],
    zips: [
      [32065, 32068],
      [32202, 32212],
      [32216, 32226],
      [32233, 32234],
      [32244, 32246],
      [32250, 32250],
      [32254, 32258],
      [32266, 32266],
      [32277, 32277],
    ],
  },
  "st-augustine": {
    name: "St. Augustine",
    searchIn: "St. Augustine, FL",
    city: [
      "st. augustine",
      "saint augustine",
      "st augustine",
      "st. augustine beach",
      "st johns",
      // Ponte Vedra is St. Johns County, roughly halfway to Jacksonville. Filed here because the
      // county line is what a rep planning a day actually drives around.
      "ponte vedra beach",
      "ponte vedra",
    ],
    zips: [
      [32033, 32033],
      [32080, 32080],
      [32081, 32082],
      [32084, 32086],
      [32092, 32092],
      [32095, 32095],
      [32145, 32145],
      [32259, 32259],
    ],
  },
  "fort-lauderdale": {
    name: "Fort Lauderdale",
    searchIn: "Fort Lauderdale, FL",
    // Greater Broward, not the city limits: the team drives this metro, and Pompano to Fort
    // Lauderdale is twenty minutes. Hollywood, Miramar and Pembroke Pines are deliberately left
    // out — they are their own cluster and were flagged as a separate batch.
    alsoSearch: ["Pompano Beach, FL", "Coral Springs, FL", "Sunrise, FL"],
    city: [
      "fort lauderdale",
      "ft lauderdale",
      "ft. lauderdale",
      "oakland park",
      "wilton manors",
      "pompano beach",
      "lighthouse point",
      "coral springs",
      "north lauderdale",
      "sunrise",
      "plantation",
      "tamarac",
      "lauderhill",
      "margate",
      "coconut creek",
      "parkland",
      "davie",
      "weston",
      // Deerfield Beach is Broward outright and was missed on the first run; Boca Raton is Palm
      // Beach County but twenty minutes up the road, and the team drives this metro.
      "deerfield beach",
      "boca raton",
    ],
    zips: [
      // North Broward: Pompano, Lighthouse Point, Margate, Coral Springs, North Lauderdale,
      // Coconut Creek, Parkland.
      [33060, 33076],
      // Boca Raton and Deerfield Beach.
      [33431, 33434],
      [33441, 33443],
      // Fort Lauderdale proper and west Broward. 33323 sat in a gap between 33322 and 33324 and
      // 33351 was missing outright, so four Sunrise shops came back as "other (333xx)".
      [33301, 33301],
      [33304, 33306],
      [33308, 33309],
      [33311, 33313],
      [33315, 33317],
      [33319, 33319],
      [33321, 33328],
      [33330, 33334],
      [33351, 33351],
    ],
  },

  // North-east Miami-Dade. ZIP-only, like Westchester and Kendall and for the same reason: USPS
  // writes "Miami" here too, and `city` is matched first, so a city list would swallow half of
  // Dade county.
  "north-miami": {
    name: "North Miami",
    searchIn: "North Miami, FL",
    alsoSearch: ["North Miami Beach, FL", "Miami Shores, FL"],
    zips: [
      [33147, 33147],
      [33150, 33150],
      [33161, 33162],
      [33167, 33168],
      [33179, 33179],
      [33181, 33181],
    ],
  },

  // Fairfield County, Connecticut — the first market outside Florida and the first one sold on
  // foot. Greater Bridgeport rather than the town line: Stratford alone is 52k people and would
  // run dry in a week, while Bridgeport to Milford is one drive.
  //
  // ZIPs are written without their leading zero: `zips` are numbers, `zipOf` parses "06614" to
  // 6614, and `06614` is an illegal octal literal in TypeScript.
  stratford: {
    name: "Stratford",
    searchIn: "Stratford, CT",
    alsoSearch: [
      "Bridgeport, CT",
      "Milford, CT",
      "Trumbull, CT",
      "Shelton, CT",
      "Fairfield, CT",
      "Monroe, CT",
      "Derby, CT",
      "Westport, CT",
    ],
    city: [
      "stratford",
      "bridgeport",
      "milford",
      // Devon is Milford's own postal name for 06460 and appears on Places addresses as such.
      "devon",
      "trumbull",
      "shelton",
      "fairfield",
      "southport",
      // The ring the first run left in `other (…)`: every one of these is a shorter drive from
      // Stratford than Fairfield's own 06824, which has been in the area since day one. A rep
      // drives between doors here — the route is walked block by block, not town to town.
      "monroe",
      "ansonia",
      "derby",
      "westport",
      "newtown",
      "sandy hook",
    ],
    zips: [
      // Fairfield and Southport.
      [6430, 6432],
      [6890, 6890],
      [6824, 6825],
      // Milford and Devon.
      [6460, 6461],
      [6484, 6484],
      // Stratford's PO boxes, which some listings use instead of a street ZIP.
      [6497, 6497],
      // Bridgeport (06604-06610) and Trumbull (06611). 06612 is Easton — rural, off the route,
      // deliberately outside the range.
      [6604, 6611],
      [6614, 6615],
      // Ansonia and Derby, up the Naugatuck valley from Shelton.
      [6401, 6401],
      [6418, 6418],
      // Monroe, and Newtown with Sandy Hook behind it.
      [6468, 6468],
      [6470, 6470],
      [6482, 6482],
      // Westport. 06883 is Weston — rural and off the route, left out like Easton.
      [6880, 6881],
      [6888, 6888],
    ],
    channel: "walk",
  },

  // Greater New Haven — reached by the Stratford run's `alsoSearch` spilling east, not scraped on
  // its own yet, so the five leads here are leftovers rather than coverage. Dialled rather than
  // walked: three fixed shops scattered across a 135k city is not a day on foot.
  "new-haven": {
    name: "New Haven",
    searchIn: "New Haven, CT",
    alsoSearch: ["West Haven, CT", "Hamden, CT", "Cheshire, CT"],
    city: [
      "new haven",
      "west haven",
      "east haven",
      "woodbridge",
      "hamden",
      "cheshire",
      "orange",
      "bethany",
    ],
    zips: [
      [6410, 6410],
      [6477, 6477],
      // New Haven proper, plus East Haven (06512), West Haven (06516) and Hamden (06514/06517-18).
      [6510, 6521],
      [6524, 6525],
    ],
  },
};

/** How the team works the area a lead sits in. Unconfigured areas — `Other` — dial. */
export const channelForArea = (neighborhood: string): Channel => {
  for (const area of Object.values(AREAS)) {
    if (area.name === neighborhood) return area.channel ?? "call";
  }
  return "call";
};

// Spanish queries stay in the rotation because they surface shops an English query misses, but which
// query found a shop is metadata only — Places matches semantically, so "peluqueria canina" returns
// English-named businesses too. Scoring it handed +3 to nearly the whole list and the ranking
// stopped separating anything.
export const VERTICALS: Record<string, string[]> = {
  grooming: [
    "dog grooming",
    "pet grooming",
    "mobile dog grooming",
    "pet groomer",
    "peluqueria canina",
    "grooming movil para perros",
    "estetica canina",
  ],
  barbershop: ["barbershop", "barber shop", "barberia"],
  salon: ["nail salon", "hair salon", "salon de unas", "peluqueria"],
};

/** Queries whose hits mean nothing about the shop's language — recorded, never scored. */
export const ES_QUERY = /peluquer|m[oó]vil|movil|est[eé]tica|estetica|u[nñ]as|unas|barberia/i;

// Applied before scoring: about 30% of the first Miami run was not a groomer at all — 13 vets, 5
// breeders, 3 pet stores, 3 schools, 1 photographer in the first 99 rows alone.
const EXCLUDE: { reason: string; re: RegExp }[] = [
  {
    reason: "veterinary",
    re: /\b(veterinary|veterinarian|animal clinic|animal hospital|animal center|vet clinic|vet hospital|urgent care|veterinaria|clinica veterinaria)\b|\bvca\b/i,
  },
  {
    reason: "breeder/puppy store",
    re: /\b(puppies|puppy store|puppy city|puppy mansion|for sale|kittens|breeder|cachorros)\b/i,
  },
  { reason: "school", re: /\b(academy|grooming school|groomer training|institute|edugroomer)\b/i },
  { reason: "photography", re: /\b(photography|photographer|fotografia)\b/i },
  { reason: "botanica", re: /\bbotanica\b/i },
];

// A pet shop only counts if it also grooms.
const PET_STORE = /\b(pet supply|pet supplies|pet store|pet shop|feed store)\b/i;
const GROOMS = /\b(groom|grooming|peluquer|est[eé]tica|estetica|spa|bath|ba[nñ]o)\b/i;

/** `""` when the business belongs in the queue, otherwise the reason it does not. */
export function excludedReason(name: string, siteText = ""): string {
  const haystack = `${name} ${siteText}`;
  for (const { reason, re } of EXCLUDE) if (re.test(haystack)) return reason;
  if (PET_STORE.test(name) && !GROOMS.test(haystack)) return "pet store, no grooming";
  return "";
}

// Chains are caught by brand, never by a name repeating in the results — VCA appeared twice and
// Petfolk twice, both flagged is_chain: no, and a franchise location decides nothing on its own.
//
// `Petland` is deliberately absent: it is a franchise, but it was not on the list the original run
// used (Petland Miami sits in D1 with is_chain = 0), and adding it would judge new cities by a rule
// the existing 120 leads were never subject to.
export const CHAIN_BRANDS = [
  "vca",
  "petfolk",
  "petsmart",
  "petco",
  "banfield",
  "woof gang",
  "scenthound",
  "camp bow wow",
  "dogtopia",
  "pet supermarket",
];

export const isChainBrand = (name: string): boolean =>
  CHAIN_BRANDS.some((brand) => name.toLowerCase().includes(brand));

// Read from the name or the site's own copy — never from the query. "grooming movil" as a query
// flagged a pet photographer, two puppy stores and two boarding hotels as mobile, +4 each.
const MOBILE_NAME = /\b(mobile|m[oó]vil|movil|van|on wheels|a domicilio)\b/i;
const MOBILE_SITE = /\b(we come to you|mobile grooming|vamos a tu casa|a domicilio|our van)\b/i;

export const isMobileName = (name: string): boolean => MOBILE_NAME.test(name);
export const isMobileSite = (siteText: string): boolean => MOBILE_SITE.test(siteText);

// Booking systems recognised on a shop website. The names match the set derive.ts scores against, so
// a system added here has to be added there too or it stops costing the lead its -2.
export const BOOKING_HOSTS: [string, RegExp][] = [
  ["booksy", /booksy\.com/i],
  ["vagaro", /vagaro\.com/i],
  ["squire", /getsquire\.com|squire\.com/i],
  ["acuity", /acuityscheduling\.com/i],
  ["square", /squareup\.com\/appointments|square\.site/i],
  ["schedulicity", /schedulicity\.com/i],
  ["setmore", /setmore\.com/i],
  ["fresha", /fresha\.com/i],
  ["moego", /moego\.pet|moegoapp\.com/i],
  ["gingr", /gingrapp\.com/i],
];

/** `null` when the page names no system — the caller turns that into "none" or "unknown". */
export function bookingAppIn(html: string): string | null {
  for (const [name, re] of BOOKING_HOSTS) if (re.test(html)) return name;
  return null;
}

// Enough to tell a Spanish page from an English one without pulling in a language library.
const ES_WORDS =
  /\b(y|de|la|el|los|las|para|con|nuestro|nuestros|servicios|perros|gatos|mascotas|precio|precios|cita|citas|nosotros|contacto|hogar|inicio)\b/gi;
const EN_WORDS =
  /\b(and|the|of|for|with|our|services|dogs|cats|pets|price|prices|appointment|about|contact|home)\b/gi;
const ES_NAME =
  /\b(peluquer[ií]a|canina|mascota|mascotas|perro|perros|patas|pelu|ba[nñ]o|est[eé]tica|estetica|hermoso|bella|lindo|lujo|amigo|huellas|cachorro|gu[aá]u)\b/i;

export const isEsName = (name: string): boolean => ES_NAME.test(name);

export function isEsSite(html: string, text: string): boolean {
  const declared = html.match(/<html[^>]*\blang\s*=\s*["']?([a-z-]+)/i)?.[1] ?? "";
  if (declared.startsWith("es")) return true;
  const es = (text.match(ES_WORDS) ?? []).length;
  const en = (text.match(EN_WORDS) ?? []).length;
  return es >= 12 && es > en * 1.5;
}

/** Share of the sampled reviews written in Spanish that makes the signal real. */
export const ES_REVIEW_SHARE = 0.3;

export interface ScrapedPrices {
  prices: string | null;
  priceConfidence: "high" | "low";
}

// A dog groom does not cost $10 — anything under $25 is a promotion ("$10 off"), not a price. One
// number is never enough either; it was the spread that made Furganic's $60/$70/$80/$90 trustworthy
// where Tito's lone "$10" was not.
export function scrapePrices(text: string): ScrapedPrices {
  const values = [...text.matchAll(/\$\s?(\d{1,4})(?:\.\d{2})?\b/g)]
    .map((m) => Number(m[1]))
    .filter((n) => n >= 25 && n <= 1000);
  const unique = [...new Set(values)].sort((a, b) => a - b);
  if (unique.length < 2) return { prices: null, priceConfidence: "low" };
  return { prices: unique.map((n) => `$${n}`).join(" "), priceConfidence: "high" };
}

/** The last 5-digit group in a formatted US address, so a street number never wins. */
export function zipOf(address: string): number | null {
  const matches = [...address.matchAll(/\b(\d{5})(?:-\d{4})?\b/g)];
  const last = matches.at(-1);
  return last ? Number(last[1]) : null;
}

/**
 * The city out of "1228 W 79th St, Hialeah, FL 33014" — the comma-separated part just before the
 * state-and-ZIP one. `null` when the address is not in that shape.
 */
export function cityOf(address: string): string | null {
  const parts = address.split(",").map((p) => p.trim());
  const stateIndex = parts.findIndex((p) => /^[A-Z]{2}\b\s*\d{0,5}/.test(p) && p.length <= 9);
  const city = stateIndex > 0 ? parts[stateIndex - 1] : null;
  return city && /[A-Za-z]/.test(city) ? city.toLowerCase() : null;
}

/** The area whose city list names this one, or `null`. */
export function areaForCity(city: string | null): string | null {
  if (!city) return null;
  for (const area of Object.values(AREAS)) {
    if (area.city?.includes(city)) return area.name;
  }
  return null;
}

/** The area name for a ZIP, or `null` when it falls outside every configured area. */
export function areaForZip(zip: number | null): string | null {
  if (zip === null) return null;
  for (const area of Object.values(AREAS)) {
    if (area.zips.some(([lo, hi]) => zip >= lo && zip <= hi)) return area.name;
  }
  return null;
}

/** Everything more than about forty minutes from a configured area, under one filter chip. */
export const OTHER_AREA = "Other";

/**
 * What lands in `neighborhood`. City first, then ZIP.
 *
 * Anything outside every configured area stays in the list — Places reaches well past the metro it
 * was asked about, and those shops are still worth a cold call — but it goes under one label rather
 * than one per town. Naming the town read better on a single lead and turned the area filter into
 * 23 chips holding one lead each; the address on the card says where the shop is anyway.
 *
 * The areas are drawn so that anything within a ~40 minute drive belongs to one of them, a rep
 * having a car and not only feet. What is left is genuinely scattered — five separate Florida
 * markets, one lead on Long Island — and no chip per town would make that workable.
 *
 * `fallback` is the area being scraped, used only when Places returned no address at all — three
 * leads in D1 are in that state.
 */
export const neighborhoodFor = (address: string | null, fallback?: string): string => {
  if (!address?.trim()) return fallback ?? OTHER_AREA;
  const byCity = areaForCity(cityOf(address));
  if (byCity) return byCity;

  return areaForZip(zipOf(address)) ?? OTHER_AREA;
};

/** Street address, lowercased and punctuation-free, for spotting two names at one address. */
export const normalizeAddress = (address: string): string =>
  address
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export function instagramIn(html: string): string | null {
  const handle = html.match(/instagram\.com\/([A-Za-z0-9._]{2,30})/i)?.[1];
  if (!handle || /^(p|reel|reels|explore|accounts|stories)$/i.test(handle)) return null;
  return `@${handle}`;
}

/** Visible copy, with scripts and markup stripped — what the language and price checks read. */
export const visibleText = (html: string): string =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ");
