"use client";

import { BookCallForm } from "@/components/onboarding/BookCallForm";
import { inputCls } from "@/components/onboarding/fieldStyles";
import {
  DAYS,
  EMAIL_RE,
  type OnboardingData,
  PHONE_RE,
  SERVICE_PRESETS,
  TIMEZONES,
  VERTICALS,
  type Vertical,
  defaultData,
} from "@/lib/onboarding";
import { type Billing, PRICE } from "@/lib/plans";
import { type ReactNode, useEffect, useRef, useState } from "react";

const STORAGE_KEY = "kaijiro-onboarding";

const STEPS = ["Your business", "Setup details", "Review & pay"];

type Errors = Partial<Record<string, string>>;

function validateStep(step: number, data: OnboardingData): Errors {
  const errors: Errors = {};
  if (step === 0) {
    if (!data.businessName.trim()) errors.businessName = "Enter your business name.";
    if (!data.ownerName.trim()) errors.ownerName = "Enter your name.";
    if (!EMAIL_RE.test(data.email)) errors.email = "Enter a valid email address.";
    if (!PHONE_RE.test(data.businessPhone)) errors.businessPhone = "Enter a valid phone number.";
    if (!PHONE_RE.test(data.ownerMobile)) errors.ownerMobile = "Enter a valid mobile number.";
  }
  if (step === 1) {
    for (const day of DAYS) {
      const h = data.hours[day.id];
      if (!h.closed && h.open >= h.close) {
        errors.hours = "Opening time must be before closing time on every open day.";
        break;
      }
    }
    const validServices = data.services.filter((s) => s.name.trim() && Number(s.durationMin) > 0);
    if (validServices.length === 0)
      errors.services = "Add at least one service with a name and duration.";
    if (!data.staff.some((s) => s.trim())) errors.staff = "Add at least one staff member.";
    if (!PHONE_RE.test(data.forwardNumber))
      errors.forwardNumber = "Enter the number your customers currently call.";
  }
  return errors;
}

function Field({
  label,
  error,
  hint,
  htmlFor,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-[6px]">
      <label htmlFor={htmlFor} className="text-[13.5px] font-medium text-ink">
        {label}
      </label>
      {children}
      {hint && !error && <span className="text-[12.5px] text-muted-2">{hint}</span>}
      {error && (
        <span role="alert" className="text-[12.5px] font-medium text-[#B4452C]">
          {error}
        </span>
      )}
    </div>
  );
}

