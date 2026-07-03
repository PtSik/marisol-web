"use client";

import { Field, type FieldErrors } from "@/components/onboarding/Field";
import { inputCls } from "@/components/onboarding/fieldStyles";
import { DAYS, PHONE_RE, type SetupDetails, type Vertical } from "@/lib/onboarding";

export function validateSetup(setup: SetupDetails): FieldErrors {
  const errors: FieldErrors = {};
  for (const day of DAYS) {
    const h = setup.hours[day.id];
    if (!h.closed && h.open >= h.close) {
      errors.hours = "Opening time must be before closing time on every open day.";
      break;
    }
  }
  const validServices = setup.services.filter((s) => s.name.trim() && Number(s.durationMin) > 0);
  if (validServices.length === 0)
    errors.services = "Add at least one service with a name and duration.";
  if (!setup.staff.some((s) => s.trim())) errors.staff = "Add at least one staff member.";
  if (!PHONE_RE.test(setup.forwardNumber))
    errors.forwardNumber = "Enter the number your customers currently call.";
  return errors;
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
        <div className="flex flex-col gap-2">
          {DAYS.map((day) => {
            const h = setup.hours[day.id];
            const setDay = (dh: Partial<typeof h>) =>
              patch({ hours: { ...setup.hours, [day.id]: { ...h, ...dh } } });
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
                    <label className="sr-only" htmlFor={`ob-open-${day.id}`}>
                      {day.label} opening time
                    </label>
                    <input
                      id={`ob-open-${day.id}`}
                      type="time"
                      value={h.open}
                      onChange={(e) => setDay({ open: e.target.value })}
                      className="min-h-[40px] rounded-[9px] border border-ink/15 bg-white px-2 py-1 text-[14px]"
                    />
                    <span className="text-muted-2">–</span>
                    <label className="sr-only" htmlFor={`ob-close-${day.id}`}>
                      {day.label} closing time
                    </label>
                    <input
                      id={`ob-close-${day.id}`}
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
        <div className="flex flex-col gap-2">
          {setup.staff.map((name, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: rows are positional and editable
            <div key={i} className="flex items-center gap-2">
              <label className="sr-only" htmlFor={`ob-staff-${i}`}>
                Staff member {i + 1} name
              </label>
              <input
                id={`ob-staff-${i}`}
                className={`${inputCls} max-w-[320px]`}
                value={name}
                onChange={(e) =>
                  patch({ staff: setup.staff.map((s, j) => (j === i ? e.target.value : s)) })
                }
                placeholder={i === 0 ? "Alex" : "Another name"}
              />
              {setup.staff.length > 1 && (
                <button
                  type="button"
                  aria-label={`Remove staff member ${name || i + 1}`}
                  onClick={() => patch({ staff: setup.staff.filter((_, j) => j !== i) })}
                  className="flex h-11 w-11 items-center justify-center rounded-[10px] text-muted-2 hover:bg-cream-200"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => patch({ staff: [...setup.staff, ""] })}
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
