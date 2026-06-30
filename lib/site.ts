export const DEMO_PHONE = process.env.NEXT_PUBLIC_DEMO_PHONE ?? "+1 (833) 659-6941";

export const telHref = `tel:${DEMO_PHONE.replace(/[^0-9+]/g, "")}`;

export const TEAM_PHONE = process.env.NEXT_PUBLIC_TEAM_PHONE ?? DEMO_PHONE;

export const teamTelHref = `tel:${TEAM_PHONE.replace(/[^0-9+]/g, "")}`;
