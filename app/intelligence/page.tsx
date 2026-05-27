import { IntelligenceHub } from "@/components/intelligence/IntelligenceHub";
import { pageTitle } from "@/lib/brand";
import { loadIntelligenceContext } from "@/lib/intelligence-data";

export const metadata = {
  title: pageTitle("Ride Strategy"),
  description:
    "Real-time ride recommendations and touring plans for Epic Universe, powered by historical wait data.",
};

export default async function IntelligencePage() {
  const context = await loadIntelligenceContext();

  return (
    <IntelligenceHub
      initialRides={context.rides}
      initialRecommendations={context.recommendations}
      initialConfigured={context.configured}
    />
  );
}

export const dynamic = "force-dynamic";
