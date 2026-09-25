"use client";

import { BookCallForm } from "@/components/onboarding/BookCallForm";
import { BusinessFields } from "@/components/onboarding/BusinessFields";
import { BusinessLookup } from "@/components/onboarding/BusinessLookup";
import { Field, type FieldErrors } from "@/components/onboarding/Field";
import { PlanPickerModal } from "@/components/onboarding/PlanPickerModal";
import { PlanSummary } from "@/components/onboarding/PlanSummary";
import { SetupFields, validateSetup } from "@/components/onboarding/SetupFields";
import { inputCls } from "@/components/onboarding/fieldStyles";
import { useOnboardingDraft } from "@/components/onboarding/useOnboardingDraft";
import { type Locale, fill, getDict, setupErrorMessage } from "@/lib/i18n/dict";
import {
  type BusinessBasics,
  DAYS,
  type SetupDetails,
  type Vertical,
  collapseLegacyDurationRanges,
  defaultBasics,
  defaultSetup,
  isExampleMenu,
  isUsPhone,
  normalizeSetup,
  validateSetupPayload,
} from "@/lib/onboarding";
import { type Billing, PRICE, type Plan, TRIAL_DAYS } from "@/lib/plans";
import { track } from "@/lib/track";
import { Suspense, lazy, useEffect, useRef, useState } from "react";

const OnboardingPreview = lazy(() =>
  import("@/components/onboarding/OnboardingPreview").then((m) => ({
    default: m.OnboardingPreview,
  })),
);

