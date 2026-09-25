import { Database } from "bun:sqlite";
import { describe, expect, it } from "bun:test";
import { importHours, importServices, publicWebsite } from "@/lib/businessImport";
import { defaultBasics, defaultSetup } from "@/lib/onboarding";
import {
  type OnboardingDraft,
  isOnboardingDraft,
  readDraft,
  saveDraft,
} from "@/lib/onboardingDraft";
import { previewVariables } from "@/lib/onboardingPreview";

const draft: OnboardingDraft = {
  basics: {
    ...defaultBasics(),
    businessName: "Coastal Grooming",
    email: "private@example.com",
    ownerMobile: "+13055550100",
  },
  setup: defaultSetup("grooming", []),
  step: 0,
  plan: "basic",
  billing: "monthly",
};
function d1(sqlite: Database): D1Database {
  const prepare = (sql: string, binds: unknown[] = []) => ({
    bind: (...next: unknown[]) => prepare(sql, next),
    first: async <T>() => (sqlite.query(sql).get(...(binds as never[])) as T | null) ?? null,
  });
  return { prepare: (sql: string) => prepare(sql) } as unknown as D1Database;
}
describe("account drafts", () => {
  it("keeps incomplete input but rejects malformed shapes", () => {
    expect(isOnboardingDraft(draft)).toBe(true);
    expect(isOnboardingDraft({ ...draft, step: 9 })).toBe(false);
    expect(isOnboardingDraft({ ...draft, setup: { ...draft.setup, hours: null } })).toBe(false);
  });
  // `plan` always holds a usable tier, so only this flag distinguishes a customer who chose one
  // from a customer who arrived through "Start free trial" and was given the default.
  it("accepts a draft with or without the plan-chosen flag", () => {
    expect(isOnboardingDraft({ ...draft, planPicked: true })).toBe(true);
    expect(isOnboardingDraft({ ...draft, planPicked: false })).toBe(true);
    expect(isOnboardingDraft(draft)).toBe(true);
    expect(isOnboardingDraft({ ...draft, planPicked: "yes" })).toBe(false);
  });
  it("round-trips the plan-chosen flag through storage", async () => {
    const sqlite = new Database(":memory:");
    try {
      sqlite.run(await Bun.file("d1/migrations/0009_onboarding_drafts.sql").text());
      const db = d1(sqlite);
      await saveDraft(db, "account-picked", 0, { ...draft, plan: "growth", planPicked: true });
      const record = await readDraft(db, "account-picked");
      expect(record?.draft.planPicked).toBe(true);
      expect(record?.draft.plan).toBe("growth");
    } finally {
      sqlite.close();
    }
  });
  it("isolates accounts and rejects stale writes without losing the saved revision", async () => {
    const sqlite = new Database(":memory:");
    try {
      sqlite.run(await Bun.file("d1/migrations/0009_onboarding_drafts.sql").text());
      const db = d1(sqlite);
      expect(await saveDraft(db, "account-a", 0, draft)).toBe(1);
      expect(await readDraft(db, "account-b")).toBeNull();
      expect(await saveDraft(db, "account-a", 0, { ...draft, step: 1 })).toBeNull();
      expect(await saveDraft(db, "account-a", 1, { ...draft, step: 2 })).toBe(2);
      expect(await saveDraft(db, "account-a", 1, { ...draft, step: 3 })).toBeNull();
      expect((await readDraft(db, "account-a"))?.draft.step).toBe(2);
      expect(await saveDraft(db, "account-b", 0, draft)).toBe(1);
    } finally {
      sqlite.close();
    }
  });
});
describe("safe business imports and previews", () => {
  const names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const week = names.map((day) => `${day}: 9:00 AM – 5:00 PM`).join(" | ");
  it("imports only complete continuous business hours", () => {
    expect(importHours(week)?.mon).toEqual({ closed: false, open: "09:00", close: "17:00" });
    for (const bad of [
      week.replace("9:00 AM", "9:60 AM"),
      week.replace("5:00 PM", "1:00 AM"),
      week.replace("9:00 AM – 5:00 PM", "9:00 AM – 12:00 PM, 1:00 PM – 5:00 PM"),
      week.split(" | ").slice(1).join(" | "),
      week.replace("9:00 AM – 5:00 PM", "Open 24 hours"),
    ])
      expect(importHours(bad)).toBeNull();
  });
  // Enrichment rows still carry the retired upper bound. Importing the lower one would hand the
  // owner a prefilled 75-minute groom for a job that runs to 180, with nothing on screen to say so.
  it("imports the top of an enriched duration range", () => {
    expect(
      importServices('[{"name":"Full Groom","durationMin":"75","durationMaxMin":"180"}]', "high"),
    ).toEqual([{ name: "Full Groom", durationMin: "180", price: "", priceMax: "" }]);
  });

  it("does not fill unknown prices, durations or low-confidence menus", () => {
    expect(importServices('[{"name":"Groom"}]', "high")[0]).toEqual({
      name: "Groom",
      durationMin: "",
      price: "",
      priceMax: "",
    });
    expect(importServices('[{"name":"Groom","price":"50"}]', "low")).toEqual([]);
    expect(importServices("invalid", "high")).toEqual([]);
    expect(publicWebsite("javascript:alert(1)")).toBeNull();
  });
  it("does not give the preview private contacts or unconfirmed preset facts", () => {
    const variables = previewVariables(draft, "en");
    expect(variables.preview_greeting).toContain("Coastal Grooming");
    expect(variables.business_facts).not.toContain("private@example.com");
    expect(variables.business_facts).not.toContain("3055550100");
    expect(variables.business_facts).not.toContain("durationMin");
    expect(Object.keys(variables)).not.toContain("shop_id");
  });
});
