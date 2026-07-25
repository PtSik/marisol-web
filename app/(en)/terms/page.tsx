import { LegalShell } from "@/components/LegalShell";
import { TRIAL_DAYS } from "@/lib/plans";
import { SALES_EMAIL } from "@/lib/site";

export const metadata = {
  title: "Terms of Service — Marisol",
  description: "The terms that govern your Marisol subscription.",
};

export default function TermsPage() {
  return (
    <LegalShell title="Terms of Service" updated="July 25, 2026">
      <p>
        These terms govern your use of the Marisol AI receptionist service provided by Kaijiro Labs
        ("Marisol", "we"). By subscribing, you agree to them.
      </p>

      <h2>The service</h2>
      <p>
        Marisol answers your business phone line with a conversational AI receptionist that can take
        bookings, answer questions and hand off to a human when needed. We set the service up for
        you based on the details you provide during onboarding, and you stay responsible for keeping
        those details accurate.
      </p>

      <h2>Free trial</h2>
      <p>
        Every new subscription starts with a {TRIAL_DAYS}-day free trial. We collect your card at
        checkout but charge nothing until the trial ends. Cancel any time before then — through the
        billing portal or by emailing{" "}
        <a href={`mailto:${SALES_EMAIL}`} className="text-teal">
          {SALES_EMAIL}
        </a>{" "}
        — and you are never charged. If you do not cancel, the first payment is taken automatically
        on the day the trial ends and the subscription continues as normal.
      </p>

      <h2>Billing</h2>
      <p>
        Marisol is a subscription billed through Stripe, monthly or annually depending on the plan
        you choose at checkout. Prices are shown on the pricing page before you subscribe.
        Subscriptions renew automatically until cancelled. Payments already taken are not refunded;
        the free trial is there so you can decide before any money changes hands.
      </p>

      <h2>Fair use</h2>
      <p>
        Plans with unlimited answered calls are meant for the natural call volume of the business
        locations covered by your subscription. If sustained usage is far beyond what those
        locations plausibly generate — or calls are automated, bulk or artificial in nature — we
        will reach out to find a plan that fits before making any change. We never interrupt the
        service mid-month over volume.
      </p>

      <h2>Cancellation</h2>
      <p>
        You can cancel anytime through the Stripe customer portal — no notice period, no
        cancellation fee. Your receptionist stays active until the end of the period you have
        already paid for, and you keep your phone number.
      </p>

      <h2 id="referrals">Referral program</h2>
      <p>
        Every active client gets a personal referral code and link in the portal. If a new client
        signs up through your link or enters your code at checkout, their first month is 10% off and
        you earn a $200 reward once they have been a paying client for 30 days. The free trial does
        not count towards those 30 days — the clock starts at their first paid invoice.
      </p>
      <p>
        If the referred client cancels or is refunded before the 30 days are up, the reward is void.
        Once it becomes claimable it stays yours. You cannot refer yourself: a second salon on your
        own account is billed as an extra location, not a referral, and referrals we identify as
        self-referrals are voided.
      </p>
      <p>
        Rewards are paid in cash. You request the payout from the portal with a PayPal, Venmo or
        Zelle handle and we send it manually, normally within a few business days. There is no limit
        on how many shops you refer. We may change or end the program at any time; rewards that are
        already claimable when we do are still honoured.
      </p>

      <h2>Acceptable use</h2>
      <p>
        You may not use the service for unlawful purposes, to impersonate others deceptively, or to
        place or receive calls that violate telecommunication regulations applicable to your
        business.
      </p>

      <h2>Service quality and liability</h2>
      <p>
        The receptionist is an AI system: it is highly reliable but can occasionally mishear or
        misbook. We work continuously to keep accuracy high and provide escalation to a human for
        anything it cannot handle. To the maximum extent permitted by law, our liability for any
        claim related to the service is limited to the fees you paid in the three months before the
        claim arose.
      </p>

      <h2>Changes</h2>
      <p>
        We may update these terms as the service evolves. If a change is material, we will notify
        you by email before it takes effect.
      </p>
    </LegalShell>
  );
}
