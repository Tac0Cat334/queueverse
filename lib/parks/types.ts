/** Multi-park configuration — decouple analytics from a single park. */
export interface ParkChartHours {
  startHour: number;
  endHour: number;
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
  enabled: boolean;
}

export type ParkId = string;
