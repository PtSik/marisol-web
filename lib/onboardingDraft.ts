import {
  type BusinessBasics,
  DAYS,
  type SetupDetails,
  isBusinessBasics,
  isLanguageMode,
} from "@/lib/onboarding";
import { type Billing, PLAN_OPTIONS, type Plan } from "@/lib/plans";

// Index of the wizard's last step. Drafts written by the earlier seven-step flow can still carry a
// higher one, so the bound below stays where it was and the wizard clamps on restore.
export const REVIEW_STEP = 5;

export interface OnboardingDraft {
  basics: BusinessBasics;
  setup: SetupDetails;
  step: number;
  plan: Plan;
  billing: Billing;
  // Optional: absent on drafts saved before the plan picker gated Review, and false for anyone who
  // arrived through "Start free trial" rather than a pricing card. `plan` always holds a usable
  // value, so this is the only thing separating a real choice from the default.
  planPicked?: boolean;
}
export interface DraftRecord {
  revision: number;
  draft: OnboardingDraft;
  updatedAt: string;
}

// Drafts may be incomplete. Validate shape here; semantic validation runs before checkout.
export function isOnboardingDraft(value: unknown): value is OnboardingDraft {
  if (!value || typeof value !== "object") return false;
  const d = value as OnboardingDraft;
  const str = (v: unknown, max = 300) => typeof v === "string" && v.length <= max;
  const hours = (v: unknown) =>
    !!v &&
    typeof v === "object" &&
    DAYS.every((day) => {
      const h = (v as SetupDetails["hours"])[day];
      return h && typeof h.closed === "boolean" && str(h.open, 10) && str(h.close, 10);
    });
  const s = d.setup;
  return (
    isBusinessBasics(d.basics) &&
    Object.values(d.basics).every((v) => str(v)) &&
    Number.isInteger(d.step) &&
    d.step >= 0 &&
    d.step <= 6 &&
    PLAN_OPTIONS.includes(d.plan) &&
    (d.billing === "annual" || d.billing === "monthly") &&
    (d.planPicked === undefined || typeof d.planPicked === "boolean") &&
    !!s &&
    hours(s.hours) &&
    Array.isArray(s.services) &&
    s.services.length <= 30 &&
    s.services.every(
      (v) =>
        v &&
        str(v.name, 120) &&
        str(v.durationMin, 5) &&
        str(v.price, 10) &&
        (v.durationMaxMin == null || str(v.durationMaxMin, 5)) &&
        (v.priceMax == null || str(v.priceMax, 10)),
    ) &&
    Array.isArray(s.staff) &&
    s.staff.length <= 30 &&
    s.staff.every(
      (v) => v && str(v.id, 40) && str(v.name, 120) && (v.hours == null || hours(v.hours)),
    ) &&
    (s.fixedDurations === undefined || typeof s.fixedDurations === "boolean") &&
    typeof s.staffCustomHours === "boolean" &&
    (s.calendar === "google_calendar" || s.calendar === "none") &&
    str(s.forwardNumber, 120) &&
    str(s.notes, 2000) &&
    (s.carrier === undefined || str(s.carrier, 60)) &&
    (s.primaryLanguage === undefined || s.primaryLanguage === "en" || s.primaryLanguage === "es") &&
    (s.languageMode === undefined || isLanguageMode(s.languageMode))
  );
}

export async function readDraft(db: D1Database, accountId: string): Promise<DraftRecord | null> {
  const row = await db
    .prepare("SELECT revision, payload, updated_at FROM onboarding_drafts WHERE account_id = ?")
    .bind(accountId)
    .first<{ revision: number; payload: string; updated_at: string }>();
  if (!row) return null;
  const draft: unknown = JSON.parse(row.payload);
  if (!isOnboardingDraft(draft)) throw new Error("Stored draft is invalid");
  return { revision: row.revision, draft, updatedAt: row.updated_at };
}

export async function saveDraft(
  db: D1Database,
  accountId: string,
  revision: number,
  draft: OnboardingDraft,
): Promise<number | null> {
  const now = new Date().toISOString();
  const row =
    revision === 0
      ? await db
          .prepare(
            "INSERT OR IGNORE INTO onboarding_drafts (account_id, revision, payload, updated_at) VALUES (?, 1, ?, ?) RETURNING revision",
          )
          .bind(accountId, JSON.stringify(draft), now)
          .first<{ revision: number }>()
      : await db
          .prepare(
            "UPDATE onboarding_drafts SET revision = revision + 1, payload = ?, updated_at = ? WHERE account_id = ? AND revision = ? RETURNING revision",
          )
          .bind(JSON.stringify(draft), now, accountId, revision)
          .first<{ revision: number }>();
  return row?.revision ?? null;
}
