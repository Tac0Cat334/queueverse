import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { RideDetail } from "@/components/RideDetail";
import { BRAND } from "@/lib/brand";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `Ride Wait Times`,
    description: `Live wait times and historical crowd analytics for ride ${id} at ${BRAND.parkName}, powered by ${BRAND.name}.`,
  };
}

export default async function RidePage({ params }: PageProps) {
  const { id } = await params;
  const rideId = Number(id);

  if (isNaN(rideId)) notFound();

  return <RideDetail rideId={rideId} />;
}

export const dynamic = "force-dynamic";
