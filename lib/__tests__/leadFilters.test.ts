import { describe, expect, test } from "bun:test";
import { type SalesQuery, buildQuery } from "@/components/sales/FilterBar";
import { scoreLead, tier } from "@/lib/sales/derive";
import {
  AREAS,
  ES_QUERY,
  OTHER_AREA,
  areaForZip,
  bookingAppIn,
  channelForArea,
  cityOf,
  excludedReason,
  hasStorefront,
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

describe("a groomer's own site cannot exclude it", () => {
  // Five real Fairfield County salons, each binned in one run by a phrase describing the owner's
  // credentials or a service detail. More leads than the sweep that found them produced.
  test("credentials, a landlord and a sideline are not disqualifications", () => {
    expect(
      excludedReason(
        "Happy Paws Professional Pet Grooming",
        "certification from the American Academy of Pet Grooming",
      ),
    ).toBe("");
    expect(
      excludedReason("Dogfather Grooming Stratford", "Investing in groomer training and support"),
    ).toBe("");
    expect(
      excludedReason("Baybrook Grooming, LLC", "a grooming shop inside Baybrook Animal Hospital"),
    ).toBe("");
    expect(
      excludedReason("The Salty Dog Grooming Shoppe", "Melissa is a breeder, groomer and handler"),
    ).toBe("");
    expect(excludedReason("Pampered Pet Spa", "we also board puppies for the weekend")).toBe("");
  });

  // The name is still read on its own, so the businesses the rule exists for stay out.
  test("the name still decides against the business", () => {
    expect(excludedReason("EDUGROOMER Academy", "")).toBe("school");
    expect(excludedReason("Doggy Academy Grooming School", "")).toBe("school");
    expect(excludedReason("Trumbull Animal Hospital", "we groom dogs too")).toBe("veterinary");
  });

  // And a business that never claims to groom is still judged on its site.
  test("without a grooming name the site is still read", () => {
    expect(excludedReason("Wag Central", "Pupster Academy & Daycare")).toBe("school");
    expect(excludedReason("Top Dog Food & Supply", "puppies for sale")).toBe("breeder/puppy store");
  });

  // Three Fairfield County daycares were binned as schools for naming a class once on a page that
  // sells grooming all the way down. The word count decides, not the first match.
  test("a page that sells grooming outweighs one mention of a class", () => {
    expect(
      excludedReason("Wag Central", "Grooming · grooming prices · Grooming FAQ · Puppy Academy"),
    ).toBe("");
    expect(excludedReason("The Bark Club", "our groomers · grooming packages · book a groom")).toBe(
      "",
    );
    expect(excludedReason("Town House For Dogs & Cats", "boarding, training academy")).toBe(
      "school",
    );
  });

  // Puppies on the sign do not stop a shop from grooming — two Miami salons say both.
  test("a groomer that also sells puppies is still a groomer", () => {
    expect(excludedReason("Biyu Puppies & Grooming Corporation")).toBe("");
    expect(excludedReason("Puppies and Grooming")).toBe("");
    expect(excludedReason("Nessy's Puppies of Kendall")).toBe("breeder/puppy store");
  });
});

describe("chain detection by brand", () => {
  test("catches the brands that slipped through as is_chain: no", () => {
    expect(isChainBrand("VCA South Dade Animal Hospital")).toBe(true);
    expect(isChainBrand("Petfolk Pinecrest")).toBe(true);
    expect(isChainBrand("Petco Grooming")).toBe(true);
    expect(isChainBrand("Pet Supermarket")).toBe(true);
  });

  // A franchisee is the decision-maker a rep wants on the phone, so the sign over the door is not
  // a reason to skip them. Corporate stores stay out.
  test("franchises queue like independents", () => {
    expect(isChainBrand("Dogtopia of Fairfield")).toBe(false);
    expect(isChainBrand("Camp Bow Wow Fairfield-Trumbull")).toBe(false);
    expect(isChainBrand("Scenthound Fairfield")).toBe(false);
    expect(isChainBrand("Woof Gang Bakery & Grooming Kendall")).toBe(false);
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

  // Only 9 of 61 stored mobile groomers were ever caught by their own copy, because the five
  // phrases the check started with are not how most of them write it.
  test("reads the ways a groomer without 'mobile' in the name says it", () => {
    expect(isMobileSite("We come to your home, fully equipped")).toBe(true);
    expect(isMobileSite("In-home grooming for anxious dogs")).toBe(true);
    expect(isMobileSite("Our grooming van is booked two weeks out")).toBe(true);
    expect(isMobileSite("We bring the salon to your driveway")).toBe(true);
    expect(isMobileSite("Full groom at your doorstep")).toBe(true);
    expect(isMobileSite("We travel to Fairfield and Milford")).toBe(true);
    expect(isMobileSite("House calls available on weekends")).toBe(true);
    expect(isMobileSite("Mobile pet spa serving Broward")).toBe(true);
  });

  // Half of what the widened phrases find is a salon that also runs a van, and `is_mobile` is what
  // takes a lead off the walking route. Real rows from the August rescan.
  test("a shop that advertises both a van and a door keeps its door", () => {
    expect(
      hasStorefront("Dogfather Grooming Stratford", "Mobile Grooming: 203-907-3626 our Salon"),
    ).toBe(true);
    expect(hasStorefront("Kool and Kute Pet Boutique", "Mobile Grooming in Doral. Visit us")).toBe(
      true,
    );
    expect(hasStorefront("Poochie On Your Block", "PET GROOMING SALON MOBILE GROOMING")).toBe(true);
    expect(
      hasStorefront("Lilo's Dog Hotels & Daycare", "Pawsitive MOBILE GROOMING click here"),
    ).toBe(true);
  });

  test("a van with no door is left alone", () => {
    expect(hasStorefront("Kall pet grooming", "Kall Pet Grooming brings the salon to you")).toBe(
      false,
    );
    expect(
      hasStorefront("Groomingtails Pet Spa", "Our mobile grooming service comes directly to you"),
    ).toBe(false);
  });

  // A salon with a door offers curbside drop-off, which is the opposite of a van.
  test("does not read a salon's own conveniences as a van", () => {
    expect(isMobileSite("Curbside drop-off available at our shop")).toBe(false);
    expect(isMobileSite("Free parking at the door")).toBe(false);
    expect(isMobileSite("We deliver dog food on Tuesdays")).toBe(false);
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
    // EDUGROOMER was tagged West Kendall from Coconut Grove, which is Miami and always was.
    expect(areaForZip(33133)).toBe("Miami");
    // Petfolk was tagged Kendall from Pinecrest.
    expect(areaForZip(33156)).toBe("Kendall");
  });

  test("the city core resolves by ZIP, because USPS calls half the county Miami", () => {
    expect(neighborhoodFor("1234 SW 8th St, Miami, FL 33135")).toBe("Miami");
    expect(neighborhoodFor("800 Brickell Ave, Miami, FL 33131")).toBe("Miami");
    expect(neighborhoodFor("2000 Ponce de Leon Blvd, Coral Gables, FL 33134")).toBe("Miami");
    // The ones USPS also writes as "Miami" keep their own areas — a city list on Miami would have
    // taken all three.
    expect(neighborhoodFor("8888 SW 40th St, Miami, FL 33165")).toBe("Westchester");
    expect(neighborhoodFor("9000 SW 107th Ave, Miami, FL 33176")).toBe("Kendall");
    expect(neighborhoodFor("12000 NE 16th Ave, Miami, FL 33161")).toBe("North Miami");
  });

  test("the newly sourced areas resolve", () => {
    expect(neighborhoodFor("1601 Washington Ave, Miami Beach, FL 33139")).toBe("Miami Beach");
    expect(neighborhoodFor("18001 NW 27th Ave, Miami Gardens, FL 33056")).toBe("Miami Gardens");
    expect(neighborhoodFor("100 N Krome Ave, Homestead, FL 33030")).toBe("Homestead");
    expect(neighborhoodFor("2500 Hollywood Blvd, Hollywood, FL 33020")).toBe("Hollywood");
    expect(neighborhoodFor("11000 Pines Blvd, Pembroke Pines, FL 33026")).toBe("Hollywood");
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

  test("anything past a day's drive shares one label", () => {
    // These stay in the list as cold-call stock — several are tier A, a mobile groomer scoring well
    // wherever it happens to be parked — but naming each town made 23 filter chips of one lead.
    expect(neighborhoodFor("1211 NE 20th St, Ocala, FL 34470")).toBe(OTHER_AREA);
    expect(neighborhoodFor("441 US-441, Lady Lake, FL 32159")).toBe(OTHER_AREA);
    expect(neighborhoodFor("7345 Jackson Springs Rd #2, Tampa, FL 33634")).toBe(OTHER_AREA);
    expect(neighborhoodFor("109 Ed Padgett Rd, Lakeland, FL 33809")).toBe(OTHER_AREA);
    expect(neighborhoodFor("111 S Washington St, Ormond Beach, FL 32174")).toBe(OTHER_AREA);
    // Long Island, across the Sound from the Connecticut market that found it.
    expect(neighborhoodFor("1000 N Broadway, Massapequa, NY 11758")).toBe(OTHER_AREA);
  });

  test("an unreadable address is Other, not a bare ZIP", () => {
    // 32601 is Gainesville — inside no configured range, and with no comma there is no town to read.
    expect(neighborhoodFor("32601")).toBe(OTHER_AREA);
    expect(neighborhoodFor("no address at all")).toBe(OTHER_AREA);
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

  test("greater Bridgeport resolves to Stratford, whichever town the shop is in", () => {
    expect(neighborhoodFor("1234 Main St, Stratford, CT 06614")).toBe("Stratford");
    expect(neighborhoodFor("900 Fairfield Ave, Bridgeport, CT 06605")).toBe("Stratford");
    expect(neighborhoodFor("55 Bridgeport Ave, Shelton, CT 06484")).toBe("Stratford");
    expect(neighborhoodFor("120 Broad St, Milford, CT 06460")).toBe("Stratford");
    expect(neighborhoodFor("1500 Post Rd, Fairfield, CT 06824")).toBe("Stratford");
  });

  test("a CT ZIP resolves without its leading zero, which is how it is stored", () => {
    // `zips` are numbers and `06614` is an illegal octal literal, so the ranges are written 6614.
    expect(zipOf("1234 Main St, Stratford, CT 06614")).toBe(6614);
    expect(areaForZip(6614)).toBe("Stratford");
    expect(areaForZip(zipOf("25 Quarry Rd, Trumbull, CT 06611"))).toBe("Stratford");
  });

  test("the ring within about forty minutes of Stratford is part of the area", () => {
    // A rep drives between towns and walks between doors, so the area is drawn by drive time. Every
    // one of these is a shorter run from Stratford than Fairfield's own 06824, which was in from
    // the start; all six sat in `other (…)` until the areas were redrawn.
    expect(neighborhoodFor("650 Main St #7, Monroe, CT 06468")).toBe("Stratford");
    expect(neighborhoodFor("204 Main St, Ansonia, CT 06401")).toBe("Stratford");
    expect(neighborhoodFor("127 Main St, Derby, CT 06418")).toBe("Stratford");
    expect(neighborhoodFor("1240 Post Rd E, Westport, CT 06880")).toBe("Stratford");
    expect(neighborhoodFor("224 S Main St A, Newtown, CT 06470")).toBe("Stratford");
  });

  test("greater New Haven is its own area, dialled rather than walked", () => {
    expect(neighborhoodFor("100 Chapel St, New Haven, CT 06510")).toBe("New Haven");
    expect(neighborhoodFor("1292 Whalley Ave, New Haven, CT 06515")).toBe("New Haven");
    expect(neighborhoodFor("29 Wagner Pl, West Haven, CT 06516")).toBe("New Haven");
    expect(neighborhoodFor("53 South St, East Haven, CT 06512")).toBe("New Haven");
    expect(neighborhoodFor("24 Selden St, Woodbridge, CT 06525")).toBe("New Haven");
    expect(neighborhoodFor("312 E Johnson Ave, Cheshire, CT 06410")).toBe("New Haven");
    expect(channelForArea("New Haven")).toBe("call");
  });

  test("Connecticut past the forty-minute ring is Other, not a new area", () => {
    // Easton (06612) sits inside the Bridgeport-Trumbull range's numeric span but is rural; Weston
    // (06883) is the same case beside Westport.
    expect(areaForZip(6612)).toBeNull();
    expect(areaForZip(6883)).toBeNull();
    expect(neighborhoodFor("60 Pemberwick Rd A, Greenwich, CT 06831")).toBe(OTHER_AREA);
    expect(neighborhoodFor("268 Greenwood Ave, Bethel, CT 06801")).toBe(OTHER_AREA);
    expect(neighborhoodFor("1411 Boston Post Rd #244, Westbrook, CT 06498")).toBe(OTHER_AREA);
    expect(neighborhoodFor("72 Park Lane Rd, New Milford, CT 06776")).toBe(OTHER_AREA);
    expect(neighborhoodFor("278 New Milford Turnpike, New Preston, CT 06777")).toBe(OTHER_AREA);
  });

  test("North Miami is ZIP-only, so it cannot swallow the areas USPS calls Miami", () => {
    expect(neighborhoodFor("9650 NW 27th Ave, Miami, FL 33147")).toBe("North Miami");
    expect(neighborhoodFor("1666 NE 123rd St, North Miami, FL 33181")).toBe("North Miami");
    // The regression this area could cause: `city` is matched before `zips`, so a city list holding
    // "miami" here would take Westchester, Kendall and West Kendall with it.
    expect(neighborhoodFor("8950 SW 24th St, Miami, FL 33165")).toBe("Westchester");
    expect(neighborhoodFor("9000 SW 107th Ave, Miami, FL 33176")).toBe("Kendall");
    expect(neighborhoodFor("13750 SW 88th St, Miami, FL 33186")).toBe("West Kendall");
  });

  test("Stratford is walked and every Florida area is dialled", () => {
    expect(channelForArea("Stratford")).toBe("walk");
    expect(channelForArea("Hialeah")).toBe("call");
    expect(channelForArea("Fort Lauderdale")).toBe("call");
    expect(channelForArea("North Miami")).toBe("call");
    // `Other` has no entry at all and must not crash into a route.
    expect(channelForArea(OTHER_AREA)).toBe("call");
  });
});

describe("instagram handles", () => {
  test("skips the booking widget's own account and takes the shop's", () => {
    const html =
      '<a href="https://instagram.com/booksybiz">book</a><a href="https://instagram.com/pawsspa">us</a>';
    expect(instagramIn(html)).toBe("@pawsspa");
  });

  test("a page with nothing but platform links has no handle", () => {
    expect(instagramIn('<a href="https://instagram.com/moego_app">x</a>')).toBeNull();
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

describe("FilterBar query hrefs", () => {
  test("keeps a filter's other params and appends the new one", () => {
    const current: SalesQuery = { neighborhood: "Hialeah", zip: "6614" };
    expect(buildQuery(current, { outcome: "all" })).toBe(
      "?neighborhood=Hialeah&zip=6614&outcome=all",
    );
  });

  test("an empty-string patch value removes that param rather than serialising as empty", () => {
    const current: SalesQuery = { neighborhood: "Hialeah", page: "3" };
    expect(buildQuery(current, { neighborhood: "" })).toBe("?page=3");
  });

  test("no params at all serialises to the bare path", () => {
    expect(buildQuery({}, {})).toBe("");
  });

  // A filter link ships `page: "", lowPage: ""` in its patch (mirroring `FIRST_PAGE` in
  // FilterBar.tsx) precisely so a rep three pages deep who narrows the area does not land on a page
  // number the narrower result set may no longer have.
  test("a filter-changing link clears both page params, even when the rep is deep in the queue", () => {
    const current: SalesQuery = { page: "4", lowPage: "2", outcome: "all" };
    const href = buildQuery(current, { neighborhood: "Doral", page: "", lowPage: "" });
    expect(href).toBe("?outcome=all&neighborhood=Doral");
    expect(href).not.toContain("page=");
  });

  test("clearing every filter at once (Clear filters) also clears both page params", () => {
    const current: SalesQuery = {
      neighborhood: "Hialeah",
      outcome: "all",
      mobile: "1",
      zip: "6614",
      page: "5",
      lowPage: "3",
    };
    const href = buildQuery(current, {
      neighborhood: "",
      outcome: "",
      mobile: "",
      zip: "",
      page: "",
      lowPage: "",
    });
    expect(href).toBe("");
  });

  // A van has no block to be on, so switching to the mobile list drops the ZIP with it — left set,
  // it would filter the vans down to nothing with no visible cause.
  test("switching to the mobile list clears the block", () => {
    const current: SalesQuery = { neighborhood: "Stratford", zip: "6614" };
    const href = buildQuery(current, { mobile: "1", zip: "", page: "", lowPage: "" });
    expect(href).toBe("?neighborhood=Stratford&mobile=1");
  });

  // Deep links: the same starting query plus the same patch always produces the same string, so a
  // rep who bookmarks or shares a `/sales?...` URL reproduces the same view on a fresh load.
  test("the same query and patch always produce the same href", () => {
    const current: SalesQuery = { neighborhood: "Doral", mobile: "1", page: "2" };
    const patch: SalesQuery = { outcome: "all" };
    expect(buildQuery(current, patch)).toBe(buildQuery(current, patch));
  });
});
