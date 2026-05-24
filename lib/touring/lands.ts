/**
 * Epic Universe land flow order (entry → west).
 * Used for travel-time estimation between lands.
 */
export const LAND_ORDER = [
  "Celestial Park",
  "Dark Universe",
  "How to Train Your Dragon - Isle of Berk",
  "SUPER NINTENDO WORLD",
  "The Wizarding World of Harry Potter - Ministry of Magic",
] as const;

export type ParkLand = (typeof LAND_ORDER)[number];

const LAND_INDEX = new Map<string, number>(
  LAND_ORDER.map((land, index) => [land, index])
);

/** Approximate walk time in minutes between two lands */
export function getLandTravelMinutes(fromLand: string | null, toLand: string): number {
  if (!fromLand || fromLand === toLand) return 0;

  const fromIdx = LAND_INDEX.get(fromLand);
  const toIdx = LAND_INDEX.get(toLand);

  if (fromIdx === undefined || toIdx === undefined) return 12;

  const steps = Math.abs(toIdx - fromIdx);
  // Base 5 min + 6 min per land boundary crossed
  return 5 + steps * 6;
}

/** Penalty score subtracted from ride scheduling score for inefficient land jumps */
export function getLandFlowPenalty(
  fromLand: string | null,
  toLand: string
): number {
  if (!fromLand || fromLand === toLand) return 0;

  const fromIdx = LAND_INDEX.get(fromLand);
  const toIdx = LAND_INDEX.get(toLand);

  if (fromIdx === undefined || toIdx === undefined) return 8;

  const steps = Math.abs(toIdx - fromIdx);
  // Backtracking (moving opposite to natural flow) costs more
  const isBacktrack =
    fromIdx !== undefined &&
    toIdx !== undefined &&
    toIdx < fromIdx;
  return steps * (isBacktrack ? 14 : 7);
}

export function groupRidesByLand<T extends { land: string; name: string }>(
  rides: T[]
): { land: string; rides: T[] }[] {
  const groups = new Map<string, T[]>();

  for (const ride of rides) {
    const list = groups.get(ride.land) ?? [];
    list.push(ride);
    groups.set(ride.land, list);
  }

  const ordered: { land: string; rides: T[] }[] = [];

  for (const land of LAND_ORDER) {
    const landRides = groups.get(land);
    if (landRides?.length) {
      ordered.push({
        land,
        rides: landRides.sort((a, b) => a.name.localeCompare(b.name)),
      });
    }
    groups.delete(land);
  }

  // Any unknown lands at the end
  for (const [land, landRides] of groups.entries()) {
    ordered.push({
      land,
      rides: landRides.sort((a, b) => a.name.localeCompare(b.name)),
    });
  }

  return ordered;
}

export function sortLandNames(lands: string[]): string[] {
  return [...lands].sort((a, b) => {
    const ai = LAND_INDEX.get(a) ?? 999;
    const bi = LAND_INDEX.get(b) ?? 999;
    return ai - bi;
  });
}
