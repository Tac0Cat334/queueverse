import type { Metadata } from "next";
import { LegalLayout } from "@/components/LegalLayout";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Disclaimer",
};

export default function DisclaimerPage() {
  return (
    <LegalLayout title="Disclaimer" description="Important information">
      <h2>Informational purposes only</h2>
      <p>
        {BRAND.name} is an independent informational platform. Wait times, ride
        status, and analytics displayed on this site are estimates and should not
        be relied upon as the sole basis for planning your visit.
      </p>

      <h2>Accuracy</h2>
      <p>
        Data is sourced from{" "}
        <a href="https://queue-times.com" target="_blank" rel="noopener noreferrer">
          Queue-Times.com
        </a>{" "}
        and updated periodically. Actual wait times may differ due to operational
        changes, ride closures, weather, or other factors. Historical analytics
        are statistical estimates, not guarantees.
      </p>

      <h2>No affiliation</h2>
      <p>{BRAND.disclaimer}</p>
      <p>
        All trademarks and ride names belong to their respective owners and are
        used descriptively to identify the subject of displayed data.
      </p>

      <h2>Limitation of liability</h2>
      <p>
        We are not responsible for any inconvenience, loss, or damage resulting
        from reliance on information displayed on this site. Always verify
        current conditions through official park channels.
      </p>
    </LegalLayout>
  );
}
