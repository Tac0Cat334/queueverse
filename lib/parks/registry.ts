import type { ParkConfig, ParkId } from "./types";
import { EPIC_UNIVERSE_PARK } from "./epic-universe";

const PARKS: Record<ParkId, ParkConfig> = {
  [EPIC_UNIVERSE_PARK.id]: EPIC_UNIVERSE_PARK,
};

/** Default active park — swap when multi-park UI launches */
export function getDefaultPark(): ParkConfig {
  return EPIC_UNIVERSE_PARK;
}

export function getPark(parkId: ParkId): ParkConfig | null {
  return PARKS[parkId] ?? null;
}

export function listEnabledParks(): ParkConfig[] {
  return Object.values(PARKS).filter((p) => p.enabled);
}

export function getParkByQueueTimesId(queueTimesParkId: number): ParkConfig | null {
  return (
    Object.values(PARKS).find((p) => p.queueTimesParkId === queueTimesParkId) ??
    null
  );
}
