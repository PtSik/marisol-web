import { LegalShell } from "@/components/LegalShell";
import { SALES_EMAIL } from "@/lib/site";

export const metadata = {
  title: "Terms of Service — Kaijiro",
  description: "The terms that govern your Kaijiro subscription.",
};

export default function TermsPage() {
  return (
    <LegalShell title="Terms of Service" updated="July 3, 2026">
      <p>
        These terms govern your use of the Kaijiro AI receptionist service provided by Kaijiro-labs
        ("Kaijiro", "we"). By subscribing, you agree to them.
      </p>

      <h2>The service</h2>
      <p>
        Kaijiro answers your business phone line with a conversational AI receptionist that can take
        bookings, answer questions and hand off to a human when needed. We set the service up for
        you based on the details you provide during onboarding, and you stay responsible for keeping
        those details accurate.
      </p>

      <h2>Billing</h2>
      <p>
        Kaijiro is a subscription billed through Stripe, monthly or annually depending on the plan
        you choose at checkout. Prices are shown on the pricing page before you pay. Subscriptions
        renew automatically until cancelled.
      </p>

      <h2>14-day money-back guarantee</h2>
      <p>
        If Kaijiro is not right for you, tell us within 14 days of your first payment and we will
        refund it in full — no questions asked. Email{" "}
        <a href={`mailto:${SALES_EMAIL}`} className="text-teal">
          {SALES_EMAIL}
        </a>{" "}
        from the address you signed up with.
      </p>

      <h2>Cancellation</h2>
      <p>
        You can cancel anytime through the Stripe customer portal — no notice period, no
        cancellation fee. Your receptionist stays active until the end of the period you have
        already paid for, and you keep your phone number.
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
