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

export type SortOption = "highest" | "lowest" | "alphabetical" | "open" | "favorites";

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
  peakTimeToRide: string;
  peakTimeAverageWait: number;
  averageWaitByHour: { hour: number; label: string; average: number; count: number }[];
  hourlyMinimum: { hour: number; label: string; average: number };
  weeklyPattern: { hour: number; label: string; average: number }[];
  reliabilityScore: number | null;
}

export type TrendDirection = "up" | "down" | "flat" | "rising_fast" | "falling_fast";

export interface TrendInfo {
  trend: TrendDirection;
  label: string;
  change: number;
}

export interface WaitDropAlert {
  rideId: number;
  rideName: string;
  amount: number;
  message: string;
}

export interface CrowdScore {
  score: number;
  level: "low" | "moderate" | "heavy";
  label: string;
}

export interface RideInsight {
  bestTime: string | null;
  bestTimeAvg: number | null;
  trend: TrendDirection;
  trendLabel: string;
  trendChange: number;
  waitDrop: { amount: number; message: string } | null;
  reliability: number | null;
}

export interface ChartDataPoint {
  timestamp: string;
  wait_time: number;
  label: string;
  historical_avg?: number;
}

export type RecommendationType =
  | "best_now"
  | "great_time"
  | "below_normal"
  | "unusually_low"
  | "trending_up"
  | "expected_rise"
  | "neutral";

export type RecommendationCategory =
  | "best_right_now"
  | "great_time"
  | "below_normal"
  | "trending_up"
  | "expected_rise";

export interface RideRecommendation {
  rideId: number;
  rideName: string;
  land: string;
  currentWait: number;
  opportunityScore: number;
  label: string;
  reason: string;
  category: RecommendationCategory;
  vsAveragePercent: number | null;
  trend: TrendInfo;
  confidenceScore: number;
  confidenceLabel: string;
}

export interface DataMaturityMetrics {
  maturityScore: number;
  maturityLevel: "learning" | "developing" | "reliable" | "expert";
  maturityLabel: string;
  totalSnapshots: number;
  uniqueDays: number;
  ridesWithData: number;
  totalRides: number;
  oldestSnapshot: string | null;
  newestSnapshot: string | null;
  daysToNextTier: number | null;
  nextTierLabel: string | null;
  message: string;
}

export interface RideIntelligence {
  rideId: number;
  rideName: string;
  land: string;
  currentWait: number;
  isOpen: boolean;
  historicalAverage: number | null;
  vsAveragePercent: number | null;
  comparisonMessage: string;
  opportunityScore: number;
  recommendationType: RecommendationType;
  recommendationLabel: string;
  trend: TrendInfo;
  waitDrop: { amount: number; message: string } | null;
  predictedWait30: number | null;
  predictedWait60: number | null;
  volatilityScore: number;
  reliabilityScore: number | null;
  downtimeFrequency: number;
  bestTimeToRide: string | null;
  bestTimeAverage: number | null;
  peakTimeToRide: string | null;
  peakTimeAverage: number | null;
  hourlyPattern: { hour: number; label: string; average: number; count: number }[];
  trendForecast: string;
  popularityPercentile: number;
  confidenceScore: number;
  confidenceLevel: "low" | "moderate" | "high";
  confidenceLabel: string;
  slotSampleCount: number;
  dataDays: number;
  baselineSource: "5min" | "10min" | "hour" | "weekday" | "recency" | null;
  learningNote: string | null;
}

export interface ParkRecommendations {
  bestRightNow: RideRecommendation[];
  greatTimeToRide: RideRecommendation[];
  lowerThanNormal: RideRecommendation[];
  trendingUpFast: RideRecommendation[];
  expectedToRiseSoon: RideRecommendation[];
  byRideId: Record<number, RideIntelligence>;
  dataMaturity: DataMaturityMetrics;
  generatedAt: string;
}

export interface IntelligencePayload {
  recommendations: ParkRecommendations;
  configured: boolean;
}

export type TouringPreference = "thrill" | "family" | "mixed";

export interface TouringPlanPreferences {
  arrivalHour: number;
  departureHour: number;
  mustDoRideIds: number[];
  preference: TouringPreference;
  expressPass: boolean;
  lunchBreak: boolean;
  lunchHour?: number;
}

export interface TouringPlanItem {
  time: string;
  timeMinutes: number;
  type: "ride" | "break" | "travel";
  rideId?: number;
  rideName?: string;
  land?: string;
  estimatedWait?: number;
  predictedWait?: number;
  vsAveragePercent?: number | null;
  label: string;
  reason: string;
  priority?: "high" | "normal" | "flexible";
  priorityLabel?: string;
  isOpen?: boolean;
  travelMinutes?: number;
}

export interface TouringPlan {
  items: TouringPlanItem[];
  preferences: TouringPlanPreferences;
  missedMustDo: number[];
  summary?: string;
  generatedAt: string;
}

export interface PlanAdjustment {
  rideId: number;
  rideName: string;
  message: string;
  priority: "urgent" | "opportunity" | "warning";
}
