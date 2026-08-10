import { describe, expect, test } from "bun:test";
import { scoreLead, tier } from "@/lib/sales/derive";
import {
  AREAS,
  ES_QUERY,
  areaForZip,
  bookingAppIn,
  cityOf,
  excludedReason,
  instagramIn,
  isChainBrand,
  isEsName,
  isEsSite,
  isMobileName,
  isMobileSite,
  neighborhoodFor,
  normalizeAddress,
  scrapePrices,
  visibleText,
  zipOf,
} from "@/lib/sales/leadFilters";

// The cases below are the concrete rows the first Miami run got wrong, kept as regressions.

describe("business type exclusions", () => {
  test("rejects the vets that made up 13 of the first 99 rows", () => {
    for (const name of [
      "Fontes Animal Clinic",
      "Miami Springs Animal Hospital",
      "JCB Vet Clinic",
      "VCA South Dade Animal Hospital",
      "Lidia's Veterinary",
      "Clinica Veterinaria Los Angeles",
    ]) {
      expect(excludedReason(name)).toBe("veterinary");
    }
  });

  test("rejects breeders and puppy stores", () => {
    expect(excludedReason("Puppy Mansion")).toBe("breeder/puppy store");
    expect(excludedReason("Cutest Puppies Forever")).toBe("breeder/puppy store");
    expect(excludedReason("Gorgeous Puppies and Kittens")).toBe("breeder/puppy store");
  });

  test("rejects grooming schools but keeps working groomers", () => {
    expect(excludedReason("EDUGROOMER")).toBe("school");
    expect(excludedReason("Boujee Pet Grooming School")).toBe("school");
    expect(excludedReason("Dog Grooming USA & Groomer Artist Academy")).toBe("school");
    expect(excludedReason("Boujee Mobile Pet Grooming")).toBe("");
  });

  test("rejects the photographer that scored +4 for mobility it does not have", () => {
    expect(excludedReason("DogExpression Mobile Pet Photography")).toBe("photography");
  });

  test("rejects a botanica, which is a religious-goods shop", () => {
    expect(excludedReason("Botanica San Lazaro")).toBe("botanica");
  });

  test("keeps a pet shop only when it also grooms", () => {
    expect(excludedReason("Red Lories Pet Supply")).toBe("pet store, no grooming");
    expect(excludedReason("Raw and Kibble Pet Store")).toBe("pet store, no grooming");
    expect(excludedReason("Grooming Pet Shop And Poppis")).toBe("");
    // Kenia's Pet Shop is in D1 today; its site sells grooming, which is what keeps it.
    expect(excludedReason("Kenia's Pet Shop", "full grooming and bath services")).toBe("");
  });

  test("a dog hotel or daycare is still a lead — it was never on the exclusion list", () => {
    expect(excludedReason("Doggies Gone Wild")).toBe("");
    expect(excludedReason("Lilo's Dog Hotels & Daycare")).toBe("");
  });
});

describe("chain detection by brand", () => {
  test("catches the brands that slipped through as is_chain: no", () => {
    expect(isChainBrand("VCA South Dade Animal Hospital")).toBe(true);
    expect(isChainBrand("Petfolk Pinecrest")).toBe(true);
    expect(isChainBrand("Woof Gang Bakery & Grooming Kendall")).toBe(true);
    expect(isChainBrand("Pet Supermarket")).toBe(true);
  });

  test("leaves single-location shops alone", () => {
    expect(isChainBrand("Gaston Mobile Grooming")).toBe(false);
    expect(isChainBrand("Patas de Lujo")).toBe(false);
  });

  test("Petland stays off the list, matching the existing D1 row", () => {
    // Deliberate: Petland Miami sits in D1 with is_chain = 0. Adding the brand would score new
    // cities by a rule the existing 120 leads were never subject to.
    expect(isChainBrand("Petland Miami")).toBe(false);
  });
});

describe("mobile detection", () => {
  test("reads the name", () => {
    expect(isMobileName("Nadia Mobile Grooming")).toBe(true);
    expect(isMobileName("Grooming Movil Miami")).toBe(true);
    expect(isMobileName("Peluqueria Canina a Domicilio")).toBe(true);
    expect(isMobileName("Ruffo's Pet Club")).toBe(false);
  });

  test("reads the site copy", () => {
    expect(isMobileSite("We come to you anywhere in Broward")).toBe(true);
    expect(isMobileSite("Vamos a tu casa el mismo dia")).toBe(true);
    expect(isMobileSite("Visit our salon on Main Street")).toBe(false);
  });

  test("the query is not an input — that is what flagged a photographer and two hotels", () => {
    // "grooming movil para perros" is a query, and no exported helper accepts one.
    expect(isMobileName("Doggies Gone Wild")).toBe(false);
    expect(isMobileName("Puppy Mansion")).toBe(false);
  });
});

