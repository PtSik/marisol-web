import {
  ActionPanel,
  Disclosure,
  Field,
  FieldGrid,
  Hint,
  Pill,
  Row,
  Strip,
  SubmitButton,
  type Tone,
  fmtDate,
} from "@/components/admin/ui";
import { CARRIER_REFERENCE, carrierCodes, forwardingVerification } from "@/lib/forwarding";
import {
  ACTIVATABLE_LEAD_STATUSES,
  type CheckoutLead,
  activationNeedsReconciliation,
} from "@/lib/leads";
import { normalizePlan } from "@/lib/plans";
import { usAreaCode } from "@/lib/twilio";

export interface Shop {
  id: string;
  status?: string;
  integration?: string;
  reminders_enabled?: boolean;
}

const LEAD_TONE: Record<CheckoutLead["status"], Tone> = {
  provisioned: "teal",
  pending_review: "amber",
  activating: "amber",
  activation_failed: "red",
  setup_complete: "amber",
  paid: "amber",
  created: "muted",
  cancellation_pending: "red",
  cancelled: "red",
};

/** Grid shared by the lead rows and their column captions. */
export const LEAD_COLUMNS =
  "grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[minmax(0,2.2fr)_minmax(0,2fr)_minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,9rem)]";

export function LeadColumnHeaders() {
  return (
    <>
      <span>Business</span>
      <span>Owner</span>
      <span>Number</span>
      <span>Last event</span>
      <span>Status</span>
    </>
  );
}

/** Leads that are waiting on the operator rather than on the client or on Stripe. */
export function leadNeedsAction(lead: CheckoutLead): boolean {
  if (lead.status === "cancellation_pending") return true;
  if (lead.status === "activating") return true;
  return Boolean(lead.setup) && ACTIVATABLE_LEAD_STATUSES.has(lead.status);
}

function isCalendarConnected(shop?: Shop): boolean {
  return shop?.integration === "google_calendar";
}

function lastEvent(lead: CheckoutLead): string {
  return fmtDate(
    lead.provisionedAt ??
      lead.activationFailedAt ??
      lead.setupCompletedAt ??
      lead.paidAt ??
      lead.createdAt,
  );
}

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

type Day = (typeof DAYS)[number];

function dayLabel(day: Day): string {
  return day.charAt(0).toUpperCase() + day.slice(1);
}

/** "Mon–Fri 09:00–18:00 · Sat 10:00–16:00 · Sun closed" — runs of equal days collapse. */
function hoursPreview(lead: CheckoutLead): string {
  const hours = lead.setup?.hours;
  if (!hours) return "";
  const value = (day: Day) => {
    const h = hours[day];
    return h?.closed ? "closed" : `${h?.open}–${h?.close}`;
  };
  const parts: string[] = [];
  let start = 0;
  for (let i = 1; i <= DAYS.length; i++) {
    if (i < DAYS.length && value(DAYS[i]) === value(DAYS[start])) continue;
    const span =
      i - start === 1 ? dayLabel(DAYS[start]) : `${dayLabel(DAYS[start])}–${dayLabel(DAYS[i - 1])}`;
    parts.push(`${span} ${value(DAYS[start])}`);
    start = i;
  }
  return parts.join(" · ");
}

/** "4 services · $15–$110" */
function servicesPreview(lead: CheckoutLead, count: number): string {
  if (count === 0) return "none";
  const label = `${count} service${count === 1 ? "" : "s"}`;
  const prices = (lead.setup?.services ?? [])
    .flatMap((service) => [service.price, service.priceMax ?? ""])
    .map((raw) => Number.parseFloat(raw))
    .filter((n) => Number.isFinite(n));
  if (prices.length === 0) return label;
  const low = Math.min(...prices);
  const high = Math.max(...prices);
  return `${label} · ${low === high ? `$${low}` : `$${low}–$${high}`}`;
}

function HoursStrip({ lead }: { lead: CheckoutLead }) {
  if (!lead.setup) return null;
  return (
    <ul className="flex flex-wrap gap-1.5">
      {DAYS.map((day) => {
        const hours = lead.setup?.hours[day];
        const closed = hours?.closed;
        return (
          <li
            key={day}
            className={`rounded-[7px] px-2 py-1 text-xs tabular-nums ${
              closed
                ? "bg-ink/5 text-muted-3"
                : "bg-offwhite text-ink ring-1 ring-inset ring-ink/10"
            }`}
          >
            <span className="font-medium uppercase">{day}</span>{" "}
            {closed ? "closed" : `${hours?.open}–${hours?.close}`}
          </li>
        );
      })}
    </ul>
  );
}

interface ServiceRow {
  name: string;
  duration: string;
  price: string;
  priced: boolean;
}

function serviceRows(lead: CheckoutLead): ServiceRow[] {
  return (lead.setup?.services ?? [])
    .filter((service) => service.name.trim())
    .map((service) => {
      const priced = Boolean(service.price.trim());
      return {
        name: service.name.trim(),
        duration: service.durationMaxMin?.trim()
          ? `${service.durationMin}–${service.durationMaxMin} min`
          : `${service.durationMin} min`,
        price: service.priceMax?.trim()
          ? `$${service.price}–$${service.priceMax}`
          : priced
            ? `$${service.price}`
            : "not set",
        priced,
      };
    });
}