type Section = "services" | "hours" | "staff" | "calendar" | "calls";
const sections: readonly (readonly Section[])[] = [
  [],
  ["services"],
  ["hours"],
  ["staff", "calendar"],
  ["calls"],
  [],
];
const CALLS = 4;
const REVIEW = 5;
// Where a failed section sends the customer back to. `calendar` is a two-option radio that cannot
// be wrong, so it contributes none.
const sectionErrorKeys: Record<Section, readonly string[]> = {
  services: ["services"],
  hours: ["hours"],
  staff: ["staff"],
  calendar: [],
  calls: ["forwardNumber", "carrier", "languageMode", "primaryLanguage", "notes"],
};
// Section-level failures (services, hours, staff) have no single input to land on and are left
// unlinked rather than pointed at an arbitrary first row.
const errorFieldIds: Record<string, string> = {
  businessName: "ob-business",
  ownerName: "ob-owner",
  businessPhone: "ob-bizphone",
  ownerMobile: "ob-mobile",
  forwardNumber: "ob-forward",
  carrier: "ob-carrier",
  primaryLanguage: "ob-primary-language",
  notes: "ob-notes",
};
const copy = {
  en: {
    steps: ["Your business", "Services", "Hours", "Team & calendar", "Calls", "Review"],
    titles: [
      "Let’s set up your business",
      "What can customers book?",
      "When are you available?",
      "Who takes appointments, and where do they land?",
      "How should Marisol handle calls?",
      "Review your setup",
    ],
    hints: [
      "Tell us about your business. You’ll review everything before starting your trial.",
      "Add your real services, prices and appointment lengths. Leave an unknown price blank.",
      "Confirm your business hours. All appointment times use your business time zone.",
      "Add each person who can take an appointment, then tell us where bookings should land.",
      "Confirm your existing business number and how customers should be greeted.",
      "Check these details, then choose your plan. Our team will verify the setup before your phone goes live.",
    ],
    next: "Save and continue",
    back: "Back",
    edit: "Edit",
    loading: "Loading your saved setup…",
    saved: "Progress saved",
    saving: "Saving…",
    saveError: "Your latest changes haven’t been saved. Check your connection and try again.",
    conflict:
      "This setup changed in another tab. Your entries are still visible here. Reload to load the saved version before continuing.",
    retry: "Retry save",
    reload: "Reload saved setup",
    reviewCheck: "I’ve checked my services, hours, team and phone numbers.",
    pending:
      "After checkout, we’ll review your details, help connect Google Calendar, and test your receptionist with you before activation.",
    calendarNote:
      "You’ll connect Google Calendar after checkout, then pick which calendar Marisol books into. One calendar is enough for one person; teams can give each person their own.",
    otherCalendar:
      "Using Booksy, Fresha, Boulevard or another booking app? Tell us its name in the notes on the next step. Our team must confirm compatibility before you start a trial.",
    assisted: "Please ask our team to confirm your existing booking workflow before checkout.",
    timezone: "Business time zone",
    services: "Services",
    phone: "Existing business number",
    contact: "Owner contact",
    calendar: "Calendar",
    priceUnknown: "Price confirmed by the business",
    minutes: "min",
    closed: "Closed",
    notes: "Notes",
    noNotes: "None",
    required: "Please check the highlighted details.",
    progressLabel: "Setup progress",
    stepCounter: "Step {n} of {total}",
    stepDone: "completed, go back to this step",
    savingSetup: "Saving your setup…",
    servicesFromOtherVertical:
      "These services were added for {kind}. Check the names, lengths and prices still fit.",
  },
  es: {
    steps: ["Tu negocio", "Servicios", "Horario", "Equipo y calendario", "Llamadas", "Revisar"],
    titles: [
      "Configuremos tu negocio",
      "¿Qué pueden reservar los clientes?",
      "¿Cuándo estás disponible?",
      "¿Quién atiende las citas y dónde se anotan?",
      "¿Cómo debe atender Marisol?",
      "Revisa tu configuración",
    ],
    hints: [
      "Cuéntanos sobre tu negocio. Revisarás todo antes de iniciar la prueba.",
      "Añade tus servicios, precios y duración reales. Deja en blanco los precios desconocidos.",
      "Confirma el horario. Las citas usan la zona horaria del negocio.",
      "Añade a cada persona que atiende citas y dinos dónde deben anotarse las reservas.",
      "Confirma el número actual de tu negocio y el idioma del saludo.",
      "Revisa los datos y elige tu plan. Verificaremos la configuración antes de activar el teléfono.",
    ],
    next: "Guardar y continuar",
    back: "Atrás",
    edit: "Editar",
    loading: "Cargando tu configuración…",
    saved: "Progreso guardado",
    saving: "Guardando…",
    saveError: "No se han guardado los últimos cambios. Revisa tu conexión e inténtalo de nuevo.",
    conflict:
      "La configuración cambió en otra pestaña. Tus datos siguen visibles aquí. Recarga la versión guardada para continuar.",
    retry: "Reintentar",
    reload: "Recargar configuración",
    reviewCheck: "He revisado los servicios, horarios, equipo y teléfonos.",
    pending:
      "Después del pago, revisaremos tus datos, te ayudaremos a conectar Google Calendar y probaremos tu recepcionista contigo antes de activarla.",
    calendarNote:
      "Conectarás Google Calendar después del pago y luego elegirás en qué calendario reserva Marisol. Para una persona basta uno; en equipos cada persona puede tener el suyo.",
    otherCalendar:
      "¿Usas Booksy, Fresha, Boulevard u otra aplicación? Indica su nombre en las notas del siguiente paso. Debemos confirmar la compatibilidad antes de iniciar la prueba.",
    assisted:
      "Pide a nuestro equipo que confirme tu sistema de reservas antes de continuar al pago.",
    timezone: "Zona horaria del negocio",
    services: "Servicios",
    phone: "Número actual del negocio",
    contact: "Contacto del propietario",
    calendar: "Calendario",
    priceUnknown: "Precio a confirmar por el negocio",
    minutes: "min",
    closed: "Cerrado",
    notes: "Notas",
    noNotes: "Ninguna",
    required: "Revisa los datos señalados.",
    progressLabel: "Progreso",
    stepCounter: "Paso {n} de {total}",
    stepDone: "completado, volver a este paso",
    savingSetup: "Guardando tu configuración…",
    servicesFromOtherVertical:
      "Estos servicios se añadieron para {kind}. Revisa que los nombres, duraciones y precios sigan encajando.",
  },
};

