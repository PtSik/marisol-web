"use client";
import { Field } from "@/components/onboarding/Field";
import { inputCls } from "@/components/onboarding/fieldStyles";
import { type Locale, fill, getDict } from "@/lib/i18n/dict";
import {
  type ServiceEntry,
  type SetupDetails,
  type Vertical,
  defaultSetup,
} from "@/lib/onboarding";

export function ServiceFields({
  setup,
  patch,
  locale,
  vertical,
  allowExamples,
  error,
  namePlaceholder,
}: {
  setup: SetupDetails;
  patch: (value: Partial<SetupDetails>) => void;
  locale: Locale;
  vertical: Vertical;
  allowExamples: boolean;
  error?: string;
  namePlaceholder: string;
}) {
  const t = getDict(locale).setup.serviceEditor;
  const isEmptyRow = (service: ServiceEntry) =>
    !service.name.trim() &&
    (!service.durationMin.trim() || service.durationMin === "30") &&
    !service.price.trim() &&
    !service.priceMax?.trim();
  const existing = setup.services.filter((service) => !isEmptyRow(service));
  const existingNames = new Set(existing.map((service) => service.name.trim().toLowerCase()));
  const namesEn = getDict("en").setup.servicePresets[vertical];
  const namesEs = getDict("es").setup.servicePresets[vertical];
  const examples = defaultSetup(
    vertical,
    getDict(locale).setup.servicePresets[vertical],
  ).services.filter(
    (_, index) =>
      !existingNames.has(namesEn[index].toLowerCase()) &&
      !existingNames.has(namesEs[index].toLowerCase()),
  );
  const canAddExamples = allowExamples && examples.length > 0 && existing.length < 30;
  return (
    <div className="space-y-4">
      <p className="t-body-sm text-muted">{t.intro}</p>
      {canAddExamples && (
        <div className="rounded-xl bg-cream p-4 t-body-sm">
          <p className="text-muted">{t.examplesLead}</p>
          <button
            type="button"
            className="mt-2 font-medium text-teal underline"
            onClick={() =>
              patch({
                services: [
                  ...existing,
                  ...examples.slice(0, 30 - existing.length).map((service) => ({
                    ...service,
                    price: "",
                    priceMax: "",
                  })),
                ],
              })
            }
          >
            {t.examplesCta}
          </button>
        </div>
      )}
      {setup.services.map((service, i) => {
        const update = (value: Partial<ServiceEntry>) =>
          patch({
            services: setup.services.map((s, index) => (index === i ? { ...s, ...value } : s)),
          });
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: rows are positional and editable
          <div key={i} className="rounded-[18px] border border-ink/[0.07] bg-cream-100 p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="t-caption font-semibold uppercase tracking-wide text-muted-2">
                {t.rowLabel} {i + 1}
              </span>
              <button
                type="button"
                className="t-caption text-muted underline"
                onClick={() =>
                  patch({ services: setup.services.filter((_, index) => index !== i) })
                }
              >
                {t.remove}
              </button>
            </div>
            <Field label={t.name} htmlFor={`service-name-${i}`}>
              <input
                id={`service-name-${i}`}
                className={inputCls}
                value={service.name}
                maxLength={120}
                placeholder={namePlaceholder}
                onChange={(e) => update({ name: e.target.value })}
              />
            </Field>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <Field label={t.duration} htmlFor={`service-duration-${i}`}>
                <input
                  id={`service-duration-${i}`}
                  className={inputCls}
                  type="number"
                  min={5}
                  max={1440}
                  step={5}
                  value={service.durationMin}
                  onChange={(e) => update({ durationMin: e.target.value })}
                />
              </Field>
              <Field label={t.price} htmlFor={`service-price-${i}`} hint={t.priceHint}>
                <input
                  id={`service-price-${i}`}
                  className={inputCls}
                  type="number"
                  min={0}
                  max={100000}
                  step="0.01"
                  value={service.price}
                  onChange={(e) => update({ price: e.target.value })}
                />
              </Field>
            </div>
            <details className="mt-3" open={service.priceMax?.trim() ? true : undefined}>
              <summary className="cursor-pointer t-caption text-teal">{t.priceVaries}</summary>
              <div className="mt-3">
                <Field label={t.priceMax} htmlFor={`service-price-max-${i}`} hint={t.priceMaxHint}>
                  <input
                    id={`service-price-max-${i}`}
                    type="number"
                    min={0}
                    max={100000}
                    step="0.01"
                    className={`${inputCls} max-w-48`}
                    value={service.priceMax ?? ""}
                    onChange={(e) => update({ priceMax: e.target.value })}
                  />
                </Field>
              </div>
            </details>
          </div>
        );
      })}
      {error && (
        <p role="alert" className="t-body-sm font-medium text-danger">
          {error}
        </p>
      )}
      <button
        type="button"
        disabled={setup.services.length >= 30}
        className="t-body-sm font-medium text-teal disabled:opacity-40"
        onClick={() =>
          patch({ services: [...setup.services, { name: "", durationMin: "", price: "" }] })
        }
      >
        {t.add}
      </button>
    </div>
  );
}
