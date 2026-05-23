export interface QueueTimesRide {
  id: number;
  name: string;
  is_open: boolean;
  wait_time: number;
  last_updated: string;
}

export interface QueueTimesLand {
  id: number;
  name: string;
  rides: QueueTimesRide[];
}

export interface QueueTimesResponse {
  lands: QueueTimesLand[];
}

export interface Ride {
  id: string;
  ride_id: number;
  name: string;
  land: string;
  created_at?: string;
  updated_at?: string;
}

export interface WaitTimeRecord {
  id: string;
  ride_id: number;
  wait_time: number;
  is_open: boolean;
  timestamp: string;
}

export interface RideWithLiveData extends Ride {
  is_open: boolean;
  wait_time: number;
  last_updated: string;
}

export type SortOption = "highest" | "lowest" | "alphabetical" | "open";

export type TimeRange = "today" | "7d" | "30d";

export type WaitLevel = "low" | "medium" | "high" | "closed";

export interface ParkStats {
  averageWait: number;
  openRides: number;
  totalRides: number;
  longestWait: number;
  longestWaitRide: string;
  lowestWait: number;
  lowestWaitRide: string;
  lastUpdated: string | null;
}

export interface RideAnalytics {
  averageWaitToday: number;
  peakWaitToday: number;
  lowestAverageWait: number;
  bestTimeToRide: string;
  bestTimeAverageWait: number;
  averageWaitByHour: { hour: number; label: string; average: number; count: number }[];
  hourlyMinimum: { hour: number; label: string; average: number };
}

export interface RideInsight {
  bestTime: string | null;
  bestTimeAvg: number | null;
  trend: "up" | "down" | "flat";
}

export interface ChartDataPoint {
  timestamp: string;
  wait_time: number;
  label: string;
}
