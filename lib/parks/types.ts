/** Multi-park configuration — decouple analytics from a single park. */
export interface ParkChartHours {
  startHour: number;
  endHour: number;
}

export interface EarlyEntryConfig {
  /** Clock hour general admission opens (e.g. 10 for 10 AM) */
  generalAdmissionHour: number;
  /** Hours before GA that Early Entry runs (default 1) */
  durationHours: number;
  /** Ride name substrings excluded from EE eligibility */
  excludedRidePatterns: readonly string[];
  /** High-demand rides that spike after general opening */
  headlinerRidePatterns: readonly string[];
}

export interface ParkLandConfig {
  name: string;
  /** Walk order index for routing (lower = closer to typical entry) */
  flowIndex: number;
}

export interface ParkConfig {
  id: string;
  queueTimesParkId: number;
  name: string;
  shortName: string;
  resort: string;
  timezone: string;
  chartHours: ParkChartHours;
  /** Ordered land names for walk-time / flow optimization */
  landOrder: readonly string[];
  earlyEntry?: EarlyEntryConfig;
  enabled: boolean;
}

export type ParkId = string;
