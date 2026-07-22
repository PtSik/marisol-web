"use client";

import { Field, type FieldErrors } from "@/components/onboarding/Field";
import { inputCls } from "@/components/onboarding/fieldStyles";
import {
  DAYS,
  PHONE_RE,
  type SetupDetails,
  type Vertical,
  type WeekHours,
  newStaffEntry,
} from "@/lib/onboarding";

function cloneHours(hours: WeekHours): WeekHours {
  return Object.fromEntries(
    DAYS.map((day) => [day.id, { ...hours[day.id] }]),
  ) as unknown as WeekHours;
}

function hoursError(hours: WeekHours): boolean {
  return DAYS.some((day) => {
    const h = hours[day.id];
    return !h.closed && h.open >= h.close;
  });
}

export function validateSetup(setup: SetupDetails): FieldErrors {
  const errors: FieldErrors = {};
  if (hoursError(setup.hours))
    errors.hours = "Opening time must be before closing time on every open day.";
  const validServices = setup.services.filter((s) => s.name.trim() && Number(s.durationMin) > 0);
  if (validServices.length === 0)
    errors.services = "Add at least one service with a name and duration.";
  if (!setup.staff.some((s) => s.name.trim())) errors.staff = "Add at least one staff member.";
  else if (
    setup.staffCustomHours &&
    setup.staff.some((s) => s.name.trim() && s.hours && hoursError(s.hours))
  ) {
    errors.staff = "Start time must be before end time on every day a staff member works.";
  }
  if (!PHONE_RE.test(setup.forwardNumber))
    errors.forwardNumber = "Enter the number your customers currently call.";
  return errors;
}