describe("Spanish signal", () => {
  test("a Spanish query carries no signal at all", () => {
    // Kept as metadata, matched only so the scraper can label it — never scored.
    expect(ES_QUERY.test("peluqueria canina")).toBe(true);
    expect(ES_QUERY.test("grooming movil para perros")).toBe(true);
    expect(ES_QUERY.test("dog grooming")).toBe(false);
  });

  test("a Spanish name counts", () => {
    expect(isEsName("Patas de Lujo")).toBe(true);
    expect(isEsName("Peluqueria Canina Bella")).toBe(true);
    expect(isEsName("LAS TRES YE MOBILE PET GROOMING")).toBe(false);
  });

  test("a declared lang=es page counts", () => {
    expect(isEsSite('<html lang="es-419">', "whatever")).toBe(true);
  });

  test("word density decides when the page declares nothing", () => {
    const es =
      "Servicios de peluqueria para perros y gatos. Nuestros precios para mascotas, " +
      "contacto y citas con nosotros en la tienda. El inicio de nuestro hogar de mascotas.";
    const en =
      "Services for dogs and cats. Our prices for pets, contact and appointments with " +
      "us at the shop. Read about the home of our pets and the appointment options.";
    expect(isEsSite("<html>", es)).toBe(true);
    expect(isEsSite("<html>", en)).toBe(false);
  });

  test("scoring turns name/site into strong and reviews-only into weak", () => {
    const strong = scoreLead({
      is_mobile: false,
      is_chain: false,
      booking_app: "none",
      review_count: 100,
      es_strength: "strong",
    });
    const weak = scoreLead({
      is_mobile: false,
      is_chain: false,
      booking_app: "none",
      review_count: 100,
      es_strength: "weak",
    });
    expect(strong - weak).toBe(1);
  });
});

describe("booking systems", () => {
  test("recognises the hosts that appear in the current data", () => {
    expect(bookingAppIn('<a href="https://booksy.com/en-us/1234">Book</a>')).toBe("booksy");
    expect(bookingAppIn('<iframe src="https://www.vagaro.com/x"></iframe>')).toBe("vagaro");
    expect(bookingAppIn('<a href="https://go.moego.pet/online/abc">Book</a>')).toBe("moego");
    expect(bookingAppIn('<a href="https://www.fresha.com/a/x">Book</a>')).toBe("fresha");
    expect(bookingAppIn('<a href="https://x.gingrapp.com/">Portal</a>')).toBe("gingr");
  });

  test("null when the page names none, which the caller turns into 'none'", () => {
    expect(bookingAppIn("<p>Call us to book</p>")).toBeNull();
  });

  test("a booking system demotes but never excludes — a booking page does not answer the phone", () => {
    const withApp = scoreLead({
      is_mobile: true,
      is_chain: false,
      booking_app: "booksy",
      review_count: 100,
      es_strength: "none",
    });
    expect(withApp).toBeGreaterThan(0);
  });
});

describe("price scraping", () => {
  test("rejects the promotions that came back as prices", () => {
    // Tito's "$10" was "$10 off", not a groom.
    expect(scrapePrices("Save $10 off your first visit!")).toEqual({
      prices: null,
      priceConfidence: "low",
    });
    expect(scrapePrices("$10 and $20 specials")).toEqual({ prices: null, priceConfidence: "low" });
  });

  test("keeps a real menu, sorted and de-duplicated", () => {
    expect(scrapePrices("Full groom $80, bath $60, deshed $90, nails $70, bath $60")).toEqual({
      prices: "$60 $70 $80 $90",
      priceConfidence: "high",
    });
  });

  test("one number is never enough — the spread is what makes it trustworthy", () => {
    expect(scrapePrices("Full groom from $65")).toEqual({ prices: null, priceConfidence: "low" });
  });

  test("ignores absurd figures that are not service prices", () => {
    expect(scrapePrices("Financing up to $5000 and grooming from $45 to $85")).toEqual({
      prices: "$45 $85",
      priceConfidence: "high",
    });
  });
});

