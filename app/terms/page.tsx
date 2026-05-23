import type { Metadata } from "next";
import { LegalLayout } from "@/components/LegalLayout";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Terms of Service",
};

export default function TermsPage() {
  return (
    <LegalLayout title="Terms of Service" description="Last updated: May 2026">
      <p>
        By accessing {BRAND.name}, you agree to these Terms of Service. If you
        do not agree, please do not use the site.
      </p>

      <h2>Service description</h2>
      <p>
        {BRAND.name} provides live and historical wait time information for
        theme park rides. The service is provided free of charge for
        informational purposes only.
      </p>

      <h2>No affiliation</h2>
      <p>{BRAND.disclaimer}</p>

      <h2>Third-party data</h2>
      <p>
        Wait time data is provided by{" "}
        <a href="https://queue-times.com" target="_blank" rel="noopener noreferrer">
          Queue-Times.com
        </a>
        . We do not control the accuracy, completeness, or timeliness of
        third-party data sources.
      </p>

      <h2>Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Use the site for any unlawful purpose</li>
        <li>Attempt to disrupt, scrape, or overload our servers</li>
        <li>Reproduce or redistribute data in bulk without permission</li>
      </ul>

      <h2>Disclaimer of warranties</h2>
      <p>
        The site is provided &quot;as is&quot; without warranties of any kind.
        We do not guarantee uninterrupted access or error-free operation.
      </p>

      <h2>Limitation of liability</h2>
      <p>
        To the fullest extent permitted by law, we shall not be liable for any
        indirect, incidental, or consequential damages arising from your use of
        this site, including decisions made based on displayed wait times.
      </p>

      <h2>Changes</h2>
      <p>
        We may modify these terms at any time. Continued use constitutes
        acceptance of updated terms.
      </p>
    </LegalLayout>
  );
}
