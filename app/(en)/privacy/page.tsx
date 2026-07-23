import { LegalShell } from "@/components/LegalShell";
import { SALES_EMAIL } from "@/lib/site";

export const metadata = {
  title: "Privacy Policy — Marisol",
  description: "How Marisol collects, uses and protects your data.",
};

export default function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy" updated="July 3, 2026">
      <p>
        This policy explains what data Kaijiro Labs ("Marisol", "we") collects when you use the
        Marisol website and the Marisol AI receptionist service, and how we handle it. Marisol is a
        Kaijiro Labs product.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Contact and business details</strong> you submit through our onboarding or contact
          forms: your name, email address, phone numbers, business name and setup details such as
          opening hours, services and staff names.
        </li>
        <li>
          <strong>Voice audio during the live demo.</strong> When you start the in-browser demo,
          your microphone audio is streamed to our conversational AI provider (ElevenLabs) for the
          duration of the session so the receptionist can respond. Demo sessions are time-limited.
        </li>
        <li>
          <strong>Payment information.</strong> Payments are processed by Stripe. We never see or
          store your card number — Stripe shares only your subscription status and billing contact
          with us.
        </li>
      </ul>

      <h2>How we use it</h2>
      <ul>
        <li>To set up and operate your AI receptionist.</li>
        <li>To respond to your enquiries and send service-related email.</li>
        <li>To bill your subscription and manage your account.</li>
      </ul>
      <p>We do not sell your data or use it for third-party advertising.</p>

      <h2>Service providers</h2>
      <p>We rely on a small number of processors to run the service:</p>
      <ul>
        <li>
          <strong>Stripe</strong> — payment processing and subscription billing.
        </li>
        <li>
          <strong>Cloudflare</strong> — website hosting and infrastructure.
        </li>
        <li>
          <strong>ElevenLabs</strong> — conversational AI voice processing.
        </li>
        <li>
          <strong>Resend</strong> — transactional email delivery.
        </li>
        <li>
          <strong>Twilio</strong> — telephony for the phone-based receptionist service.
        </li>
      </ul>

      <h2>Cookies and tracking</h2>
      <p>
        The website does not set advertising or cross-site tracking cookies. Your browser's storage
        is used only to keep onboarding form progress on your own device.
      </p>

      <h2>Data retention and your rights</h2>
      <p>
        We keep account and lead data for as long as needed to provide the service or to meet legal
        obligations. You can ask us at any time to access, correct or delete the data we hold about
        you — email{" "}
        <a href={`mailto:${SALES_EMAIL}`} className="text-teal">
          {SALES_EMAIL}
        </a>{" "}
        and we will respond promptly.
      </p>

      <h2>Changes</h2>
      <p>
        If this policy changes in a material way, we will update this page and revise the date at
        the top.
      </p>
    </LegalShell>
  );
}
