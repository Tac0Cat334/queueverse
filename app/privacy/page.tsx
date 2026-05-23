import type { Metadata } from "next";
import { LegalLayout } from "@/components/LegalLayout";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Privacy Policy",
};

export default function PrivacyPage() {
  return (
    <LegalLayout title="Privacy Policy" description="Last updated: May 2026">
      <p>
        {BRAND.name} (&quot;we,&quot; &quot;us&quot;) is an independent
        informational platform that displays live and historical theme park wait
        times. We do not require accounts, accept payments, or collect
        user-generated content.
      </p>

      <h2>Information we collect</h2>
      <p>
        We do not ask you to create an account or submit personal information to
        use this site. Our hosting provider may automatically collect standard
        server logs (such as IP address, browser type, and pages visited) for
        security and performance purposes.
      </p>

      <h2>Analytics</h2>
      <p>
        If analytics tools are enabled, they may use cookies or similar
        technologies to understand general usage patterns. Any such tools will be
        disclosed here and can be managed through your browser settings.
      </p>

      <h2>Third-party data</h2>
      <p>
        Wait time data is sourced from{" "}
        <a href="https://queue-times.com" target="_blank" rel="noopener noreferrer">
          Queue-Times.com
        </a>
        . We store historical wait time snapshots to power charts and analytics
        — this data relates to rides, not individual users.
      </p>

      <h2>Affiliation</h2>
      <p>{BRAND.disclaimer}</p>

      <h2>Your rights</h2>
      <p>
        Because we do not collect personal account data, there is typically no
        personal information to access or delete. Questions may be directed via
        our <a href="/contact">Contact page</a>.
      </p>

      <h2>Changes</h2>
      <p>
        We may update this policy from time to time. Continued use of the site
        after changes constitutes acceptance of the updated policy.
      </p>
    </LegalLayout>
  );
}