/** Name left, duration and price right-aligned so the operator can compare down a column. */
function ServicesTable({ rows }: { rows: ServiceRow[] }) {
  if (rows.length === 0) return <p className="text-sm text-muted">none</p>;
  return (
    <table className="w-full text-sm">
      <tbody>
        {rows.map((row) => (
          <tr key={`${row.name}·${row.duration}·${row.price}`} className="align-baseline">
            <td className="py-1 pr-6">{row.name}</td>
            <td className="w-px whitespace-nowrap py-1 pr-6 text-right tabular-nums text-muted">
              {row.duration}
            </td>
            <td
              className={`w-px whitespace-nowrap py-1 text-right tabular-nums ${
                row.priced ? "text-ink" : "text-muted-3"
              }`}
            >
              {row.price}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ForwardingBlock({ lead }: { lead: CheckoutLead }) {
  if (!lead.setup) return null;
  const target = (
    <p className="text-sm">
      <span className="tabular-nums">{lead.setup.forwardNumber}</span>
      <span className="text-muted-2"> · carrier {lead.setup.carrier ?? "unknown"}</span>
    </p>
  );
  // The dial codes forward to the Twilio number, so before activation there is nothing to point
  // them at. Until then the number and carrier are all the activation review has to confirm.
  if (!lead.assignedNumber) return target;

  const notes =
    lead.setup.carrier && lead.setup.carrier !== "unknown"
      ? CARRIER_REFERENCE[lead.setup.carrier]
      : [];
  const verification = forwardingVerification(lead.setup.carrier);
  return (
    <div>
      {target}
      <ul className="mt-2 space-y-0.5">
        {carrierCodes(lead.setup.carrier, lead.assignedNumber).map((c) => (
          <li key={c.dial.join()} className="text-xs tabular-nums text-muted">
            on <span className="text-ink">{c.dial.join(" + ")}</span> · off{" "}
            <span className="text-ink">{c.off.join(" + ")}</span>
          </li>
        ))}
      </ul>
      {verification.checks.length > 0 && (
        <p className="mt-2 text-xs text-muted">
          Verify:{" "}
          {verification.checks.map((check, i) => (
            <span key={check.code}>
              {i > 0 && " · "}
              <span className="tabular-nums text-ink">{check.code}</span> {check.condition}
            </span>
          ))}
        </p>
      )}
      <p className="mt-1 text-xs text-muted-2">{verification.note}</p>
      {notes.map((note) => (
        <p key={note} className="mt-1 text-xs text-muted-2">
          {note}
        </p>
      ))}
    </div>
  );
}

function ActivationAction({ lead }: { lead: CheckoutLead }) {
  if (lead.status === "cancellation_pending")
    return (
      <ActionPanel title="Cleanup">
        <form method="post" action="/api/admin/teardown/retry">
          <input type="hidden" name="leadId" value={lead.id} />
          <SubmitButton danger>Queue pending cleanup</SubmitButton>
        </form>
      </ActionPanel>
    );
  if (lead.status === "provisioned" || lead.status === "cancelled") return null;
  if (lead.status === "activating" || activationNeedsReconciliation(lead)) {
    return (
      <ActionPanel title="Blocked">
        <p className="text-sm text-[#8A5D17]">
          Activation may have left external resources. Reconcile Twilio and shop state before
          retrying.
        </p>
      </ActionPanel>
    );
  }
  if (!lead.setup || !ACTIVATABLE_LEAD_STATUSES.has(lead.status)) return null;
  const clientAreaCode = usAreaCode(lead.setup.forwardNumber || lead.basics.businessPhone);
  return (
    <ActionPanel title="Activation">
      <form method="post" action={`/api/admin/leads/${lead.id}/activate`} className="space-y-3">
        <label className="block text-xs">
          <span className="mb-1 block font-medium text-ink">Twilio area code</span>
          <input
            name="areaCodeOverride"
            inputMode="numeric"
            pattern="[2-9][0-9]{2}"
            maxLength={3}
            defaultValue={lead.activationAreaCodeOverride ?? ""}
            placeholder={clientAreaCode ?? "305"}
            className="w-full rounded-[10px] border border-black/10 bg-white px-3 py-2 text-sm tabular-nums text-ink outline-none focus:border-teal/50"
          />
          <span className="mt-1 block text-muted-2">
            Blank uses {clientAreaCode ?? "the client number"}. Override only with owner approval.
          </span>
        </label>
        <label className="flex items-start gap-2 text-xs text-muted">
          <input type="checkbox" required className="mt-0.5" />
          <span>I reviewed phone, area code, hours, services, staff and forwarding.</span>
        </label>
        <SubmitButton>
          {lead.status === "activation_failed"
            ? "Review and retry activation"
            : "Activate receptionist"}
        </SubmitButton>
        <Hint>Buys a Twilio number and emails the client once the shop is live.</Hint>
      </form>
    </ActionPanel>
  );
}

function CalendarInviteAction({ lead, shop }: { lead: CheckoutLead; shop?: Shop }) {
  if (!lead.shopId || isCalendarConnected(shop)) return null;
  if (lead.calendarEmailSentAt && lead.calendarAccessGrantedAt) {
    return (
      <ActionPanel title="Calendar">
        <p className="text-sm text-muted">
          Invite sent {fmtDate(lead.calendarEmailSentAt)} — not connected yet.
        </p>
      </ActionPanel>
    );
  }
  return (
    <ActionPanel title="Calendar">
      <form
        method="post"
        action={`/api/admin/leads/${lead.id}/calendar-email`}
        className="space-y-3"
      >
        <label className="flex items-start gap-2 text-xs text-muted">
          <input type="checkbox" name="accessConfirmed" value="yes" required className="mt-0.5" />
          <span>
            I added {lead.basics.email} as a Google test user or verified production access.
          </span>
        </label>
        <SubmitButton>Send calendar invite</SubmitButton>
      </form>
    </ActionPanel>
  );
}

export function LeadRow({
  lead,
  shop,
  defaultOpen,
}: { lead: CheckoutLead; shop?: Shop; defaultOpen?: boolean }) {
  const services = serviceRows(lead);
  const staff =
    lead.setup?.staff
      .filter((member) => member.name.trim())
      .map((member) => member.name.trim())
      .join(", ") || "none";

  return (
    <Row
      columns={LEAD_COLUMNS}
      defaultOpen={defaultOpen}
      summary={
        <>
          <div className="min-w-0">
            <div className="truncate font-medium text-ink">{lead.basics.businessName}</div>
            <div className="truncate text-xs text-muted-2">
              {lead.basics.vertical} · {normalizePlan(lead.plan)} / {lead.billing}
            </div>
          </div>
          <div className="hidden min-w-0 md:block">
            <div className="truncate text-sm text-ink">{lead.basics.ownerName}</div>
            <div className="truncate text-xs text-muted-2">{lead.basics.email}</div>
          </div>
          <div className="hidden truncate text-sm tabular-nums text-ink md:block">
            {lead.assignedNumber ?? <span className="text-muted-3">—</span>}
          </div>
          <div className="hidden truncate text-sm tabular-nums text-muted md:block">
            {lastEvent(lead)}
          </div>
          <div className="flex flex-wrap justify-end gap-1.5 md:justify-start">
            <Pill tone={LEAD_TONE[lead.status]}>{lead.status.replace(/_/g, " ")}</Pill>
            {shop?.status && shop.status !== "active" && <Pill tone="red">shop {shop.status}</Pill>}
          </div>
        </>
      }
    >
      {lead.provisionError && (
        <p className="mb-4 rounded-[10px] bg-[#B3261E]/10 px-3 py-2 text-sm text-[#B3261E]">
          Provisioning failed: {lead.provisionError}
        </p>
      )}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-5">
          <FieldGrid>
            <Field label="Owner">{lead.basics.ownerName}</Field>
            <Field label="Email">{lead.basics.email}</Field>
            <Field label="Mobile">
              <span className="tabular-nums">{lead.basics.ownerMobile}</span>
            </Field>
            <Field label="Business line">
              <span className="tabular-nums">{lead.basics.businessPhone}</span>
            </Field>
            <Field label="Address">{lead.basics.address?.trim() || "not provided"}</Field>
            <Field label="Timezone">{lead.basics.timezone}</Field>
            {lead.paidAt && <Field label="Paid">{fmtDate(lead.paidAt)}</Field>}
            {lead.provisionedAt && <Field label="Provisioned">{fmtDate(lead.provisionedAt)}</Field>}
            {shop && (
              <>
                <Field label="Calendar">
                  {shop.integration === "google_calendar" ? "Google Calendar ✓" : "not connected"}
                </Field>
                <Field label="Reminders">{shop.reminders_enabled ? "on (premium)" : "off"}</Field>
              </>
            )}
          </FieldGrid>

          {lead.setup && (
            <>
              <FieldGrid>
                <Field label="Staff">{staff}</Field>
                <Field label="Calendar request">
                  {lead.setup.calendar === "google_calendar" ? "Google Calendar" : "none"}
                </Field>
                <Field label="Notes">
                  <span className="whitespace-pre-wrap">{lead.setup.notes.trim() || "none"}</span>
                </Field>
              </FieldGrid>
              <div className="space-y-2">
                <Disclosure label="Hours" preview={hoursPreview(lead)}>
                  <HoursStrip lead={lead} />
                </Disclosure>
                <Disclosure label="Services" preview={servicesPreview(lead, services.length)}>
                  <ServicesTable rows={services} />
                </Disclosure>
                <Strip label="Forwarding">
                  <ForwardingBlock lead={lead} />
                </Strip>
              </div>
            </>
          )}
        </div>
        <div className="space-y-3">
          <ActivationAction lead={lead} />
          <CalendarInviteAction lead={lead} shop={shop} />
        </div>
      </div>
    </Row>
  );
}
