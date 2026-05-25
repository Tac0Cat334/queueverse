import { Suspense } from "react";
import { Dashboard, DashboardSkeleton } from "@/components/Dashboard";
import { fetchLiveQueueTimes, flattenRides, stampFetchTime } from "@/lib/queue-times";

async function DashboardContent() {
  const fetchedAt = new Date().toISOString();
  const data = await fetchLiveQueueTimes({ noStore: true });
  const rides = stampFetchTime(flattenRides(data), fetchedAt);
  return <Dashboard initialRides={rides} />;
}

export default function HomePage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent />
    </Suspense>
  );
}

export const dynamic = "force-dynamic";
