"use client";

import { CarrierField } from "@/components/onboarding/CarrierField";
import { Field, type FieldErrors } from "@/components/onboarding/Field";
import { ServiceFields } from "@/components/onboarding/ServiceFields";
import { choiceCls, inputCls } from "@/components/onboarding/fieldStyles";
import { type Dict, type Locale, fill } from "@/lib/i18n/dict";
import {
  DAYS,
  LANGUAGE_MODES,
  type SetupDetails,
  type Vertical,
  type WeekHours,
  invalidWeekHours,
  isUsPhone,
  isValidService,
  newStaffEntry,
  validateSetupPayload,
} from "@/lib/onboarding";

function cloneHours(hours: WeekHours): WeekHours {
  return Object.fromEntries(DAYS.map((day) => [day, { ...hours[day] }])) as unknown as WeekHours;
}

// Runs on the setup the form is about to send (see `normalizeSetup`) and applies the worker's own
// rules — `<input type="time">` hands back `""` when it is cleared or half-typed, and the old
// check let that through to a bare 400.
export function validateSetup(setup: SetupDetails, t: Dict["setup"]): FieldErrors {
  const errors: FieldErrors = {};
  if (invalidWeekHours(setup.hours)) errors.hours = t.errHours;
  if (!setup.services.length || !setup.services.every(isValidService))
    errors.services = t.errServices;
  if (
    !setup.staff.length ||
    setup.staff.some((s) => !s.name.trim()) ||
    new Set(setup.staff.map((s) => s.name.trim().toLowerCase())).size !== setup.staff.length
  )
    errors.staff = t.errStaff;
  else if (setup.staff.some((s) => s.hours && invalidWeekHours(s.hours))) {
    errors.staff = t.errStaffHours;
  }
  if (!isUsPhone(setup.forwardNumber)) errors.forwardNumber = t.errForwardNumber;
  const serverError = validateSetupPayload(setup);
  if (serverError && !Object.keys(errors).length) {
    const key = serverError.replace("invalid ", "");
    errors[key] = (t.errServer as Record<string, string>)[serverError] ?? t.errSubmit;
  }
  return errors;
}

