import {
  ActionPanel,
  Field,
  FieldGrid,
  Hint,
  Pill,
  Row,
  SubmitButton,
  type Tone,
  fmtDate,
} from "@/components/admin/ui";
import type { CallLead } from "@/lib/leads";
import { PAYOUT_LABEL, isPayoutMethod } from "@/lib/payout";
import type { Referral } from "@/lib/referrals";

const REFERRAL_TONE: Record<Referral["status"], Tone> = {
  pending: "muted",
  qualified: "amber",
  claimable: "teal",
  payout_requested: "amber",
  paid_out: "teal",
  void: "red",
};

function payoutLabel(method?: string | null): string {
  return isPayoutMethod(method) ? PAYOUT_LABEL[method] : (method ?? "cash");
}

export const REFERRAL_COLUMNS =
  "grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[minmax(0,5rem)_minmax(0,2fr)_minmax(0,2fr)_minmax(0,9rem)]";

export function ReferralColumnHeaders() {
  return (
    <>
      <span>Amount</span>
      <span>Referrer</span>
      <span>Referred</span>
      <span>Status</span>
    </>
  );
}

export function ReferralRow({ referral }: { referral: Referral }) {
  const owed = referral.status === "payout_requested";
  return (
    <Row
      columns={REFERRAL_COLUMNS}
      defaultOpen={owed}
      summary={
        <>
          <div className="font-medium tabular-nums text-ink">${referral.amount_cents / 100}</div>
          <div className="hidden min-w-0 truncate text-sm text-muted md:block">
            {referral.referrer?.email ?? referral.referrer_account_id}
          </div>
          <div className="hidden min-w-0 truncate text-sm text-muted md:block">
            {referral.referred_email ?? referral.referred_lead_id}
          </div>
          <div className="flex justify-end md:justify-start">
            <Pill tone={REFERRAL_TONE[referral.status]}>{referral.status.replace(/_/g, " ")}</Pill>
          </div>
        </>
      }
    >
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <FieldGrid>
          <Field label="Referrer">{referral.referrer?.email ?? referral.referrer_account_id}</Field>
          <Field label="Referred">{referral.referred_email ?? referral.referred_lead_id}</Field>
          {referral.mature_at && <Field label="Matures">{fmtDate(referral.mature_at)}</Field>}
          {referral.payout_ref && <Field label="Payout ref">{referral.payout_ref}</Field>}
        </FieldGrid>
        {owed && (
          <ActionPanel title="Payout">
            <p className="text-sm">
              Send <span className="font-medium tabular-nums">${referral.amount_cents / 100}</span>{" "}
              via {payoutLabel(referral.payout_method ?? referral.referrer?.payout_method)} —{" "}
              {referral.referrer?.payout_handle ?? "no handle on file"}
            </p>
            <form method="post" action={`/api/admin/referrals/${referral.id}/payout`}>
              <SubmitButton>Mark paid out</SubmitButton>
            </form>
            <Hint>Send the cash first.</Hint>
          </ActionPanel>
        )}
      </div>
    </Row>
  );
}

export const CALL_COLUMNS =
  "grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)_minmax(0,2fr)_minmax(0,8rem)]";

export function CallColumnHeaders() {
  return (
    <>
      <span>Name</span>
      <span>Phone</span>
      <span>Email</span>
      <span>Received</span>
    </>
  );
}

export function CallRow({ lead }: { lead: CallLead }) {
  return (
    <Row
      columns={CALL_COLUMNS}
      summary={
        <>
          <div className="truncate font-medium text-ink">{lead.call.name}</div>
          <div className="hidden truncate text-sm tabular-nums text-muted md:block">
            {lead.call.phone}
          </div>
          <div className="hidden truncate text-sm text-muted md:block">{lead.call.email}</div>
          <div className="hidden text-sm tabular-nums text-muted md:block">
            {fmtDate(lead.createdAt)}
          </div>
        </>
      }
    >
      <FieldGrid>
        <Field label="Phone">
          <span className="tabular-nums">{lead.call.phone}</span>
        </Field>
        <Field label="Email">{lead.call.email}</Field>
        {lead.call.preferredTime && <Field label="Preferred time">{lead.call.preferredTime}</Field>}
        <Field label="Received">{fmtDate(lead.createdAt)}</Field>
        {lead.call.question && (
          <Field label="Question" wide>
            <span className="whitespace-pre-wrap">{lead.call.question}</span>
          </Field>
        )}
      </FieldGrid>
    </Row>
  );
}

export interface TeardownJob {
  id: string;
  status: string;
  attempts: number;
  last_error?: string | null;
}

export const TEARDOWN_COLUMNS =
  "grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[minmax(0,3fr)_minmax(0,1fr)_minmax(0,8rem)]";

export function TeardownColumnHeaders() {
  return (
    <>
      <span>Job</span>
      <span>Attempts</span>
      <span>Status</span>
    </>
  );
}

export function TeardownRow({ job }: { job: TeardownJob }) {
  return (
    <Row
      columns={TEARDOWN_COLUMNS}
      defaultOpen
      summary={
        <>
          <div className="truncate font-medium text-ink">{job.id}</div>
          <div className="hidden text-sm tabular-nums text-muted md:block">{job.attempts}</div>
          <div className="flex justify-end md:justify-start">
            <Pill tone={job.status === "running" ? "amber" : "red"}>{job.status}</Pill>
          </div>
        </>
      }
    >
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <FieldGrid>
          <Field label="Attempts">{job.attempts}</Field>
          {job.last_error && (
            <Field label="Last error" wide>
              <span role="alert" className="text-[#B3261E]">
                {job.last_error}
              </span>
            </Field>
          )}
        </FieldGrid>
        <ActionPanel title="Cleanup">
          <form method="post" action="/api/admin/teardown/retry">
            <input type="hidden" name="id" value={job.id} />
            <SubmitButton danger disabled={job.status === "running"}>
              Retry cleanup
            </SubmitButton>
          </form>
          {job.status === "running" && (
            <Hint>
              Cleanup is running. Interrupted attempts are recovered automatically after 10 minutes.
            </Hint>
          )}
          {job.status === "blocked" && (
            <>
              <Hint>
                Automatic retries are paused. Investigate the error before retrying or recording
                manual resolution.
              </Hint>
              <form method="post" action="/api/admin/teardown/retry" className="space-y-3">
                <input type="hidden" name="id" value={job.id} />
                <input type="hidden" name="action" value="resolve" />
                <label className="block text-xs">
                  <span className="mb-1 block font-medium text-ink">Resolution note</span>
                  <textarea
                    name="note"
                    required
                    rows={3}
                    className="w-full rounded-[10px] border border-black/10 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-teal/50"
                  />
                </label>
                <label className="flex items-start gap-2 text-xs text-muted">
                  <input type="checkbox" name="confirmed" value="yes" required className="mt-0.5" />
                  <span>
                    I verified cleanup manually or confirmed that no resources require cleanup.
                  </span>
                </label>
                <SubmitButton>Record manual resolution</SubmitButton>
              </form>
            </>
          )}
        </ActionPanel>
      </div>
    </Row>
  );
}
