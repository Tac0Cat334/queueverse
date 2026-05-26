import type { WaitTimeRecord } from "@/types";
import { getParkParts } from "@/lib/park-time";
import type { ParkConfig } from "@/lib/parks/types";
import { getDefaultPark } from "@/lib/parks";

/** Crowd-phase segmentation across the operating day */
export type OperationalPhase =
  | "early_entry"
  | "rope_drop"
  | "morning_peak"
  | "midday_peak"
  | "evening_drop";

export interface EarlyEntryWindow {
  startHour: number;
  endHour: number;
  generalAdmissionHour: number;
  label: string;
}

export interface OperationalPhaseInfo {
  phase: OperationalPhase;
  label: string;
  message: string;
}

const PHASE_LABELS: Record<OperationalPhase, string> = {
  early_entry: "Early Entry",
  rope_drop: "General opening",
  morning_peak: "Morning peak",
  midday_peak: "Midday peak",
  evening_drop: "Evening cooldown",
};

export function getGeneralAdmissionHour(park: ParkConfig = getDefaultPark()): number {
  return park.earlyEntry?.generalAdmissionHour ?? 10;
}

export function getEarlyEntryWindow(
  park: ParkConfig = getDefaultPark()
): EarlyEntryWindow {
  const ga = getGeneralAdmissionHour(park);
  const duration = park.earlyEntry?.durationHours ?? 1;
  const startHour = ga - duration;
  return {
    startHour,
    endHour: ga,
    generalAdmissionHour: ga,
    label: `${startHour}:00–${ga}:00 Early Entry`,
  };
}

/** Hour is within the Early Entry window (hour >= start, hour < GA open) */
export function isEarlyEntryWindowHour(
  hour: number,
  park: ParkConfig = getDefaultPark()
): boolean {
  const { startHour, endHour } = getEarlyEntryWindow(park);
  return hour >= startHour && hour < endHour;
}

export function isEarlyEntryWindowMinutes(
  minutesSinceMidnight: number,
  park: ParkConfig = getDefaultPark()
): boolean {
  const hour = Math.floor(minutesSinceMidnight / 60) % 24;
  return isEarlyEntryWindowHour(hour, park);
}

/** Ministry is excluded from Early Entry eligibility */
export function isEarlyEntryEligibleRide(
  rideName: string,
  park: ParkConfig = getDefaultPark()
): boolean {
  const patterns = park.earlyEntry?.excludedRidePatterns ?? [
    "Battle at the Ministry",
  ];
  return !patterns.some((p) => rideName.includes(p));
}

export function isHeadlinerRide(
  rideName: string,
  park: ParkConfig = getDefaultPark()
): boolean {
  const patterns = park.earlyEntry?.headlinerRidePatterns ?? [
    "Mario Kart",
    "Monsters Unchained",
    "Stardust Racers",
    "Mine-Cart Madness",
  ];
  return patterns.some((p) => rideName.includes(p));
}

export function getOperationalPhase(
  hour: number,
  park: ParkConfig = getDefaultPark()
): OperationalPhaseInfo {
  const ga = getGeneralAdmissionHour(park);
  const { startHour } = getEarlyEntryWindow(park);

  if (hour >= startHour && hour < ga) {
    return {
      phase: "early_entry",
      label: PHASE_LABELS.early_entry,
      message: "Early Entry window — crowds differ from general admission",
    };
  }
  if (hour >= ga && hour < ga + 2) {
    return {
      phase: "rope_drop",
      label: PHASE_LABELS.rope_drop,
      message: "General opening rush — headliners spike quickly",
    };
  }
  if (hour >= ga + 2 && hour < 13) {
    return {
      phase: "morning_peak",
      label: PHASE_LABELS.morning_peak,
      message: "Morning crowds building across the park",
    };
  }
  if (hour >= 13 && hour < 17) {
    return {
      phase: "midday_peak",
      label: PHASE_LABELS.midday_peak,
      message: "Midday peak — longest typical waits",
    };
  }
  return {
    phase: "evening_drop",
    label: PHASE_LABELS.evening_drop,
    message: "Evening — selective rides ease",
  };
}

/** Snapshots collected during Early Entry hours only */
export function filterEarlyEntryRecords(
  records: WaitTimeRecord[],
  park: ParkConfig = getDefaultPark()
): WaitTimeRecord[] {
  const { startHour, endHour } = getEarlyEntryWindow(park);
  return records.filter((r) => {
    const hour = getParkParts(new Date(r.timestamp)).hour;
    return hour >= startHour && hour < endHour;
  });
}

/** Snapshots at or after general admission — excludes Early Entry hour */
export function filterGeneralAdmissionRecords(
  records: WaitTimeRecord[],
  park: ParkConfig = getDefaultPark()
): WaitTimeRecord[] {
  const ga = getGeneralAdmissionHour(park);
  return records.filter((r) => {
    const hour = getParkParts(new Date(r.timestamp)).hour;
    return hour >= ga;
  });
}

/** Pick baseline source records based on current operational phase */
export function selectBaselineRecords(
  records: WaitTimeRecord[],
  reference: Date,
  useEarlyEntryBaseline: boolean,
  park: ParkConfig = getDefaultPark()
): WaitTimeRecord[] {
  const hour = getParkParts(reference).hour;
  const inEE = isEarlyEntryWindowHour(hour, park);

  if (useEarlyEntryBaseline && inEE) {
    const ee = filterEarlyEntryRecords(records, park);
    return ee.length >= 4 ? ee : records;
  }

  if (inEE) {
    return records;
  }

  const ga = filterGeneralAdmissionRecords(records, park);
  return ga.length >= 4 ? ga : records;
}