function HoursRows({
  hours,
  idPrefix,
  labelSuffix,
  t,
  onChange,
}: {
  hours: WeekHours;
  idPrefix: string;
  labelSuffix: string;
  t: Dict["setup"];
  onChange: (hours: WeekHours) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      {DAYS.map((day) => {
        const h = hours[day];
        const label = t.days[day];
        const setDay = (dh: Partial<typeof h>) => onChange({ ...hours, [day]: { ...h, ...dh } });
        return (
          <div
            key={day}
            className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[12px] border border-ink/[0.07] bg-cream-100 px-[14px] py-[10px]"
          >
            <label className="flex min-w-[122px] items-center gap-[9px] t-body-sm font-medium">
              <input
                type="checkbox"
                checked={!h.closed}
                onChange={(e) => setDay({ closed: !e.target.checked })}
                className="h-[18px] w-[18px] accent-teal"
              />
              {label}
            </label>
            {h.closed ? (
              <span className="t-body-sm text-muted-2">{t.closed}</span>
            ) : (
              <span className="flex items-center gap-2 t-body-sm">
                <label className="sr-only" htmlFor={`${idPrefix}-open-${day}`}>
                  {fill(t.openTimeAria, { day: label })}
                  {labelSuffix}
                </label>
                <input
                  id={`${idPrefix}-open-${day}`}
                  type="time"
                  value={h.open}
                  onChange={(e) => setDay({ open: e.target.value })}
                  className="min-h-[40px] rounded-[9px] border border-ink/15 bg-offwhite px-2 py-1 t-body-sm"
                />
                <span className="text-muted-2">–</span>
                <label className="sr-only" htmlFor={`${idPrefix}-close-${day}`}>
                  {fill(t.closeTimeAria, { day: label })}
                  {labelSuffix}
                </label>
                <input
                  id={`${idPrefix}-close-${day}`}
                  type="time"
                  value={h.close}
                  onChange={(e) => setDay({ close: e.target.value })}
                  className="min-h-[40px] rounded-[9px] border border-ink/15 bg-offwhite px-2 py-1 t-body-sm"
                />
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function SetupFields({
  setup,
  vertical,
  errors,
  t,
  locale,
  patch,
  section,
}: {
  section?: "hours" | "services" | "staff" | "calendar" | "calls" | "notes";
  setup: SetupDetails;
  vertical: Vertical;
  errors: FieldErrors;
  t: Dict["setup"];
  locale: Locale;
  patch: (partial: Partial<SetupDetails>) => void;
}) {
  return (
    <div className="flex flex-col gap-7">
      {(!section || section === "hours") && (
        <fieldset className="m-0 border-0 p-0">
          <legend className="mb-[10px] t-body-sm font-medium text-ink">{t.hoursLegend}</legend>
          <HoursRows
            hours={setup.hours}
            idPrefix="ob"
            labelSuffix=""
            t={t}
            onChange={(hours) => patch({ hours })}
          />
          {errors.hours && (
            <p role="alert" className="mt-2 t-caption font-medium text-danger">
              {errors.hours}
            </p>
          )}
        </fieldset>
      )}

      {(section === "services" || !section) && (
        <ServiceFields
          setup={setup}
          patch={patch}
          locale={locale}
          vertical={vertical}
          allowExamples={section === "services"}
          error={errors.services}
          namePlaceholder={fill(t.serviceNameExample, { name: t.servicePresets[vertical][0] })}
        />
      )}

      {(!section || section === "staff") && (
        <fieldset className="m-0 border-0 p-0">
          <legend className="mb-1 t-body-sm font-medium text-ink">{t.staffLegend}</legend>
          <p className="mb-[10px] t-caption text-muted-2">{t.staffHint}</p>
          <div className="flex flex-col gap-2">
            {setup.staff.map((member, i) => {
              // `staffCustomHours` stays in the payload the worker reads, but it is now derived:
              // the question "does anyone keep their own hours" is answered by the rows themselves.
              const setStaff = (staff: typeof setup.staff) =>
                patch({ staff, staffCustomHours: staff.some((m) => m.hours) });
              const setMember = (partial: Partial<typeof member>) =>
                setStaff(setup.staff.map((m, j) => (j === i ? { ...m, ...partial } : m)));
              const displayName = member.name.trim() || fill(t.staffFallback, { n: i + 1 });
              const own = !!member.hours;
              return (
                <div key={member.id} className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <label className="sr-only" htmlFor={`ob-staff-${member.id}`}>
                      {fill(t.staffNameAria, { n: i + 1 })}
                    </label>
                    <input
                      id={`ob-staff-${member.id}`}
                      className={`${inputCls} max-w-[320px]`}
                      value={member.name}
                      onChange={(e) => setMember({ name: e.target.value })}
                      placeholder={i === 0 ? t.staffPlaceholderFirst : t.staffPlaceholderOther}
                    />
                    {setup.staff.length > 1 && (
                      <button
                        type="button"
                        aria-label={fill(t.removeStaff, { name: displayName })}
                        onClick={() => setStaff(setup.staff.filter((_, j) => j !== i))}
                        className="flex h-11 w-11 items-center justify-center rounded-[10px] text-muted-2 transition-colors hover:bg-cream-200"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1 pl-1 t-caption text-muted-2">
                    <span>{own ? t.staffOwnHours : t.staffBusinessHours}</span>
                    <button
                      type="button"
                      aria-expanded={own}
                      onClick={() => setMember({ hours: own ? null : cloneHours(setup.hours) })}
                      className="min-h-[44px] font-medium text-teal underline"
                    >
                      {own
                        ? fill(t.staffUseBusinessHours, { name: displayName })
                        : fill(t.staffSetOwnHours, { name: displayName })}
                    </button>
                  </p>
                  {own && member.hours && (
                    <div className="ml-1 border-l-2 border-ink/10 pl-3">
                      <HoursRows
                        hours={member.hours}
                        idPrefix={`ob-staff-${member.id}`}
                        labelSuffix={fill(t.forStaff, { name: displayName })}
                        t={t}
                        onChange={(hours) => setMember({ hours })}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => patch({ staff: [...setup.staff, newStaffEntry()] })}
            className="mt-3 min-h-[44px] t-body-sm font-medium text-teal"
          >
            {t.addStaff}
          </button>
          {errors.staff && (
            <p role="alert" className="mt-2 t-caption font-medium text-danger">
              {errors.staff}
            </p>
          )}
        </fieldset>
      )}

      {(!section || section === "calendar") && (
        <fieldset className="m-0 border-0 p-0">
          <legend className="mb-[10px] t-body-sm font-medium text-ink">{t.calendarLegend}</legend>
          <div className="flex flex-col gap-2">
            {(
              [
                { id: "google_calendar", label: t.calendarGoogle, desc: t.calendarGoogleDesc },
                { id: "none", label: t.calendarNone, desc: t.calendarNoneDesc },
              ] as const
            ).map((opt) => (
              <label key={opt.id} className={choiceCls(setup.calendar === opt.id)}>
                <input
                  type="radio"
                  name="ob-calendar"
                  checked={setup.calendar === opt.id}
                  onChange={() => patch({ calendar: opt.id })}
                  className="mt-[3px] h-[16px] w-[16px] accent-teal"
                />
                <span>
                  <span className="block t-body-sm font-medium">{opt.label}</span>
                  <span className="mt-[2px] block t-caption text-muted">{opt.desc}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {(!section || section === "calls") && (
        <>
          <Field
            label={t.forwardNumber}
            htmlFor="ob-forward"
            error={errors.forwardNumber}
            hint={t.forwardNumberHint}
          >
            <input
              id="ob-forward"
              type="tel"
              className={`${inputCls} max-w-[320px]`}
              value={setup.forwardNumber}
              onChange={(e) => patch({ forwardNumber: e.target.value })}
              placeholder={t.forwardNumberPlaceholder}
            />
          </Field>

          <CarrierField
            forwardNumber={setup.forwardNumber}
            carrier={setup.carrier}
            t={t}
            onChange={(carrier) => patch({ carrier })}
          />

          <fieldset className="m-0 border-0 p-0">
            <legend className="mb-[10px] t-body-sm font-medium text-ink">{t.languageMode}</legend>
            <div className="flex flex-col gap-2">
              {LANGUAGE_MODES.map((mode) => {
                const active = (setup.languageMode ?? "bilingual") === mode;
                return (
                  <label key={mode} className={choiceCls(active)}>
                    <input
                      type="radio"
                      name="ob-language-mode"
                      className="mt-[3px] h-4 w-4 shrink-0 accent-teal"
                      checked={active}
                      onChange={() => patch({ languageMode: mode })}
                    />
                    <span>
                      <span className="block t-body-sm font-medium text-ink">
                        {t.languageModeOptions[mode].label}
                      </span>
                      <span className="mt-[2px] block t-caption text-muted">
                        {t.languageModeOptions[mode].blurb}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          {(setup.languageMode ?? "bilingual") === "bilingual" && (
            <Field
              label={t.primaryLanguage}
              htmlFor="ob-primary-language"
              hint={t.primaryLanguageHint}
            >
              <select
                id="ob-primary-language"
                className={`${inputCls} max-w-[420px]`}
                value={setup.primaryLanguage ?? locale}
                onChange={(e) => patch({ primaryLanguage: e.target.value as Locale })}
              >
                <option value="en">{t.primaryLanguageOptions.en}</option>
                <option value="es">{t.primaryLanguageOptions.es}</option>
              </select>
            </Field>
          )}
        </>
      )}

      {(!section || section === "calls" || section === "notes") && (
        <Field label={t.notes} htmlFor="ob-notes">
          <textarea
            id="ob-notes"
            rows={3}
            className={`${inputCls} min-h-[88px] resize-y`}
            value={setup.notes}
            onChange={(e) => patch({ notes: e.target.value })}
            placeholder={t.notesPlaceholder}
          />
        </Field>
      )}
    </div>
  );
}
