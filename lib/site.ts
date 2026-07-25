export const DEMO_PHONE = process.env.NEXT_PUBLIC_DEMO_PHONE ?? "+1 (833) 659-6941";

export const telHref = `tel:${DEMO_PHONE.replace(/[^0-9+]/g, "")}`;

export const SALES_EMAIL = process.env.NEXT_PUBLIC_SALES_EMAIL ?? "sales@getmarisol.com";

export const SALES_EMAIL_HREF = `mailto:${SALES_EMAIL}?subject=${encodeURIComponent("Question about Marisol")}`;

export const SITE_URL = "https://callmarisol.com";

export const APP_URL = "https://app.callmarisol.com";

export const APP_HOST = new URL(APP_URL).host;

// No-code Stripe Customer Portal login link — filled in once enabled in the dashboard;
// portal links render only when non-empty.
export const CUSTOMER_PORTAL_URL = "https://billing.stripe.com/p/login/5kQdR3e8E7sP1Uf8lt3Nm00";