describe("area from ZIP, never from the query", () => {
  test("takes the last five-digit group so a street number cannot win", () => {
    expect(zipOf("3550 NW 83rd Ave Apt 501, Doral, FL 33122")).toBe(33122);
    expect(zipOf("12345 SW 8th St, Miami, FL 33184-1234")).toBe(33184);
  });

  test("re-homes the rows the query mislabelled", () => {
    // Princess Pet Grooming was tagged Miami Lakes with a Hialeah address.
    expect(areaForZip(33012)).toBe("Hialeah");
    // EDUGROOMER was tagged West Kendall from Coconut Grove — outside every area.
    expect(areaForZip(33133)).toBeNull();
    // Petfolk was tagged Kendall from Pinecrest.
    expect(areaForZip(33156)).toBe("Kendall");
  });

  test("adopted suburbs land in the metro a rep would drive them with", () => {
    // Deerfield Beach is Broward outright; Boca is twenty minutes further up US-1.
    expect(neighborhoodFor("947 S Federal Hwy, Deerfield Beach, FL 33441")).toBe("Fort Lauderdale");
    expect(neighborhoodFor("600 S Dixie Hwy Ste 106, Boca Raton, FL 33432")).toBe(
      "Fort Lauderdale",
    );
    // Clay County commuter towns.
    expect(neighborhoodFor("21 Fountain Dr, Orange Park, FL 32065")).toBe("Jacksonville");
    expect(neighborhoodFor("4538 Song Sparrow Dr, Middleburg, FL 32068")).toBe("Jacksonville");
    // St. Johns County, halfway to Jacksonville but the same drive.
    expect(neighborhoodFor("250 Solana Rd, Ponte Vedra Beach, FL 32082")).toBe("St. Augustine");
    // South Miami sits against 33156.
    expect(neighborhoodFor("7230 SW 57th Ave, South Miami, FL 33143")).toBe("Kendall");
    expect(neighborhoodFor("6630 SW 57th Ave, Miami, FL 33143")).toBe("Kendall");
  });

  test("anything past the metro is labelled by town, not by bare ZIP", () => {
    // These stay in the list as cold-call stock. "other (34470)" told a rep nothing; three of them
    // are tier A, because a mobile groomer scores well wherever it happens to be parked.
    expect(neighborhoodFor("1211 NE 20th St, Ocala, FL 34470")).toBe("other (Ocala)");
    expect(neighborhoodFor("441 US-441, Lady Lake, FL 32159")).toBe("other (Lady Lake)");
    expect(neighborhoodFor("7345 Jackson Springs Rd #2, Tampa, FL 33634")).toBe("other (Tampa)");
    expect(neighborhoodFor("109 Ed Padgett Rd, Lakeland, FL 33809")).toBe("other (Lakeland)");
  });

  test("falls back to the ZIP when the address has no parseable town", () => {
    // 32601 is Gainesville — inside no configured range, and with no comma there is no town to read.
    expect(neighborhoodFor("32601")).toBe("other (32601)");
    expect(neighborhoodFor("no address at all")).toBe("other (?)");
  });

  test("the scraped area is the fallback only when Places returned no address", () => {
    // Three leads in D1 have a NULL address; their stored area is the one being scraped.
    expect(neighborhoodFor(null, "West Kendall")).toBe("West Kendall");
    expect(neighborhoodFor("", "Kendall")).toBe("Kendall");
    // An address that parses never falls back, even to a wrong hint.
    expect(neighborhoodFor("8000 W 12th Ave, Hialeah, FL 33014", "Doral")).toBe("Hialeah");
  });

  test("the three new areas resolve", () => {
    expect(neighborhoodFor("1234 Beach Blvd, Jacksonville, FL 32250")).toBe("Jacksonville");
    expect(neighborhoodFor("50 King St, St. Augustine, FL 32084")).toBe("St. Augustine");
    expect(neighborhoodFor("500 E Las Olas Blvd, Fort Lauderdale, FL 33301")).toBe(
      "Fort Lauderdale",
    );
  });

  test("no ZIP is claimed by two areas", () => {
    // Overlap is silent: whichever area is checked first wins and the other quietly gets nothing.
    // The original spec overlapped Hialeah 33010-33018 with Miami Lakes 33014/33016 exactly so.
    const owner = new Map<number, string>();
    const clashes: string[] = [];
    for (const area of Object.values(AREAS)) {
      for (const [lo, hi] of area.zips) {
        for (let zip = lo; zip <= hi; zip++) {
          const held = owner.get(zip);
          if (held) clashes.push(`${zip}: ${held} vs ${area.name}`);
          owner.set(zip, area.name);
        }
      }
    }
    expect(clashes).toEqual([]);
  });

  test("the city breaks the Hialeah / Miami Lakes ZIP tie", () => {
    // 33014 and 33016 belong to both. These eight rows are in D1 under Hialeah despite the ZIP
    // also being Miami Lakes', and two more are under Miami Lakes on the very same ZIP — only the
    // city tells them apart, which is why it is checked first.
    expect(neighborhoodFor("1228 W 79th St, Hialeah, FL 33014")).toBe("Hialeah");
    expect(neighborhoodFor("2350 W 60th St #8, Hialeah, FL 33016")).toBe("Hialeah");
    expect(neighborhoodFor("6934 Holly Rd, Miami Lakes, FL 33014")).toBe("Miami Lakes");
    expect(neighborhoodFor("15512 NW 77th Ct, Miami Lakes, FL 33016")).toBe("Miami Lakes");
  });

  test("reads the city out of a formatted address", () => {
    expect(cityOf("3550 NW 83rd Ave Apt 501, Doral, FL 33122")).toBe("doral");
    expect(cityOf("2750 W 68th St Ste 123, Hialeah, FL 33016")).toBe("hialeah");
    expect(cityOf("500 E Las Olas Blvd, Fort Lauderdale, FL 33301")).toBe("fort lauderdale");
    expect(cityOf("not an address")).toBeNull();
  });

  test("ZIP still decides for the areas USPS just calls Miami", () => {
    // Westchester, Kendall and West Kendall are not incorporated cities, so they carry no city list.
    expect(neighborhoodFor("8950 SW 24th St, Miami, FL 33165")).toBe("Westchester");
    expect(neighborhoodFor("13750 SW 88th St, Miami, FL 33186")).toBe("West Kendall");
    expect(neighborhoodFor("9000 SW 107th Ave, Miami, FL 33176")).toBe("Kendall");
  });

  test("St. Augustine is matched however USPS spells it", () => {
    expect(neighborhoodFor("50 King St, Saint Augustine, FL 32084")).toBe("St. Augustine");
    expect(neighborhoodFor("50 King St, St Augustine, FL 32084")).toBe("St. Augustine");
  });

  test("St. Augustine and Jacksonville do not fight over St. Johns county", () => {
    // 32259 (St. Johns / Fruit Cove) is assigned once, to St. Augustine.
    expect(areaForZip(32259)).toBe("St. Augustine");
  });
});

