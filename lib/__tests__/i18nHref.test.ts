import { describe, expect, it } from "bun:test";
import { appHref, googleStartHref, onboardingHref, parseLocale } from "@/lib/i18n/dict";

describe("appHref", () => {
  it("leaves English links bare", () => {
    expect(appHref("en", "/portal")).toBe("https://app.callmarisol.com/portal");
  });

  it("tags every Spanish hop into the app, because the app has no /es tree", () => {
    expect(appHref("es", "/portal")).toBe("https://app.callmarisol.com/portal?lang=es");
  });

  it("keeps the plan the client picked on the pricing card", () => {
    expect(appHref("es", "/portal", { plan: "complete", billing: "annual" })).toBe(
      "https://app.callmarisol.com/portal?plan=complete&billing=annual&lang=es",
    );
    expect(appHref("en", "/portal", { plan: "basic", billing: "monthly" })).toBe(
      "https://app.callmarisol.com/portal?plan=basic&billing=monthly",
    );
  });

  it("absolutises a relative redirect handed back by the auth API", () => {
    expect(appHref("es", "/portal")).toStartWith("https://app.callmarisol.com/");
  });
});

describe("onboardingHref", () => {
  it("carries the locale as ?lang and nothing else", () => {
    expect(onboardingHref("en")).toBe("/onboarding");
    expect(onboardingHref("es")).toBe("/onboarding?lang=es");
    expect(onboardingHref("es", { plan: "complete" })).toBe("/onboarding?plan=complete&lang=es");
  });
});

describe("googleStartHref", () => {
  it("hands the locale to the route that parks it in the state cookie", () => {
    expect(googleStartHref("en")).toBe("/api/auth/google/start");
    expect(googleStartHref("es")).toBe("/api/auth/google/start?lang=es");
  });
});

describe("parseLocale", () => {
  it("treats anything that is not es as English, so a junk param cannot 500 the page", () => {
    expect(parseLocale("es")).toBe("es");
    expect(parseLocale("en")).toBe("en");
    expect(parseLocale(undefined)).toBe("en");
    expect(parseLocale("fr")).toBe("en");
    expect(parseLocale(["es"])).toBe("en");
  });
});