function HoursRows({
  hours,
  idPrefix,
  labelSuffix,
  onChange,
}: {
  hours: WeekHours;
  idPrefix: string;
  labelSuffix: string;
  onChange: (hours: WeekHours) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      {DAYS.map((day) => {
        const h = hours[day.id];
        const setDay = (dh: Partial<typeof h>) => onChange({ ...hours, [day.id]: { ...h, ...dh } });
        return (
          <div
            key={day.id}
            className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[12px] bg-white/60 px-[14px] py-[10px]"
          >
            <label className="flex min-w-[122px] items-center gap-[9px] text-[14px] font-medium">
              <input
                type="checkbox"
                checked={!h.closed}
                onChange={(e) => setDay({ closed: !e.target.checked })}
                className="h-[18px] w-[18px] accent-[#4F8C80]"
              />
              {day.label}
            </label>
            {h.closed ? (
              <span className="text-[13.5px] text-muted-2">Closed</span>
            ) : (
              <span className="flex items-center gap-2 text-[14px]">
                <label className="sr-only" htmlFor={`${idPrefix}-open-${day.id}`}>
                  {day.label} opening time{labelSuffix}
                </label>
                <input
                  id={`${idPrefix}-open-${day.id}`}
                  type="time"
                  value={h.open}
                  onChange={(e) => setDay({ open: e.target.value })}
                  className="min-h-[40px] rounded-[9px] border border-ink/15 bg-white px-2 py-1 text-[14px]"
                />
                <span className="text-muted-2">–</span>
                <label className="sr-only" htmlFor={`${idPrefix}-close-${day.id}`}>
                  {day.label} closing time{labelSuffix}
                </label>
                <input
                  id={`${idPrefix}-close-${day.id}`}
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
  patch,
}: {
  setup: SetupDetails;
  vertical: Vertical;
  errors: FieldErrors;
  patch: (partial: Partial<SetupDetails>) => void;
}) {
  return (
    <div className="flex flex-col gap-7">
      <fieldset className="m-0 border-0 p-0">
        <legend className="mb-[10px] text-[13.5px] font-medium text-ink">Opening hours</legend>
        <HoursRows
          hours={setup.hours}
          idPrefix="ob"
          labelSuffix=""
          onChange={(hours) => patch({ hours })}
        />
        {errors.hours && (
          <p role="alert" className="mt-2 text-[12.5px] font-medium text-[#B4452C]">
            {errors.hours}
          </p>
        )}
      </fieldset>

      <fieldset className="m-0 border-0 p-0">
        <legend className="mb-1 text-[13.5px] font-medium text-ink">Services</legend>
        <p className="mb-[10px] text-[12.5px] text-muted-2">
          Pre-filled for a {vertical === "grooming" ? "grooming salon" : "barbershop"} — edit names,
          durations and prices to match yours.
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
                  Service {i + 1} name
                </label>
                <input
                  id={`ob-svc-name-${i}`}
                  className={`${inputCls} min-w-[160px] flex-1`}
                  value={svc.name}
                  onChange={(e) => setSvc({ name: e.target.value })}
                  placeholder="Service name"
                />
                <label className="sr-only" htmlFor={`ob-svc-dur-${i}`}>
                  Service {i + 1} duration in minutes
                </label>
                <div className="relative">
                  <input
                    id={`ob-svc-dur-${i}`}
                    type="number"
                    min="5"
                    step="5"
                    className={`${inputCls} w-[110px] pr-11`}
                    value={svc.durationMin}
                    onChange={(e) => setSvc({ durationMin: e.target.value })}
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[12.5px] text-muted-2">
                    min
                  </span>
                </div>
                <label className="sr-only" htmlFor={`ob-svc-price-${i}`}>
                  Service {i + 1} price in dollars
                </label>
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
                <button
                  type="button"
                  aria-label={`Remove service ${svc.name || i + 1}`}
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
          + Add service
        </button>
        {errors.services && (
          <p role="alert" className="mt-2 text-[12.5px] font-medium text-[#B4452C]">
            {errors.services}
          </p>
        )}
      </fieldset>

      <fieldset className="m-0 border-0 p-0">
        <legend className="mb-1 text-[13.5px] font-medium text-ink">Staff</legend>
        <p className="mb-[10px] text-[12.5px] text-muted-2">
          Who takes appointments? Callers can ask for someone by name.
        </p>
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
          Do your staff work different schedules?
        </label>
        <div className="flex flex-col gap-2">
          {setup.staff.map((member, i) => {
            const setMember = (partial: Partial<typeof member>) =>
              patch({ staff: setup.staff.map((m, j) => (j === i ? { ...m, ...partial } : m)) });
            return (
              <div key={member.id} className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <label className="sr-only" htmlFor={`ob-staff-${member.id}`}>
                    Staff member {i + 1} name
                  </label>
                  <input
                    id={`ob-staff-${member.id}`}
                    className={`${inputCls} max-w-[320px]`}
                    value={member.name}
                    onChange={(e) => setMember({ name: e.target.value })}
                    placeholder={i === 0 ? "Alex" : "Another name"}
                  />
                  {setup.staff.length > 1 && (
                    <button
                      type="button"
                      aria-label={`Remove staff member ${member.name || i + 1}`}
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
                      {member.name.trim() || `Staff member ${i + 1}`} — working hours
                    </p>
                    <HoursRows
                      hours={member.hours ?? cloneHours(setup.hours)}
                      idPrefix={`ob-staff-${member.id}`}
                      labelSuffix={` for ${member.name.trim() || `staff member ${i + 1}`}`}
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
          + Add staff member
        </button>
        {errors.staff && (
          <p role="alert" className="mt-2 text-[12.5px] font-medium text-[#B4452C]">
            {errors.staff}
          </p>
        )}
      </fieldset>

      <fieldset className="m-0 border-0 p-0">
        <legend className="mb-[10px] text-[13.5px] font-medium text-ink">Calendar</legend>
        <div className="flex flex-col gap-2">
          {(
            [
              {
                id: "google_calendar",
                label: "Google Calendar",
                desc: "We connect it during setup — bookings land straight in it.",
              },
              {
                id: "none",
                label: "No calendar",
                desc: "We track bookings for you; you get SMS confirmations.",
              },
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

      <fieldset className="m-0 border-0 p-0">
        <legend className="mb-[10px] text-[13.5px] font-medium text-ink">
          Which calls should Marisol answer?
        </legend>
        <div className="flex flex-col gap-2">
          {(
            [
              {
                id: "conditional",
                label: "Only when you can't answer",
                desc: "You still pick up when you're free — Marisol catches the rest, so no missed or busy call goes unanswered.",
                recommended: true,
              },
              {
                id: "all",
                label: "Every call",
                desc: "Marisol answers all calls for you. Best if you're solo or usually hands-on with clients.",
                recommended: false,
              },
            ] as const
          ).map((opt) => (
            <label
              key={opt.id}
              className={`flex cursor-pointer items-start gap-3 rounded-[14px] border px-4 py-3 ${
                setup.forwardMode === opt.id
                  ? "border-ink bg-white/80"
                  : "border-ink/15 bg-white/50"
              }`}
            >
              <input
                type="radio"
                name="ob-forward-mode"
                checked={setup.forwardMode === opt.id}
                onChange={() => patch({ forwardMode: opt.id })}
                className="mt-[3px] h-[16px] w-[16px] accent-[#4F8C80]"
              />
              <span>
                <span className="block text-[14.5px] font-medium">
                  {opt.label}
                  {opt.recommended && (
                    <span className="ml-2 text-[12.5px] font-medium text-teal">Recommended</span>
                  )}
                </span>
                <span className="block text-[13px] text-muted">{opt.desc}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <Field
        label="Number to forward"
        htmlFor="ob-forward"
        error={errors.forwardNumber}
        hint="The number your customers call today — we'll send simple forwarding instructions."
      >
        <input
          id="ob-forward"
          type="tel"
          className={`${inputCls} max-w-[320px]`}
          value={setup.forwardNumber}
          onChange={(e) => patch({ forwardNumber: e.target.value })}
          placeholder="+1 (555) 010-2244"
        />
      </Field>

      <Field label="Anything else we should know? (optional)" htmlFor="ob-notes">
        <textarea
          id="ob-notes"
          rows={3}
          className={`${inputCls} min-h-[88px] resize-y`}
          value={setup.notes}
          onChange={(e) => patch({ notes: e.target.value })}
          placeholder="Parking info, walk-in policy, a second language…"
        />
      </Field>
    </div>
  );
}
