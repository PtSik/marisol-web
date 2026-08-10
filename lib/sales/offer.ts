// One campaign code per neighbourhood, all pointing at the same Stripe coupon
// (`marisol_neighborhood_20off`): 20% off Complete for twelve months, first transaction only,
// which lands it at $199.20/mo — the price of Basic. Stripe restricts the coupon to the Complete
// product, so a rep quoting it on Basic or Growth gets a refusal at checkout rather than an
// unexpected discount.
//
// That restriction is real but INVISIBLE to the API: account API version 2026-06-24.dahlia dropped
// `applies_to` from the coupon object, so reading the coupon suggests it applies to everything.
// Confirm it the only way that still works — price out an invoice and read the discount:
//
//   POST /v1/invoices/create_preview  currency=usd
//     subscription_details[items][0][price]=<price>  discounts[0][coupon]=marisol_neighborhood_20off
//
// Verified 2026-08-10: Basic $199 → $199 (discount $0), Complete $249 → $199.20, Growth $399 → $399.
const NEIGHBORHOOD_CODES: Record<string, string> = {
  Hialeah: "HIALEAH20",
  "West Kendall": "WESTKENDALL20",
  Doral: "DORAL20",
  Westchester: "WESTCHESTER20",
  Kendall: "KENDALL20",
  "Miami Lakes": "MIAMILAKES20",
  Jacksonville: "JACKSONVILLE20",
  "St. Augustine": "STAUGUSTINE20",
  "Fort Lauderdale": "FORTLAUDERDALE20",
};

export const promoCodeFor = (neighborhood: string): string | null =>
  NEIGHBORHOOD_CODES[neighborhood] ?? null;

// `attempts` counts dials already logged, so the call the rep is about to make is the next one up.
export const contactLabel = (attempts: number): string =>
  attempts === 0 ? "first contact" : `call #${attempts + 1}`;
