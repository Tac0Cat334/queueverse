import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { RideDetail } from "@/components/RideDetail";
import { fetchLiveQueueTimes, flattenRides } from "@/lib/queue-times";
import { BRAND } from "@/lib/brand";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  try {
    const data = await fetchLiveQueueTimes();
    const rides = flattenRides(data);
    const ride = rides.find((r) => r.ride_id === Number(id));
    if (!ride) return { title: "Ride Not Found" };
    return {
      title: `${ride.name} Wait Times`,
      description: `Live wait times and historical crowd analytics for ${ride.name} at ${BRAND.parkName}, powered by ${BRAND.name}.`,
    };
  } catch {
    return { title: "Ride Details" };
  }
}

export default async function RidePage({ params }: PageProps) {
  const { id } = await params;
  const rideId = Number(id);

  if (isNaN(rideId)) notFound();

  let ride;
  try {
    const data = await fetchLiveQueueTimes();
    const rides = flattenRides(data);
    ride = rides.find((r) => r.ride_id === rideId);
  } catch {
    notFound();
  }

  if (!ride) notFound();

  return (
    <RideDetail
      ride={ride}
      initialFetchedAt={new Date().toISOString()}
    />
  );
}

export const revalidate = 60;
