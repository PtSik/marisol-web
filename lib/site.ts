export const DEMO_PHONE = process.env.NEXT_PUBLIC_DEMO_PHONE ?? "+1 (833) 659-6941";

export const telHref = `tel:${DEMO_PHONE.replace(/[^0-9+]/g, "")}`;

export const SALES_EMAIL = process.env.NEXT_PUBLIC_SALES_EMAIL ?? "sales@kaijiro-voice.ai";

export const SALES_EMAIL_HREF = `mailto:${SALES_EMAIL}?subject=${encodeURIComponent("Question about Kaijiro")}`;