export function OnboardingWizard({
  locale,
  accountEmail,
}: { locale: Locale; accountEmail: string }) {
  const dict = getDict(locale);
  const t = dict.onboarding;
  const c = copy[locale];
  const [initial] = useState(() => ({
    basics: { ...defaultBasics(), email: accountEmail },
    setup: {
      ...defaultSetup("grooming", []),
      services: [{ name: "", durationMin: "", price: "" }],
    },
    step: 0,
    plan: "basic" as Plan,
    billing: "annual" as Billing,
    planPicked: false,
  }));
  const { draft, setDraft, status, save, ready } = useOnboardingDraft(initial, accountEmail);
  const { basics, setup, step, plan, billing } = draft;
  const planPicked = draft.planPicked ?? false;
  const [pickerOpen, setPickerOpen] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  // Set once this step has been submitted, so blur can raise a message the user has already been
  // shown without ambushing anyone who is still filling the step in for the first time.
  const [validated, setValidated] = useState(false);
  // Bumped on every rejected submit, including one that lands on the same errors as the last, so
  // focus returns to the summary each time rather than only when the set of messages changes.
  const [rejected, setRejected] = useState(0);
  // Held across the validate → save → open-picker sequence so a second click cannot start it twice
  // and the button can say what the wait is for.
  const [advancing, setAdvancing] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [reviewed, setReviewed] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  // The import overwrites services and hours, so the pre-import draft is kept until the step is
  // left — that is what lets the match list act on one click instead of asking to confirm first.
  const importUndo = useRef<{ basics: BusinessBasics; setup: SetupDetails } | null>(null);
  const summary = useRef<HTMLDivElement>(null);
  const saveAlert = useRef<HTMLDivElement>(null);
  // Bumped when a step transition is abandoned because the draft would not save, so the banner
  // carrying the retry — which sits above the card, far from the button that was clicked — is
  // brought to the customer rather than left to be noticed.
  const [saveBlocked, setSaveBlocked] = useState(0);
  // The vertical the current service rows were written for, when they can no longer be swapped
  // automatically. Session-only: it is a nudge to re-read the menu, not part of the setup.
  const [staleServicesFrom, setStaleServicesFrom] = useState<Vertical | null>(null);

  useEffect(() => {
    const ref = document.cookie
      .split(";")
      .map((v) => v.trim())
      .find((v) => v.startsWith("marisol_ref="))
      ?.slice(12);
    try {
      if (ref) setReferralCode(decodeURIComponent(ref));
    } catch {}
  }, []);
  // biome-ignore lint/correctness/useExhaustiveDependencies: focus must move to the new step's heading
  useEffect(() => {
    heading.current?.focus();
  }, [step]);
  // Runs after the step-change focus above when a submit bounced the user back, so the summary
  // wins and the reason for the bounce is the first thing announced.
  useEffect(() => {
    if (rejected) summary.current?.focus();
  }, [rejected]);
  useEffect(() => {
    if (saveBlocked) saveAlert.current?.focus();
  }, [saveBlocked]);
  // Existing drafts from the earlier prefill may still carry legacy duration ranges. Repair only
  // unchanged preset rows; new accounts start blank and examples are an explicit customer action.
  // biome-ignore lint/correctness/useExhaustiveDependencies: migration must not re-run as rows are edited
  useEffect(() => {
    if (!sections[step].includes("services") || !ready) return;
    setDraft((d) => {
      const current = d.setup.services;
      const services = collapseLegacyDurationRanges(current);
      return services === current ? d : { ...d, setup: { ...d.setup, services } };
    });
  }, [step, basics.vertical, locale, ready]);

  const basicsErrorsOf = (b: BusinessBasics): FieldErrors => {
    const e: FieldErrors = {};
    if (!b.businessName.trim()) e.businessName = t.errBusinessName;
    if (!b.ownerName.trim()) e.ownerName = t.errOwnerName;
    if (!isUsPhone(b.businessPhone)) e.businessPhone = t.errBusinessPhone;
    if (!isUsPhone(b.ownerMobile)) e.ownerMobile = t.errOwnerMobile;
    return e;
  };
  const basicsErrors = () => basicsErrorsOf(basics);
  // Editing only ever clears a message. Re-raising one mid-keystroke is what makes a form shout at
  // someone halfway through typing a phone number; `revalidate` puts it back on blur instead.
  const dropResolved = (remaining: FieldErrors) =>
    setErrors((prev) => {
      const kept = Object.fromEntries(Object.entries(prev).filter(([key]) => remaining[key]));
      return Object.keys(kept).length === Object.keys(prev).length ? prev : kept;
    });
  const presetNames = (vertical: Vertical) => [
    getDict("en").setup.servicePresets[vertical],
    getDict("es").setup.servicePresets[vertical],
  ];
  const patch = (partial: Partial<BusinessBasics>) => {
    setReviewed(false);
    dropResolved(basicsErrorsOf({ ...basics, ...partial }));
    const to = partial.vertical;
    if (!to || to === basics.vertical) {
      setDraft((d) => ({ ...d, basics: { ...d.basics, ...partial } }));
      return;
    }
    const from = basics.vertical;
    const swap = isExampleMenu(setup.services, from, presetNames(from));
    const blank = setup.services.every((s) => !s.name.trim());
    setStaleServicesFrom(swap || blank ? null : from);
    setDraft((d) => ({
      ...d,
      basics: { ...d.basics, ...partial },
      ...(swap
        ? {
            setup: {
              ...d.setup,
              services: defaultSetup(to, dict.setup.servicePresets[to]).services,
            },
          }
        : {}),
    }));
  };
  const patchSetup = (partial: Partial<SetupDetails>) => {
    setReviewed(false);
    dropResolved(validateSetup(normalizeSetup({ ...setup, ...partial }), dict.setup));
    setDraft((d) => ({ ...d, setup: { ...d.setup, ...partial } }));
  };
  const revalidateBasics = (field: keyof BusinessBasics) => {
    if (!validated) return;
    const message = basicsErrorsOf(basics)[field];
    setErrors((prev) => {
      if (prev[field] === message) return prev;
      const next = { ...prev };
      if (message) next[field] = message;
      else delete next[field];
      return next;
    });
  };
  const go = (next: number) => {
    setErrors({});
    setValidated(false);
    setSubmitError(null);
    setDraft((d) => ({ ...d, step: next }));
  };
  const next = async () => {
    if (advancing) return;
    const all = step === 0 ? basicsErrors() : validateSetup(normalizeSetup(setup), dict.setup);
    const keys = step === 0 ? Object.keys(all) : sections[step].flatMap((s) => sectionErrorKeys[s]);
    const relevant = Object.fromEntries(Object.entries(all).filter(([key]) => keys.includes(key)));
    setErrors(relevant);
    if (Object.keys(relevant).length) {
      setValidated(true);
      setRejected((n) => n + 1);
      setSubmitError(c.required);
      return;
    }
    // Calls hands over to the picker without calling `go`, which is what used to clear this.
    setSubmitError(null);
    setAdvancing(true);
    try {
      if (!(await save())) {
        setSaveBlocked((n) => n + 1);
        return;
      }
      if (step === 0)
        setDraft((d) => ({
          ...d,
          setup: { ...d.setup, forwardNumber: d.setup.forwardNumber || basics.businessPhone },
        }));
      // The plan choice is the doorway into Review, not a step of its own — the customer stays on
      // Calls until they pick one, and nothing is bought here: the number is prepared after
      // checkout and the team's review.
      if (step === CALLS) {
        setPickerOpen(true);
        return;
      }
      go(step + 1);
      track("wizard_step", c.steps[step + 1]);
    } finally {
      setAdvancing(false);
    }
  };
  const submit = async () => {
    const bErrors = basicsErrors();
    const sErrors = validateSetup(normalizeSetup(setup), dict.setup);
    if (Object.keys(bErrors).length) {
      go(0);
      setErrors(bErrors);
      setValidated(true);
      setRejected((n) => n + 1);
      return;
    }
    if (Object.keys(sErrors).length) {
      const target = sections.findIndex((list) =>
        list.some((section) => sectionErrorKeys[section].some((key) => sErrors[key])),
      );
      go(target > 0 ? target : CALLS);
      setErrors(sErrors);
      setValidated(true);
      setRejected((n) => n + 1);
      return;
    }
    if (!reviewed || !(await save())) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intent: "checkout",
          flowVersion: 2,
          plan,
          billing,
          basics,
          setup: normalizeSetup(setup),
          locale,
          referralCode: referralCode.trim() || undefined,
          promoCode: promoCode.trim() || undefined,
        }),
      });
      const body = (await res.json()) as { url?: string; error?: string; sessionId?: string };
      if (res.status === 409 && body.error === "this account already has a subscription") {
        window.location.href = body.sessionId
          ? `/onboarding/thanks?session_id=${encodeURIComponent(body.sessionId)}`
          : "/portal";
        return;
      }
      if (!res.ok || !body.url) {
        setSubmitError(
          body.error === "promo not applicable"
            ? t.errPromoPlan
            : body.error?.startsWith("invalid ")
              ? setupErrorMessage(dict.setup, body.error)
              : t.errSubmit,
        );
        setSubmitting(false);
        return;
      }
      track("checkout_redirect", `${plan}:${billing}`);
      window.location.href = body.url;
    } catch {
      setSubmitError(t.errSubmit);
      setSubmitting(false);
    }
  };
  const disabled = submitting || status === "loading" || status === "conflict" || !ready;
  const errorList = Object.entries(errors).filter((entry): entry is [string, string] => !!entry[1]);
  // Mirrors the gate in `previewVariables`: below this the call would be offered the same partial
  // facts it gets on step 0, under a heading promising the finished setup.
  const setupComplete =
    !Object.keys(basicsErrors()).length && !validateSetupPayload(normalizeSetup(setup));
  // Offer the first preview after business confirmation, where it can at least greet with the
  // imported name and address. It returns on Review with the completed setup.
  const preview = (
    <Suspense
      fallback={<div className="my-5 h-[228px] animate-pulse rounded-[18px] bg-cream-200" />}
    >
      <OnboardingPreview
        key={step}
        locale={locale}
        save={save}
        businessName={basics.businessName}
        vertical={basics.vertical}
        variant={step === REVIEW ? "updated" : "early"}
      />
    </Suspense>
  );
  return (
    <div className="mx-auto w-full max-w-[820px] px-[var(--gutter)] pb-[var(--section-y)] 2xl:max-w-[1560px]">
      {/* The rail only appears where it fits *beside* a centred form: an empty twin on the left
          keeps the card on the page's centre line. Below 1536px that needs 320 + form + 320 and
          leaves the form too narrow, so everything stacks into the one centred column instead. */}
      <div className="grid grid-cols-1 gap-x-10 2xl:grid-cols-[320px_minmax(0,1fr)_320px] 2xl:items-start">
        {/* `contents` below xl so the rail's two children take their own place in the single
            column — progress above the form, preview below it — without a second copy of either
            in the DOM. The preview holds a live WebRTC session; two of them would be two calls. */}
        <div className="contents 2xl:sticky 2xl:top-[96px] 2xl:col-start-3 2xl:row-start-1 2xl:block 2xl:self-start">
          <div className="order-1 2xl:order-none">
            <ol
              aria-label={c.progressLabel}
              className="mb-4 flex flex-wrap justify-center gap-x-4 gap-y-2 t-caption 2xl:mb-5 2xl:flex-col 2xl:flex-nowrap 2xl:items-start 2xl:gap-y-1"
            >
              {c.steps.map((label, i) => {
                const done = i < step;
                const current = i === step;
                const marker = (
                  <>
                    <span
                      aria-hidden="true"
                      className={`mr-1.5 inline-flex h-6 w-6 items-center justify-center rounded-full ${
                        current ? "bg-ink text-cream" : done ? "bg-teal text-cream" : "bg-cream-200"
                      }`}
                    >
                      {done ? "✓" : i + 1}
                    </span>
                    {label}
                  </>
                );
                return (
                  <li
                    key={label}
                    aria-current={current ? "step" : undefined}
                    className={
                      current ? "font-semibold text-ink" : done ? "text-ink" : "text-muted-2"
                    }
                  >
                    {done ? (
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => go(i)}
                        className="inline-flex min-h-[44px] items-center disabled:opacity-50"
                      >
                        {marker}
                        <span className="sr-only"> — {c.stepDone}</span>
                      </button>
                    ) : (
                      <span className="inline-flex min-h-[44px] items-center">{marker}</span>
                    )}
                  </li>
                );
              })}
            </ol>
            <div className="mb-8 flex items-center justify-center gap-3 2xl:mb-0 2xl:justify-start">
              <span className="t-caption tabular-nums text-muted-2">
                {fill(c.stepCounter, { n: step + 1, total: c.steps.length })}
              </span>
              <span
                aria-hidden="true"
                className="h-1 w-[140px] overflow-hidden rounded-full bg-cream-200"
              >
                <span
                  className="block h-full rounded-full bg-ink transition-[width] duration-300"
                  style={{ width: `${((step + 1) / c.steps.length) * 100}%` }}
                />
              </span>
            </div>
          </div>
          <div className="order-3 2xl:order-none 2xl:mt-7">
            {(step === 1 || (step === REVIEW && setupComplete)) && preview}
          </div>
        </div>

        <div className="order-2 min-w-0 2xl:order-none 2xl:col-start-2 2xl:row-start-1">
          <div className="mb-7 text-center 2xl:text-left">
            <h1
              ref={heading}
              tabIndex={-1}
              className="mx-auto max-w-[20ch] font-display t-h2 font-bold text-balance 2xl:mx-0"
            >
              {c.titles[step]}
            </h1>
            <p className="mx-auto mt-4 max-w-[56ch] t-body text-balance text-muted 2xl:mx-0">
              {c.hints[step]}
            </p>
            <output aria-live="polite" className="mt-3 block t-caption text-muted-2">
              {status === "loading"
                ? c.loading
                : status === "saving"
                  ? c.saving
                  : status === "saved"
                    ? c.saved
                    : ""}
            </output>
          </div>
          {(status === "error" || status === "conflict") && (
            <div
              ref={saveAlert}
              tabIndex={-1}
              role="alert"
              className="surface mb-5 rounded-[18px] border-danger/30 p-4 t-body-sm"
            >
              <p>{status === "conflict" ? c.conflict : c.saveError}</p>
              <button
                type="button"
                className="mt-2 font-medium text-teal underline"
                onClick={() =>
                  status === "conflict" || !ready ? window.location.reload() : void save()
                }
              >
                {status === "conflict" || !ready ? c.reload : c.retry}
              </button>
            </div>
          )}
          {errorList.length > 0 && (
            <div
              ref={summary}
              tabIndex={-1}
              role="alert"
              className="surface mb-5 rounded-[18px] border-danger/30 p-4 t-body-sm"
            >
              <p className="font-medium">{c.required}</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {errorList.map(([key, message]) => {
                  const id = errorFieldIds[key];
                  return (
                    <li key={key}>
                      {id ? (
                        <a
                          href={`#${id}`}
                          className="font-medium text-danger underline"
                          onClick={(e) => {
                            e.preventDefault();
                            document.getElementById(id)?.focus();
                          }}
                        >
                          {message}
                        </a>
                      ) : (
                        <span className="font-medium text-danger">{message}</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          <div className="surface rounded-[24px] p-[clamp(20px,4vw,34px)]">
            <fieldset key={step} disabled={disabled} className="step-in m-0 min-w-0 border-0 p-0">
              {step === 0 && (
                <BusinessLookup
                  locale={locale}
                  onUndo={() => {
                    const snapshot = importUndo.current;
                    if (!snapshot) return;
                    importUndo.current = null;
                    setReviewed(false);
                    setDraft((d) => ({ ...d, ...snapshot }));
                  }}
                  onImport={(profile) => {
                    setReviewed(false);
                    importUndo.current = { basics, setup };
                    dropResolved(basicsErrorsOf({ ...basics, ...profile.basics }));
                    setDraft((d) => ({
                      ...d,
                      basics: { ...d.basics, ...profile.basics },
                      setup: {
                        ...d.setup,
                        forwardNumber: profile.basics.businessPhone,
                        hours: profile.hours ?? defaultSetup(d.basics.vertical, []).hours,
                        services: profile.services.length
                          ? profile.services
                          : [{ name: "", durationMin: "", price: "" }],
                      },
                    }));
                  }}
                />
              )}
              {step === 0 && (
                <BusinessFields
                  basics={basics}
                  accountEmail={accountEmail}
                  locale={locale}
                  errors={errors}
                  patch={patch}
                  revalidate={revalidateBasics}
                />
              )}
              {sections[step].includes("services") && staleServicesFrom && (
                <p className="mb-5 rounded-[16px] bg-cream-100 p-4 t-body-sm text-muted">
                  {fill(c.servicesFromOtherVertical, {
                    kind: t.verticals[staleServicesFrom].label,
                  })}
                </p>
              )}
              {sections[step].length > 0 && (
                <div className="flex flex-col gap-7">
                  {sections[step].map((section) => (
                    <SetupFields
                      key={section}
                      setup={setup}
                      vertical={basics.vertical}
                      errors={errors}
                      t={dict.setup}
                      locale={locale}
                      patch={patchSetup}
                      section={section}
                    />
                  ))}
                </div>
              )}
              {step === 3 && (
                <div className="mt-5 space-y-3 t-body-sm text-muted">
                  <p>{c.calendarNote}</p>
                  <p>{c.otherCalendar}</p>
                </div>
              )}
              {step === CALLS && (
                <p className="mt-5 rounded-[16px] bg-cream-100 p-4 t-body-sm text-muted">
                  {locale === "es"
                    ? "Las transferencias a una persona y los SMS están desactivados durante la configuración. Nuestro equipo puede revisar las opciones contigo."
                    : "Human transfers and SMS are off during setup. Our team can review those options with you."}
                </p>
              )}
              {step === 2 && (
                <p className="mt-4 t-body-sm text-muted">
                  {c.timezone}:{" "}
                  <strong>{dict.timezones[basics.timezone as keyof typeof dict.timezones]}</strong>{" "}
                  <button type="button" className="ml-2 text-teal underline" onClick={() => go(0)}>
                    {c.edit}
                  </button>
                </p>
              )}
              {step === REVIEW && (
                <div className="space-y-5">
                  {[
                    {
                      index: 0,
                      title: basics.businessName,
                      body: (
                        <>
                          {basics.address}
                          <br />
                          {c.contact}: {basics.ownerName} · {basics.ownerMobile}
                          <br />
                          {basics.email}
                          <br />
                          {c.timezone}:{" "}
                          {dict.timezones[basics.timezone as keyof typeof dict.timezones]}
                        </>
                      ),
                    },
                    {
                      index: 1,
                      title: c.services,
                      body: (
                        <ul className="space-y-2">
                          {setup.services.map((s, i) => (
                            <li key={`${i}:${s.name}`}>
                              {s.name} · {s.durationMin} {c.minutes} ·{" "}
                              {s.price
                                ? `$${s.price}${s.priceMax ? `–$${s.priceMax}` : ""}`
                                : c.priceUnknown}
                            </li>
                          ))}
                        </ul>
                      ),
                    },
                    {
                      index: 2,
                      title: c.steps[2],
                      body: (
                        <ul className="space-y-1">
                          {DAYS.map((day) => (
                            <li key={day}>
                              {dict.setup.days[day]}:{" "}
                              {setup.hours[day].closed
                                ? c.closed
                                : `${setup.hours[day].open}–${setup.hours[day].close}`}
                            </li>
                          ))}
                        </ul>
                      ),
                    },
                    {
                      index: 3,
                      title: c.steps[3],
                      body: (
                        <>
                          <ul className="space-y-3">
                            {setup.staff.map((m) => (
                              <li key={m.id}>
                                {m.name}
                                {setup.staffCustomHours && m.hours && (
                                  <ul>
                                    {DAYS.map((day) => (
                                      <li key={day}>
                                        {dict.setup.days[day]}:{" "}
                                        {m.hours?.[day].closed
                                          ? c.closed
                                          : `${m.hours?.[day].open}–${m.hours?.[day].close}`}
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </li>
                            ))}
                          </ul>
                          <p className="mt-3">
                            {c.calendar}:{" "}
                            {setup.calendar === "google_calendar"
                              ? "Google Calendar"
                              : dict.setup.calendarNone}
                          </p>
                        </>
                      ),
                    },
                    {
                      index: CALLS,
                      title: c.steps[CALLS],
                      body: (
                        <>
                          {c.phone}: {setup.forwardNumber}
                          <br />
                          {dict.setup.languageModeOptions[setup.languageMode ?? "bilingual"].label}
                          {(setup.languageMode ?? "bilingual") === "bilingual" &&
                            ` · ${dict.setup.primaryLanguageOptions[setup.primaryLanguage ?? locale]}`}
                          <br />
                          {setup.carrier &&
                            dict.setup.carrierShort[
                              setup.carrier as keyof typeof dict.setup.carrierShort
                            ]}
                          <br />
                          {locale === "es"
                            ? "Transferencias y SMS desactivados"
                            : "Human transfers and SMS off"}
                          <br />
                          {c.notes}: {setup.notes || c.noNotes}
                        </>
                      ),
                    },
                  ].map((item) => (
                    <section
                      key={item.index}
                      className="rounded-[18px] border border-ink/[0.07] bg-cream-100 p-5"
                    >
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <h2 className="t-body font-semibold">{item.title}</h2>
                        <button
                          type="button"
                          className="min-h-[44px] t-body-sm font-medium text-teal underline"
                          onClick={() => go(item.index)}
                        >
                          {c.edit}
                        </button>
                      </div>
                      <div className="t-body-sm text-muted">{item.body}</div>
                    </section>
                  ))}
                  <PlanSummary
                    t={t}
                    pricing={dict.pricing}
                    plan={plan}
                    billing={billing}
                    onChange={() => setPickerOpen(true)}
                  />
                  <details open>
                    <summary className="cursor-pointer t-body-sm font-medium text-teal">
                      {t.promoCode} / {t.referral}
                    </summary>
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <Field label={t.promoCode} htmlFor="ob-promo">
                        <input
                          id="ob-promo"
                          className={inputCls}
                          value={promoCode}
                          maxLength={80}
                          onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                        />
                      </Field>
                      <Field label={t.referral} htmlFor="ob-referral">
                        <input
                          id="ob-referral"
                          className={inputCls}
                          value={referralCode}
                          maxLength={80}
                          onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                        />
                      </Field>
                    </div>
                  </details>
                  <p className="rounded-[16px] bg-cream-100 p-4 t-body-sm text-muted">
                    {c.pending}
                  </p>
                  <label className="flex items-start gap-3 t-body-sm">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-5 w-5 shrink-0 accent-teal"
                      checked={reviewed}
                      onChange={(e) => setReviewed(e.target.checked)}
                    />
                    {c.reviewCheck}
                  </label>
                </div>
              )}
            </fieldset>
            {/* Field failures are already itemised by the summary above; this carries what has no
            field to point at, such as a rejected promo code or a checkout that would not start. */}
            {submitError && !errorList.length && (
              <p role="alert" className="mt-5 t-body-sm font-medium text-danger">
                {submitError}
              </p>
            )}
            <div className="mt-8 flex items-center justify-between gap-3">
              <button
                type="button"
                disabled={disabled || step === 0}
                onClick={() => go(step - 1)}
                className="btn btn-md btn-secondary disabled:cursor-not-allowed disabled:opacity-30"
              >
                {c.back}
              </button>
              <button
                type="button"
                disabled={disabled || advancing || (step === REVIEW && !reviewed)}
                onClick={() => void (step === REVIEW ? submit() : next())}
                className="btn btn-lg btn-primary whitespace-normal py-3 leading-snug disabled:cursor-not-allowed disabled:opacity-50"
              >
                {advancing && (
                  <span
                    aria-hidden="true"
                    className="h-4 w-4 animate-spin rounded-full border-2 border-cream/30 border-t-cream"
                  />
                )}
                {advancing
                  ? c.savingSetup
                  : submitting
                    ? t.submitting
                    : step === REVIEW
                      ? fill(t.submit, { days: TRIAL_DAYS, price: PRICE[plan][billing] })
                      : c.next}
              </button>
            </div>
            {step === REVIEW && (
              <p className="mt-4 text-center t-caption text-muted-2">
                {fill(t.trialNote, { days: TRIAL_DAYS })}
              </p>
            )}
          </div>
        </div>
      </div>
      <BookCallForm
        prefill={{
          name: basics.ownerName,
          email: basics.email,
          phone: basics.ownerMobile || basics.businessPhone,
        }}
        t={t}
        form={dict.callForm}
      />
      <PlanPickerModal
        open={pickerOpen}
        t={dict.pricing}
        locale={locale}
        billing={billing}
        selected={planPicked ? plan : null}
        onBillingChange={(billing) => setDraft((d) => ({ ...d, billing }))}
        onChoose={(chosen) => {
          setPickerOpen(false);
          setDraft((d) => ({ ...d, plan: chosen, planPicked: true }));
          // Reopened from Review's "Change plan" the customer is already there; this only carries
          // them over the first time, from Calls.
          if (step === CALLS) {
            go(REVIEW);
            track("wizard_step", c.steps[REVIEW]);
          }
        }}
        onDismiss={() => setPickerOpen(false)}
      />
    </div>
  );
}
