import { Suspense } from "react";
import { Dashboard, DashboardSkeleton } from "@/components/Dashboard";
import { fetchLiveQueueTimes, flattenRides } from "@/lib/queue-times";

async function DashboardContent() {
  const data = await fetchLiveQueueTimes();
  const rides = flattenRides(data);
  return <Dashboard initialRides={rides} />;
}

export default function HomePage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent />
    </Suspense>
  );
}

export const revalidate = 60;
