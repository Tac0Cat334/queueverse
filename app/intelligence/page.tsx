import { IntelligenceHub } from "@/components/intelligence/IntelligenceHub";
import { pageTitle } from "@/lib/brand";

export const metadata = {
  title: pageTitle("Ride Strategy"),
  description:
    "Real-time ride recommendations and touring plans for Epic Universe, powered by historical wait data.",
};

export default function IntelligencePage() {
  return <IntelligenceHub />;
}

export const dynamic = "force-dynamic";
