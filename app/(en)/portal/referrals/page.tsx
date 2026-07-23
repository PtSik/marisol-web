import { env } from "cloudflare:workers";
import { PortalHeading, PortalNotice } from "@/components/portal/PortalHeading";
import { CopyField } from "@/components/portal/ReferralLink";
import { type PortalEnv, findAccountByEmail } from "@/lib/portalApi";
import { type Referral, listReferrals, settleMatureReferrals } from "@/lib/referrals";
import { requirePortalSession } from "@/lib/session";
import { SALES_EMAIL_HREF, SITE_URL } from "@/lib/site";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<Referral["status"], string> = {
  pending: "Signed up — waiting for their first payment",
  qualified: "Paid — reward lands 30 days after their first invoice",
  crediting: "Paying out…",
  credited: "$200 credited to your account",
  payout_requested: "Cash payout requested",
  paid_out: "Paid out in cash",
  void: "Cancelled before the reward matured",
};

const EARNED: ReadonlySet<Referral["status"]> = new Set([
  "credited",
  "payout_requested",
  "paid_out",
]);
const IN_FLIGHT: ReadonlySet<Referral["status"]> = new Set(["pending", "qualified", "crediting"]);

function fmtDate(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-[16px] border border-ink/10 bg-cream-100 px-[18px] py-4">
      <p className="text-[11.5px] font-semibold uppercase tracking-[0.14em] text-muted-2">
        {label}
      </p>
      <p className="mt-1.5 text-[16px] font-medium">{value}</p>
      {hint && <p className="mt-0.5 text-[13px] leading-[1.45] text-muted-2">{hint}</p>}
    </div>
  );
}

const PAYOUT_NOTICE: Record<string, string> = {
  requested: "Cash payout requested — we'll email you once the transfer is on its way.",
  none: "Nothing to pay out in cash yet.",
  failed: "Couldn't file that request. Try again, or email us.",
};

export default async function PortalReferralsPage({
  searchParams,
}: {
  searchParams: Promise<{ payout?: string }>;
}) {
  const cfEnv = env as unknown as PortalEnv;
  const session = await requirePortalSession(cfEnv.RATE_LIMIT_KV);
  const { payout } = await searchParams;

  const account = await findAccountByEmail(cfEnv, session.email);
  await settleMatureReferrals(cfEnv);
  const referrals = account
    ? await listReferrals(cfEnv, { referrer: account.id })
    : ([] as Referral[]);

  const earnedCents = referrals
    .filter((r) => EARNED.has(r.status))
    .reduce((sum, r) => sum + r.amount_cents, 0);
  const creditedCents = referrals
    .filter((r) => r.status === "credited")
    .reduce((sum, r) => sum + r.amount_cents, 0);
  const inFlight = referrals.filter((r) => IN_FLIGHT.has(r.status)).length;
  const creditable = creditedCents > 0;

  return (
    <>
      <PortalHeading
        title={
          <>
            Refer a shop, earn <span className="text-teal">$200</span>.
          </>
        }
        lead="Send another owner your link. Once they've been a paying client for 30 days, you get $200 — as account credit, or as cash if you'd rather. Their first month is 10% off, too."
      />

      {payout && PAYOUT_NOTICE[payout] && (
        <PortalNotice tone={payout === "requested" ? "good" : "warn"}>
          {PAYOUT_NOTICE[payout]}
        </PortalNotice>
      )}

      {account ? (
        <>
          <div className="mt-7 rounded-[24px] bg-cream-100 p-[clamp(20px,4vw,34px)]">
            <p className="text-[11.5px] font-semibold uppercase tracking-[0.16em] text-muted-2">
              Your referral code
            </p>
            <CopyField value={account.referral_code} label="Copy code" big />
            <p className="mt-3 text-[13.5px] leading-[1.5] text-muted-2">
              Share the link below, or just give them this code — they enter it at checkout.
            </p>

            <p className="mt-6 text-[11.5px] font-semibold uppercase tracking-[0.16em] text-muted-2">
              Your referral link
            </p>
            <CopyField value={`${SITE_URL}/?ref=${account.referral_code}`} label="Copy link" />
            <p className="mt-3 text-[13.5px] leading-[1.5] text-muted-2">
              Their signup is tagged for 30 days after they open the link.
            </p>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Tile
              label="Earned"
              value={`$${earnedCents / 100}`}
              hint={creditable ? "Applied to your next invoice" : undefined}
            />
            <Tile
              label="In progress"
              value={String(inFlight)}
              hint={inFlight ? "Waiting on their first 30 paid days" : "No referrals yet"}
            />
          </div>

          {creditable && (
            <form method="post" action="/api/portal/referral-payout" className="mt-4">
              <button
                type="submit"
                className="inline-flex min-h-[50px] w-full items-center justify-center rounded-[13px] border border-ink/15 px-7 py-[14px] text-[15px] font-medium sm:w-auto"
              >
                Take ${creditedCents / 100} in cash instead
              </button>
              <p className="mt-2 text-[13px] leading-[1.5] text-muted-2">
                We'll wire it and remove the matching credit from your account.
              </p>
            </form>
          )}

          {referrals.length > 0 && (
            <ul className="mt-7 list-none space-y-2 p-0">
              {referrals.map((referral) => (
                <li
                  key={referral.id}
                  className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-[16px] border border-ink/10 px-[18px] py-3.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-medium">
                      {referral.referred_email ?? "A shop you referred"}
                    </p>
                    <p className="text-[13px] text-muted-2">{STATUS_LABEL[referral.status]}</p>
                  </div>
                  <span className="text-[13px] text-muted-2">
                    {fmtDate(referral.settled_at ?? referral.mature_at ?? referral.created_at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <PortalNotice tone="warn">
          We couldn't load your referral link.{" "}
          <a href={SALES_EMAIL_HREF} className="font-medium underline">
            Email us
          </a>{" "}
          and we'll sort it out.
        </PortalNotice>
      )}
    </>
  );
}
