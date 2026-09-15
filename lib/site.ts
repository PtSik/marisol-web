// Same line the grooming demo agent answers on (see DEMO_AGENTS in lib/demoAgents.ts).
// `||`, not `??`: the var is declared-but-empty in .dev.vars and .env.example, and an empty
// string is not nullish, so `??` handed the fallback straight past it. The client bundle then
// built `tel:` with no number — three dead phone links on the homepage, plus a hydration
// mismatch against the server render, which is where that console error came from.
export const DEMO_PHONE = process.env.NEXT_PUBLIC_DEMO_PHONE || "+1 (878) 867-8115";

export const telHref = `tel:${DEMO_PHONE.replace(/[^0-9+]/g, "")}`;

export const SALES_EMAIL = process.env.NEXT_PUBLIC_SALES_EMAIL || "sales@getmarisol.com";

export const SALES_EMAIL_HREF = `mailto:${SALES_EMAIL}?subject=${encodeURIComponent("Question about Marisol")}`;

export const SITE_URL = "https://callmarisol.com";

export const APP_URL = "https://app.callmarisol.com";

export const APP_HOST = new URL(APP_URL).host;

// Every "back to the site" link out of the dashboard has to be absolute: on app.callmarisol.com a
// bare "/" is redirected straight back into the portal, so a relative link looks like a dead button.
export const siteHref = (path = "/") => new URL(path, SITE_URL).toString();

// No-code Stripe Customer Portal login link — filled in once enabled in the dashboard;
// portal links render only when non-empty.
export const CUSTOMER_PORTAL_URL = "https://billing.stripe.com/p/login/5kQdR3e8E7sP1Uf8lt3Nm00";
