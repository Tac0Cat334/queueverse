import { Suspense } from "react";
import { IntelligenceHub } from "@/components/intelligence/IntelligenceHub";
import { fetchLiveQueueTimes, flattenRides, stampFetchTime } from "@/lib/queue-times";
import { pageTitle } from "@/lib/brand";

export const metadata = {
  title: pageTitle("Ride Strategy"),
  description:
    "Real-time ride recommendations and touring plans for Epic Universe, powered by historical wait data.",
};

async function IntelligenceContent() {
  const fetchedAt = new Date().toISOString();
  const data = await fetchLiveQueueTimes({ noStore: true });
  const rides = stampFetchTime(flattenRides(data), fetchedAt);
  return <IntelligenceHub initialRides={rides} />;
}

function IntelligenceSkeleton() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="skeleton h-4 w-24" />
      <div className="mt-8 skeleton h-10 w-64" />
      <div className="mt-3 skeleton h-5 w-96 max-w-full" />
      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton h-20 rounded-2xl" />
        ))}
      </div>
      <div className="mt-10 space-y-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="skeleton h-40 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

export default function IntelligencePage() {
  return (
    <Suspense fallback={<IntelligenceSkeleton />}>
      <IntelligenceContent />
    </Suspense>
  );
}

export const dynamic = "force-dynamic";
