// One campaign code per neighbourhood, all pointing at the same Stripe coupon: 20% off Complete for
// twelve months, which lands it at $199.20/mo — the price of Basic. Stripe restricts the coupon to
// the Complete product, so a rep quoting it on Basic or Growth gets a refusal at checkout rather
// than an unexpected discount.
const NEIGHBORHOOD_CODES: Record<string, string> = {
  Hialeah: "HIALEAH20",
  "West Kendall": "WESTKENDALL20",
  Doral: "DORAL20",
  Westchester: "WESTCHESTER20",
  Kendall: "KENDALL20",
  "Miami Lakes": "MIAMILAKES20",
};

export const promoCodeFor = (neighborhood: string): string | null =>
  NEIGHBORHOOD_CODES[neighborhood] ?? null;

// `attempts` counts dials already logged, so the call the rep is about to make is the next one up.
export const contactLabel = (attempts: number): string =>
  attempts === 0 ? "first contact" : `call #${attempts + 1}`;
