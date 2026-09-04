"use client";

import { CarrierField } from "@/components/onboarding/CarrierField";
import { Field, type FieldErrors } from "@/components/onboarding/Field";
import { inputCls } from "@/components/onboarding/fieldStyles";
import { type Dict, type Locale, fill } from "@/lib/i18n/dict";
import {
  DAYS,
  PHONE_RE,
  type SetupDetails,
  type Vertical,
  type WeekHours,
  invalidWeekHours,
  newStaffEntry,
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
  const validServices = setup.services.filter((s) => s.name.trim() && Number(s.durationMin) > 0);
  if (validServices.length === 0) errors.services = t.errServices;
  if (!setup.staff.some((s) => s.name.trim())) errors.staff = t.errStaff;
  else if (setup.staff.some((s) => s.hours && invalidWeekHours(s.hours))) {
    errors.staff = t.errStaffHours;
  }
  if (!PHONE_RE.test(setup.forwardNumber)) errors.forwardNumber = t.errForwardNumber;
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
            className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[12px] bg-white/60 px-[14px] py-[10px]"
          >
            <label className="flex min-w-[122px] items-center gap-[9px] text-[14px] font-medium">
              <input
                type="checkbox"
                checked={!h.closed}
                onChange={(e) => setDay({ closed: !e.target.checked })}
                className="h-[18px] w-[18px] accent-[#4F8C80]"
              />
              {label}
            </label>
            {h.closed ? (
              <span className="text-[13.5px] text-muted-2">{t.closed}</span>
            ) : (
              <span className="flex items-center gap-2 text-[14px]">
                <label className="sr-only" htmlFor={`${idPrefix}-open-${day}`}>
                  {fill(t.openTimeAria, { day: label })}
                  {labelSuffix}
                </label>
                <input
                  id={`${idPrefix}-open-${day}`}
                  type="time"
                  value={h.open}
                  onChange={(e) => setDay({ open: e.target.value })}
                  className="min-h-[40px] rounded-[9px] border border-ink/15 bg-white px-2 py-1 text-[14px]"
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
                  className="min-h-[40px] rounded-[9px] border border-ink/15 bg-white px-2 py-1 text-[14px]"
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
}: {
  setup: SetupDetails;
  vertical: Vertical;
  errors: FieldErrors;
  t: Dict["setup"];
  locale: Locale;
  patch: (partial: Partial<SetupDetails>) => void;
}) {
  return (
    <div className="flex flex-col gap-7">
      <fieldset className="m-0 border-0 p-0">
        <legend className="mb-[10px] text-[13.5px] font-medium text-ink">{t.hoursLegend}</legend>
        <HoursRows
          hours={setup.hours}
          idPrefix="ob"
          labelSuffix=""
          t={t}
          onChange={(hours) => patch({ hours })}
        />
        {errors.hours && (
          <p role="alert" className="mt-2 text-[12.5px] font-medium text-[#B4452C]">
            {errors.hours}
          </p>
        )}
      </fieldset>

      <fieldset className="m-0 border-0 p-0">
        <legend className="mb-1 text-[13.5px] font-medium text-ink">{t.servicesLegend}</legend>
        <p className="mb-[10px] text-[12.5px] text-muted-2">
          {fill(t.servicesHint, { kind: t.verticalKind[vertical] })}
        </p>
        <div className="flex flex-col gap-2">
          {setup.services.map((svc, i) => {
            const setSvc = (partial: Partial<typeof svc>) =>
              patch({
                services: setup.services.map((s, j) => (j === i ? { ...s, ...partial } : s)),
              });
            return (
              // biome-ignore lint/suspicious/noArrayIndexKey: rows are positional and editable
              <div key={i} className="flex flex-wrap items-center gap-2">
                <label className="sr-only" htmlFor={`ob-svc-name-${i}`}>
                  {fill(t.serviceNameAria, { n: i + 1 })}
                </label>
                <input
                  id={`ob-svc-name-${i}`}
                  className={`${inputCls} min-w-[160px] flex-1`}
                  value={svc.name}
                  onChange={(e) => setSvc({ name: e.target.value })}
                  placeholder={t.serviceNamePlaceholder}
                />
                <label className="sr-only" htmlFor={`ob-svc-dur-${i}`}>
                  {fill(t.serviceDurationAria, { n: i + 1 })}
                </label>
                <div className="flex items-center gap-1">
                  <input
                    id={`ob-svc-dur-${i}`}
                    type="number"
                    min="5"
                    step="5"
                    className={`${inputCls} w-[74px]`}
                    value={svc.durationMin}
                    onChange={(e) => setSvc({ durationMin: e.target.value })}
                  />
                  <span aria-hidden="true" className="text-[12.5px] text-muted-2">
                    –
                  </span>
                  <label className="sr-only" htmlFor={`ob-svc-dur-max-${i}`}>
                    {fill(t.serviceDurationMaxAria, { n: i + 1 })}
                  </label>
                  <div className="relative">
                    <input
                      id={`ob-svc-dur-max-${i}`}
                      type="number"
                      min="5"
                      step="5"
                      className={`${inputCls} w-[96px] pr-11`}
                      value={svc.durationMaxMin ?? ""}
                      onChange={(e) => setSvc({ durationMaxMin: e.target.value })}
                      placeholder={t.serviceRangeOptional}
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[12.5px] text-muted-2">
                      {t.serviceMinAbbr}
                    </span>
                  </div>
                </div>
                <label className="sr-only" htmlFor={`ob-svc-price-${i}`}>
                  {fill(t.servicePriceAria, { n: i + 1 })}
                </label>
                <div className="flex items-center gap-1">
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13.5px] text-muted-2">
                      $
                    </span>
                    <input
                      id={`ob-svc-price-${i}`}
                      type="number"
                      min="0"
                      className={`${inputCls} w-[86px] pl-7`}
                      value={svc.price}
                      onChange={(e) => setSvc({ price: e.target.value })}
                    />
                  </div>
                  <span aria-hidden="true" className="text-[12.5px] text-muted-2">
                    –
                  </span>
                  <label className="sr-only" htmlFor={`ob-svc-price-max-${i}`}>
                    {fill(t.servicePriceMaxAria, { n: i + 1 })}
                  </label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13.5px] text-muted-2">
                      $
                    </span>
                    <input
                      id={`ob-svc-price-max-${i}`}
                      type="number"
                      min="0"
                      className={`${inputCls} w-[92px] pl-7`}
                      value={svc.priceMax ?? ""}
                      onChange={(e) => setSvc({ priceMax: e.target.value })}
                      placeholder={t.serviceRangeOptional}
                    />
                  </div>
                </div>
                <button
                  type="button"
                  aria-label={fill(t.removeService, { name: svc.name || i + 1 })}
                  onClick={() => patch({ services: setup.services.filter((_, j) => j !== i) })}
                  className="flex h-11 w-11 items-center justify-center rounded-[10px] text-muted-2 hover:bg-cream-200"
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() =>
            patch({ services: [...setup.services, { name: "", durationMin: "30", price: "" }] })
          }
          className="mt-3 text-[14px] font-medium text-teal"
        >
          {t.addService}
        </button>
        {errors.services && (
          <p role="alert" className="mt-2 text-[12.5px] font-medium text-[#B4452C]">
            {errors.services}
          </p>
        )}
      </fieldset>

      <fieldset className="m-0 border-0 p-0">
        <legend className="mb-1 text-[13.5px] font-medium text-ink">{t.staffLegend}</legend>
        <p className="mb-[10px] text-[12.5px] text-muted-2">{t.staffHint}</p>
        <label className="mb-3 flex items-center gap-[9px] text-[14px] font-medium">
          <input
            type="checkbox"
            checked={setup.staffCustomHours}
            onChange={(e) =>
              patch({
                staffCustomHours: e.target.checked,
                staff: setup.staff.map((m) => ({
                  ...m,
                  hours: e.target.checked ? (m.hours ?? cloneHours(setup.hours)) : m.hours,
                })),
              })
            }
            className="h-[18px] w-[18px] accent-[#4F8C80]"
          />
          {t.staffCustomHours}
        </label>
        <div className="flex flex-col gap-2">
          {setup.staff.map((member, i) => {
            const setMember = (partial: Partial<typeof member>) =>
              patch({ staff: setup.staff.map((m, j) => (j === i ? { ...m, ...partial } : m)) });
            const displayName = member.name.trim() || fill(t.staffFallback, { n: i + 1 });
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
                      onClick={() => patch({ staff: setup.staff.filter((_, j) => j !== i) })}
                      className="flex h-11 w-11 items-center justify-center rounded-[10px] text-muted-2 hover:bg-cream-200"
                    >
                      ✕
                    </button>
                  )}
                </div>
                {setup.staffCustomHours && (
                  <div className="ml-1 border-l-2 border-ink/10 pl-3">
                    <p className="mb-[6px] text-[12.5px] text-muted-2">
                      {fill(t.staffHoursLabel, { name: displayName })}
                    </p>
                    <HoursRows
                      hours={member.hours ?? cloneHours(setup.hours)}
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
          onClick={() =>
            patch({
              staff: [
                ...setup.staff,
                {
                  ...newStaffEntry(),
                  hours: setup.staffCustomHours ? cloneHours(setup.hours) : null,
                },
              ],
            })
          }
          className="mt-3 text-[14px] font-medium text-teal"
        >
          {t.addStaff}
        </button>
        {errors.staff && (
          <p role="alert" className="mt-2 text-[12.5px] font-medium text-[#B4452C]">
            {errors.staff}
          </p>
        )}
      </fieldset>

      <fieldset className="m-0 border-0 p-0">
        <legend className="mb-[10px] text-[13.5px] font-medium text-ink">{t.calendarLegend}</legend>
        <div className="flex flex-col gap-2">
          {(
            [
              { id: "google_calendar", label: t.calendarGoogle, desc: t.calendarGoogleDesc },
              { id: "none", label: t.calendarNone, desc: t.calendarNoneDesc },
            ] as const
          ).map((opt) => (
            <label
              key={opt.id}
              className={`flex cursor-pointer items-start gap-3 rounded-[14px] border px-4 py-3 ${
                setup.calendar === opt.id ? "border-ink bg-white/80" : "border-ink/15 bg-white/50"
              }`}
            >
              <input
                type="radio"
                name="ob-calendar"
                checked={setup.calendar === opt.id}
                onChange={() => patch({ calendar: opt.id })}
                className="mt-[3px] h-[16px] w-[16px] accent-[#4F8C80]"
              />
              <span>
                <span className="block text-[14.5px] font-medium">{opt.label}</span>
                <span className="block text-[13px] text-muted">{opt.desc}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

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

      <Field label={t.primaryLanguage} htmlFor="ob-primary-language" hint={t.primaryLanguageHint}>
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
    </div>
  );
}