describe("de-duplication", () => {
  test("one address under two names normalises to one key", () => {
    const a = normalizeAddress("1234 W 29th St, Hialeah, FL 33012");
    const b = normalizeAddress("1234 W 29th St., Hialeah FL 33012");
    expect(a).toBe(b);
  });

  test("different addresses stay apart", () => {
    expect(normalizeAddress("1234 W 29th St, Hialeah, FL 33012")).not.toBe(
      normalizeAddress("1235 W 29th St, Hialeah, FL 33012"),
    );
  });
});

describe("html helpers", () => {
  test("strips scripts and styles before language and price checks", () => {
    const html = "<style>.a{color:$99}</style><script>var p='$50'</script><p>Groom $80</p>";
    const text = visibleText(html);
    expect(text).toContain("$80");
    expect(text).not.toContain("$50");
    expect(text).not.toContain("$99");
  });

  test("reads an instagram handle but not a post URL", () => {
    expect(instagramIn('<a href="https://instagram.com/gastonmobilegrooming">IG</a>')).toBe(
      "@gastonmobilegrooming",
    );
    expect(instagramIn('<a href="https://www.instagram.com/p/Cabc123/">post</a>')).toBeNull();
  });
});

describe("tiering stays in step with the existing 120 leads", () => {
  // Guards the property the whole rebuild rests on: new leads are scored by the same imported
  // functions the current data was produced with. If someone changes derive.ts, these move together.
  test("a mobile groomer with no booking system and a Spanish name is tier A", () => {
    const lead = {
      is_mobile: true,
      is_chain: false,
      booking_app: "none",
      review_count: 137,
      es_strength: "strong" as const,
    };
    const score = scoreLead(lead);
    expect(score).toBe(14);
    expect(tier(lead, score)).toBe("A");
  });

  test("a busy mobile groomer is a top lead, not a reject", () => {
    // Nadia Mobile Grooming: 1954 reviews, mobile, no booking system, and a random aggregator for a
    // website — huge phone traffic, no online presence. Scored 6 and sat in tier X until the
    // volume penalty came out on 2026-08-10.
    const nadia = {
      is_mobile: true,
      is_chain: false,
      booking_app: "none",
      review_count: 1954,
      es_strength: "none" as const,
    };
    const score = scoreLead(nadia);
    expect(score).toBe(9);
    expect(tier(nadia, score)).toBe("A");
  });

  test("a chain is X regardless of score", () => {
    const chain = {
      is_mobile: true,
      is_chain: true,
      booking_app: "none",
      review_count: 120,
      es_strength: "strong" as const,
    };
    expect(tier(chain, scoreLead(chain))).toBe("X");
  });
});