export function OnboardingWizard() {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<OnboardingData>(() => defaultData());
  const [billing, setBilling] = useState<Billing>("monthly");
  const [errors, setErrors] = useState<Errors>({});
  const [cancelled, setCancelled] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const hydrated = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("billing") === "annual") setBilling("annual");
    if (params.get("cancelled") === "1") setCancelled(true);
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as { data: OnboardingData; billing: Billing };
        if (parsed?.data?.vertical) {
          setData(parsed.data);
          if (params.get("billing") == null) setBilling(parsed.billing);
        }
      } else {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (tz) setData((d) => ({ ...d, timezone: tz }));
      }
    } catch {
      /* corrupted storage — start fresh */
    }
    hydrated.current = true;
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ data, billing }));
    } catch {
      /* storage full/blocked — non-fatal */
    }
  }, [data, billing]);

  const patch = (partial: Partial<OnboardingData>) => setData((d) => ({ ...d, ...partial }));

  const setVertical = (vertical: Vertical) =>
    setData((d) => {
      const untouched = JSON.stringify(d.services) === JSON.stringify(SERVICE_PRESETS[d.vertical]);
      return {
        ...d,
        vertical,
        services: untouched ? SERVICE_PRESETS[vertical].map((s) => ({ ...s })) : d.services,
      };
    });

  const next = () => {
    const errs = validateStep(step, data);
    setErrors(errs);
    if (Object.keys(errs).length === 0) {
      setStep((s) => Math.min(s + 1, 2));
      window.scrollTo({ top: 0 });
    }
  };

  const back = () => {
    setErrors({});
    setStep((s) => Math.max(s - 1, 0));
    window.scrollTo({ top: 0 });
  };

  const submit = async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent: "checkout", billing, data }),
      });
      const body = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !body.url) {
        throw new Error(body.error ?? "checkout failed");
      }
      window.location.href = body.url;
    } catch {
      setSubmitError("Something went wrong starting checkout. Please try again.");
      setSubmitting(false);
    }
  };

  const timezones = TIMEZONES.some((tz) => tz.id === data.timezone)
    ? TIMEZONES
    : [{ id: data.timezone, label: data.timezone.replace(/_/g, " ") }, ...TIMEZONES];

  return (
    <div className="mx-auto max-w-[720px] px-[22px] pb-[clamp(48px,7vw,88px)]">
      <div className="mb-7 text-center">
        <span className="inline-block rounded-full bg-cream-200 px-[13px] py-[7px] text-[11.5px] font-semibold uppercase tracking-[0.16em] text-muted-2">
          Get started
        </span>
        <h1 className="mx-auto mt-[18px] max-w-[22ch] font-display text-[clamp(26px,4.4vw,40px)] font-light leading-[1.1] tracking-[-0.03em]">
          Tell us about your shop — we set up the rest.
        </h1>
      </div>

      {cancelled && (
        <output className="mb-5 block rounded-[12px] bg-cream-200 px-4 py-3 text-[14px] text-muted">
          Payment was cancelled — your details are saved below whenever you're ready.
        </output>
      )}

      <nav aria-label="Progress" className="mb-7">
        <ol className="flex items-center justify-center gap-2">
          {STEPS.map((label, i) => (
            <li key={label} className="flex items-center gap-2">
              <span
                aria-current={i === step ? "step" : undefined}
                className={`flex min-h-[30px] items-center gap-2 rounded-full px-[13px] py-[6px] text-[12.5px] font-medium ${
                  i === step
                    ? "bg-ink text-cream"
                    : i < step
                      ? "bg-cream-200 text-ink"
                      : "bg-cream-200 text-muted-2"
                }`}
              >
                {i + 1}. <span className="hidden sm:inline">{label}</span>
              </span>
            </li>
          ))}
        </ol>
      </nav>

      <div className="rounded-[24px] bg-cream-100 p-[clamp(20px,4vw,34px)]">
        {step === 0 && (
          <div className="flex flex-col gap-5">
            <fieldset className="m-0 border-0 p-0">
              <legend className="mb-[10px] text-[13.5px] font-medium text-ink">
                What kind of business is it?
              </legend>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {VERTICALS.map((v) => {
                  const active = data.vertical === v.id;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setVertical(v.id)}
                      className={`rounded-[16px] border px-[18px] py-4 text-left transition-all ${
                        active
                          ? "border-ink bg-ink text-cream"
                          : "border-ink/15 bg-white/70 text-ink"
                      }`}
                    >
                      <span className="block text-[15px] font-medium">{v.label}</span>
                      <span
                        className={`mt-1 block text-[13px] leading-[1.45] ${
                          active ? "text-cream/70" : "text-muted"
                        }`}
                      >
                        {v.blurb}
                      </span>
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <Field label="Business name" htmlFor="ob-business" error={errors.businessName}>
              <input
                id="ob-business"
                className={inputCls}
                value={data.businessName}
                onChange={(e) => patch({ businessName: e.target.value })}
                placeholder="Fade District"
                autoComplete="organization"
              />
            </Field>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Field label="Your name" htmlFor="ob-owner" error={errors.ownerName}>
                <input
                  id="ob-owner"
                  className={inputCls}
                  value={data.ownerName}
                  onChange={(e) => patch({ ownerName: e.target.value })}
                  placeholder="Alex Rivera"
                  autoComplete="name"
                />
              </Field>
              <Field label="Email" htmlFor="ob-email" error={errors.email}>
                <input
                  id="ob-email"
                  type="email"
                  className={inputCls}
                  value={data.email}
                  onChange={(e) => patch({ email: e.target.value })}
                  placeholder="alex@fadedistrict.com"
                  autoComplete="email"
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Field
                label="Business phone"
                htmlFor="ob-bizphone"
                error={errors.businessPhone}
                hint="Where we transfer callers who ask for a human."
              >
                <input
                  id="ob-bizphone"
                  type="tel"
                  className={inputCls}
                  value={data.businessPhone}
                  onChange={(e) => patch({ businessPhone: e.target.value })}
                  placeholder="+1 (555) 210-4890"
                  autoComplete="tel"
                />
              </Field>
              <Field
                label="Your mobile"
                htmlFor="ob-mobile"
                error={errors.ownerMobile}
                hint="For urgent escalations only."
              >
                <input
                  id="ob-mobile"
                  type="tel"
                  className={inputCls}
                  value={data.ownerMobile}
                  onChange={(e) => patch({ ownerMobile: e.target.value })}
                  placeholder="+1 (555) 902-3311"
                  autoComplete="tel"
                />
              </Field>
            </div>

            <Field label="Timezone" htmlFor="ob-tz">
              <select
                id="ob-tz"
                className={inputCls}
                value={data.timezone}
                onChange={(e) => patch({ timezone: e.target.value })}
              >
                {timezones.map((tz) => (
                  <option key={tz.id} value={tz.id}>
                    {tz.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        )}

        {step === 1 && (
          <div className="flex flex-col gap-7">
            <fieldset className="m-0 border-0 p-0">
              <legend className="mb-[10px] text-[13.5px] font-medium text-ink">
                Opening hours
              </legend>
              <div className="flex flex-col gap-2">
                {DAYS.map((day) => {
                  const h = data.hours[day.id];
                  const setDay = (dh: Partial<typeof h>) =>
                    patch({ hours: { ...data.hours, [day.id]: { ...h, ...dh } } });
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
                Pre-filled for a {data.vertical === "grooming" ? "grooming salon" : "barbershop"} —
                edit names, durations and prices to match yours.
              </p>
              <div className="flex flex-col gap-2">
                {data.services.map((svc, i) => {
                  const setSvc = (partial: Partial<typeof svc>) =>
                    patch({
                      services: data.services.map((s, j) => (j === i ? { ...s, ...partial } : s)),
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
                        onClick={() => patch({ services: data.services.filter((_, j) => j !== i) })}
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
                  patch({
                    services: [...data.services, { name: "", durationMin: "30", price: "" }],
                  })
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
                {data.staff.map((name, i) => (
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
                        patch({ staff: data.staff.map((s, j) => (j === i ? e.target.value : s)) })
                      }
                      placeholder={i === 0 ? "Alex" : "Another name"}
                    />
                    {data.staff.length > 1 && (
                      <button
                        type="button"
                        aria-label={`Remove staff member ${name || i + 1}`}
                        onClick={() => patch({ staff: data.staff.filter((_, j) => j !== i) })}
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
                onClick={() => patch({ staff: [...data.staff, ""] })}
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
                      data.calendar === opt.id
                        ? "border-ink bg-white/80"
                        : "border-ink/15 bg-white/50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="ob-calendar"
                      checked={data.calendar === opt.id}
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
                value={data.forwardNumber}
                onChange={(e) => patch({ forwardNumber: e.target.value })}
                placeholder="+1 (555) 010-2244"
              />
            </Field>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-6">
            <div className="rounded-[16px] bg-white/70 p-[18px]">
              <h2 className="mb-3 font-display text-[20px] font-normal tracking-[-0.01em]">
                {data.businessName || "Your shop"}
              </h2>
              <dl className="grid grid-cols-1 gap-x-6 gap-y-[10px] text-[14px] sm:grid-cols-2">
                <div>
                  <dt className="text-[12px] font-semibold uppercase tracking-[0.1em] text-muted-2">
                    Type
                  </dt>
                  <dd className="m-0 mt-[2px]">
                    {VERTICALS.find((v) => v.id === data.vertical)?.label}
                  </dd>
                </div>
                <div>
                  <dt className="text-[12px] font-semibold uppercase tracking-[0.1em] text-muted-2">
                    Contact
                  </dt>
                  <dd className="m-0 mt-[2px]">
                    {data.ownerName} · {data.email}
                  </dd>
                </div>
                <div>
                  <dt className="text-[12px] font-semibold uppercase tracking-[0.1em] text-muted-2">
                    Services
                  </dt>
                  <dd className="m-0 mt-[2px]">
                    {data.services
                      .filter((s) => s.name.trim())
                      .map((s) => s.name)
                      .join(", ")}
                  </dd>
                </div>
                <div>
                  <dt className="text-[12px] font-semibold uppercase tracking-[0.1em] text-muted-2">
                    Staff
                  </dt>
                  <dd className="m-0 mt-[2px]">{data.staff.filter((s) => s.trim()).join(", ")}</dd>
                </div>
                <div>
                  <dt className="text-[12px] font-semibold uppercase tracking-[0.1em] text-muted-2">
                    Hours
                  </dt>
                  <dd className="m-0 mt-[2px]">
                    {DAYS.filter((d) => !data.hours[d.id].closed).length} days a week ·{" "}
                    {TIMEZONES.find((tz) => tz.id === data.timezone)?.label.split(" — ")[0] ??
                      data.timezone.replace(/_/g, " ")}
                  </dd>
                </div>
                <div>
                  <dt className="text-[12px] font-semibold uppercase tracking-[0.1em] text-muted-2">
                    Forwarding
                  </dt>
                  <dd className="m-0 mt-[2px]">{data.forwardNumber}</dd>
                </div>
              </dl>
              <button
                type="button"
                onClick={() => setStep(0)}
                className="mt-4 text-[13.5px] font-medium text-teal"
              >
                Edit details
              </button>
            </div>

            <Field label="Anything else we should know? (optional)" htmlFor="ob-notes">
              <textarea
                id="ob-notes"
                rows={3}
                className={`${inputCls} min-h-[88px] resize-y`}
                value={data.notes}
                onChange={(e) => patch({ notes: e.target.value })}
                placeholder="Parking info, walk-in policy, a second language…"
              />
            </Field>

            <fieldset className="m-0 border-0 p-0 text-center">
              <legend className="sr-only">Billing period</legend>
              <div className="inline-flex items-center gap-1 rounded-[14px] bg-cream-200 p-1 shadow-[inset_0_1px_2px_rgba(36,27,20,0.06)]">
                {(["monthly", "annual"] as const).map((period) => {
                  const isActive = period === billing;
                  return (
                    <button
                      key={period}
                      type="button"
                      aria-pressed={isActive}
                      onClick={() => setBilling(period)}
                      className={`min-h-[38px] rounded-[10px] px-4 py-[9px] text-[13px] font-medium capitalize transition-all ${
                        isActive ? "bg-ink text-cream" : "bg-transparent text-muted"
                      }`}
                    >
                      {period}
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-[13px] text-muted-2">
                {billing === "annual"
                  ? `$${PRICE.annual}/mo billed yearly — 1 month free`
                  : `$${PRICE.monthly}/mo, cancel anytime`}
              </p>
            </fieldset>

            {submitError && (
              <p role="alert" className="text-center text-[13.5px] font-medium text-[#B4452C]">
                {submitError}
              </p>
            )}
          </div>
        )}

        <div className="mt-8 flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
          {step > 0 ? (
            <button
              type="button"
              onClick={back}
              className="inline-flex min-h-[50px] items-center justify-center rounded-[13px] px-5 py-[14px] text-[15px] font-medium text-muted"
            >
              ← Back
            </button>
          ) : (
            <a
              href="/#pricing"
              className="inline-flex min-h-[50px] items-center justify-center rounded-[13px] px-5 py-[14px] text-[15px] font-medium text-muted no-underline"
            >
              ← Back to site
            </a>
          )}
          {step < 2 ? (
            <button
              type="button"
              onClick={next}
              className="inline-flex min-h-[50px] items-center justify-center gap-2 rounded-[13px] bg-ink px-7 py-[14px] text-[15px] font-medium text-cream"
            >
              Continue →
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={submitting}
              className="inline-flex min-h-[50px] items-center justify-center gap-2 rounded-[13px] bg-ink px-7 py-[14px] text-[15px] font-medium text-cream disabled:opacity-60"
            >
              {submitting
                ? "Redirecting to Stripe…"
                : `Continue to payment — $${PRICE[billing]}/mo`}
            </button>
          )}
        </div>
      </div>

      <BookCallForm
        prefill={{
          name: data.ownerName,
          email: data.email,
          phone: data.ownerMobile || data.businessPhone,
        }}
      />
    </div>
  );
}
