import { LegalShell } from "@/components/LegalShell";
import { SALES_EMAIL } from "@/lib/site";

export const metadata = {
  title: "Privacy Policy — Marisol",
  description: "How Marisol collects, uses and protects your data.",
};

export default function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy" updated="September 26, 2026">
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

      <h2>Google Calendar data</h2>
      <p>
        If you connect Google Calendar, you sign in with Google and approve two permissions: seeing
        the list of your calendars, and viewing and editing events. We use them only to run bookings
        for your business:
      </p>
      <ul>
        <li>
          <strong>Your calendar list</strong> — to show you which calendars you can pick for
          bookings and for busy times.
        </li>
        <li>
          <strong>Events in the calendars you pick</strong> — their times, status, title and colour,
          so the receptionist never offers a time that is already taken and, if you use a shared
          calendar, can tell which staff member an event belongs to. The receptionist is told only
          which times are open, never what is in your calendar.
        </li>
        <li>
          <strong>Events we create</strong> — when a caller books, reschedules or cancels, we add,
          move or remove that appointment in your calendar. If you move or delete one of those
          appointments in Google Calendar, we update the booking to match.
        </li>
      </ul>
      <p>
        We store an encrypted Google refresh token, the IDs of the calendars you picked, and, for
        each booking, the ID of the event we created, in our database hosted by Supabase. The
        contents of your other events are read when they are needed to check availability and are
        not stored.
      </p>
      <p>
        You can revoke our access at any time from your Google Account at{" "}
        <a href="https://myaccount.google.com/permissions" className="text-teal">
          myaccount.google.com/permissions
        </a>
        , or ask us to disconnect your calendar by emailing{" "}
        <a href={`mailto:${SALES_EMAIL}`} className="text-teal">
          {SALES_EMAIL}
        </a>
        . The Calendar page of your Marisol portal lets you reconnect or change which calendars we
        use.
      </p>

      <h2>Limited Use</h2>
      <p>
        Marisol's use and transfer of information received from Google APIs adheres to the{" "}
        <a
          href="https://developers.google.com/terms/api-services-user-data-policy"
          className="text-teal"
        >
          Google API Services User Data Policy
        </a>
        , including the Limited Use requirements. Specifically:
      </p>
      <ul>
        <li>
          We use Google Calendar data only to provide and improve the booking features you can see
          in Marisol.
        </li>
        <li>We do not use it for advertising, including retargeting or interest-based ads.</li>
        <li>
          We do not sell it, and we do not transfer it to anyone except as needed to provide those
          features, to comply with the law, or as part of a merger or acquisition.
        </li>
        <li>
          We do not use it to develop, improve or train generalised AI or machine learning models.
        </li>
        <li>
          No person at Marisol reads it unless you give us permission for a specific event, it is
          needed for security purposes such as investigating abuse, it is required by law, or it has
          been aggregated and anonymised for internal operations.
        </li>
      </ul>

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
        <li>
          <strong>Supabase</strong> — database hosting for account, booking and call records.
        </li>
        <li>
          <strong>Google</strong> — Google Calendar, only if you choose to connect it.
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
