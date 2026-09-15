"use client";
import { Field, type FieldErrors } from "@/components/onboarding/Field";
import { choiceCls, inputCls } from "@/components/onboarding/fieldStyles";
import { type Locale, fill, getDict } from "@/lib/i18n/dict";
import { type BusinessBasics, TIMEZONE_IDS, VERTICAL_IDS, type Vertical } from "@/lib/onboarding";
export function BusinessFields({
  basics,
  accountEmail,
  locale,
  errors,
  patch,
  revalidate,
}: {
  basics: BusinessBasics;
  accountEmail: string;
  locale: Locale;
  errors: FieldErrors;
  patch: (value: Partial<BusinessBasics>) => void;
  revalidate: (field: keyof BusinessBasics) => void;
}) {
  const dict = getDict(locale);
  const t = dict.onboarding;
  const timezones = TIMEZONE_IDS.map((id) => ({ id, label: dict.timezones[id] }));
  return (
    <div className="flex flex-col gap-7">
      <fieldset className="m-0 border-0 p-0">
        <legend className="mb-[10px] t-body-sm font-medium text-ink">{t.verticalLegend}</legend>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {VERTICAL_IDS.map((id) => {
            const active = basics.vertical === id;
            return (
              <button
                key={id}
                type="button"
                aria-pressed={active}
                onClick={() => patch({ vertical: id as Vertical })}
                className={`${choiceCls(active)} ${active ? "ring-1 ring-ink" : ""}`}
              >
                <span>
                  <span className="block t-body font-medium">{t.verticals[id].label}</span>
                  <span className="mt-1 block t-caption text-muted">{t.verticals[id].blurb}</span>
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="m-0 border-0 p-0">
        <legend className="mb-[10px] t-body-sm font-medium text-ink">{t.businessGroup}</legend>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field label={t.businessName} htmlFor="ob-business" error={errors.businessName}>
            <input
              id="ob-business"
              className={inputCls}
              value={basics.businessName}
              onChange={(e) => patch({ businessName: e.target.value })}
              onBlur={() => revalidate("businessName")}
              placeholder={t.businessNamePlaceholder}
              autoComplete="organization"
            />
          </Field>

          <Field
            label={t.businessPhone}
            htmlFor="ob-bizphone"
            error={errors.businessPhone}
            hint={t.businessPhoneKeepHint}
          >
            <input
              id="ob-bizphone"
              type="tel"
              className={inputCls}
              value={basics.businessPhone}
              onChange={(e) => patch({ businessPhone: e.target.value })}
              onBlur={() => revalidate("businessPhone")}
              placeholder={t.businessPhonePlaceholder}
              autoComplete="tel"
            />
          </Field>

          <Field label={t.address} htmlFor="ob-address" hint={t.addressHint}>
            <input
              id="ob-address"
              className={inputCls}
              value={basics.address ?? ""}
              onChange={(e) => patch({ address: e.target.value })}
              placeholder={t.addressPlaceholder}
              autoComplete="street-address"
            />
          </Field>

          <Field label={t.timezone} htmlFor="ob-tz">
            <select
              id="ob-tz"
              className={inputCls}
              value={basics.timezone}
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
      </fieldset>

      {/* Separated from the business block on purpose: nothing here comes from a public listing, so
          leaving it beside the imported fields reads as the import having failed. */}
      <fieldset className="m-0 flex flex-col gap-5 border-0 p-0">
        <legend className="mb-[10px] t-body-sm font-medium text-ink">{t.contactGroup}</legend>
        <p className="t-caption text-muted-2">{t.contactGroupHint}</p>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field label={t.ownerName} htmlFor="ob-owner" error={errors.ownerName}>
            <input
              id="ob-owner"
              className={inputCls}
              value={basics.ownerName}
              onChange={(e) => patch({ ownerName: e.target.value })}
              onBlur={() => revalidate("ownerName")}
              placeholder={t.ownerNamePlaceholder}
              autoComplete="name"
            />
          </Field>
          <Field
            label={t.ownerMobile}
            htmlFor="ob-mobile"
            error={errors.ownerMobile}
            hint={t.ownerMobileSetupHint}
          >
            <input
              id="ob-mobile"
              type="tel"
              className={inputCls}
              value={basics.ownerMobile}
              onChange={(e) => patch({ ownerMobile: e.target.value })}
              onBlur={() => revalidate("ownerMobile")}
              placeholder={t.ownerMobilePlaceholder}
              autoComplete="tel"
            />
          </Field>
        </div>
        <p className="t-caption text-muted-2">{fill(t.signedInAs, { email: accountEmail })}</p>
      </fieldset>
    </div>
  );
}
