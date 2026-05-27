export type RideOperationalStatus =
  | "open"
  | "closed"
  | "delayed"
  | "maintenance";

export interface QueueTimesRide {
  id: number;
  name: string;
  is_open: boolean;
  wait_time: number;
  last_updated: string;
  /** Present on some parks/API versions — parsed when available */
  status?: string;
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
  operationalStatus: RideOperationalStatus;
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
  /** null when the ride was closed at collection time */
  wait_time: number | null;
  label: string;
  is_open?: boolean;
  operational_status?: RideOperationalStatus;
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
  reasoning?: RecommendationReasoning;
}

export interface RecommendationReasoning {
  headline: string;
  bullets: string[];
  dataNote: string;
  baselineSource: RideIntelligence["baselineSource"];
}

export type PredictionConfidenceLevel = "low" | "moderate" | "high";

export interface WaitPredictionDetail {
  minutesAhead: number;
  direction: "rising" | "falling" | "stable";
  summary: string;
  estimatedWait: number | null;
  estimatedRange: { low: number; high: number } | null;
  confidenceScore: number;
  confidenceLevel: PredictionConfidenceLevel;
  confidenceLabel: string;
  factors: string[];
}

export interface RideHistoricalBaselineSummary {
  weekdayAverageAtHour: number | null;
  weekendAverageAtHour: number | null;
  bestTimeLabel: string | null;
  peakTimeLabel: string | null;
  volatilityScore: number;
  uniqueDays: number;
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
  opportunityTier: OpportunityTier;
  urgencyScore: number;
  urgencyLabel: string;
  urgencyReason: string;
  estimatedMinutesSavedVsTypical: number | null;
  recommendationType: RecommendationType;
  recommendationLabel: string;
  trend: TrendInfo;
  waitDrop: { amount: number; message: string } | null;
  predictedWait30: number | null;
  predictedWait60: number | null;
  prediction30: WaitPredictionDetail | null;
  prediction60: WaitPredictionDetail | null;
  reasoning: RecommendationReasoning;
  urgencyReasoning: RecommendationReasoning;
  baselines: RideHistoricalBaselineSummary | null;
  operationalPhase: OperationalPhase;
  waitInflation: WaitInflationMetric;
  earlyEntry: EarlyEntryContext;
  earlyEntryBaseline: number | null;
  earlyEntryVsAveragePercent: number | null;
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
  baselineSource: "5min" | "10min" | "15min" | "hour" | "weekday" | "recency" | null;
  learningNote: string | null;
}

export type OpportunityTierId = "excellent" | "good" | "fair" | "poor";

export interface OpportunityTier {
  tier: OpportunityTierId;
  label: string;
}

export type NextActionType = "ride_now" | "ride_soon" | "wait" | "monitor";

export interface NextBestAction {
  rideId: number;
  rideName: string;
  land: string;
  action: NextActionType;
  headline: string;
  reason: string;
  reasoning: RecommendationReasoning;
  opportunityScore: number;
  urgencyScore: number;
  currentWait: number;
  predictedWait60: number | null;
}

export type OperationalPhase =
  | "early_entry"
  | "rope_drop"
  | "morning_peak"
  | "midday_peak"
  | "evening_drop";

export interface WaitInflationMetric {
  score: number;
  peakDeltaMinutes: number;
  predictedDelta60: number;
  message: string;
  isHeadliner: boolean;
}

export interface EarlyEntryContext {
  active: boolean;
  eligible: boolean;
  windowLabel: string;
  generalAdmissionHour: number;
}

export type CrowdPhase =
  | "opening"
  | "building"
  | "peak"
  | "declining"
  | "closing";

export interface CrowdProgressionInsight {
  phase: CrowdPhase;
  label: string;
  message: string;
  parkAverageTrend: TrendDirection;
  averageWait: number;
  openRideCount: number;
}

export interface ParkStrategySnapshot {
  parkId: string;
  nextBestAction: NextBestAction | null;
  topOpportunities: RideRecommendation[];
  crowdProgression: CrowdProgressionInsight;
  optimizationIndex: number;
  strategistMessage: string;
}

export interface RerouteSuggestion {
  type: "prioritize" | "defer" | "alternative" | "closure";
  rideId: number;
  rideName: string;
  message: string;
  estimatedMinutesSaved: number;
  priority: "urgent" | "opportunity" | "warning";
  alternativeRideId?: number;
  alternativeRideName?: string;
  reasoning: RecommendationReasoning;
  confidenceScore: number;
  confidenceLabel: string;
}

export interface TimeSavedEstimate {
  optimizedWaitMinutes: number;
  baselineWaitMinutes: number;
  minutesSaved: number;
  percentSaved: number;
  baselineLabel: string;
  methodology: string;
  confidenceLabel: string;
}

export type AssistantIntent =
  | "what_next"
  | "ride_alternative"
  | "wait_or_ride"
  | "optimize_window"
  | "least_crowded_area"
  | "finish_before"
  | "general";

export interface AssistantQuery {
  intent: AssistantIntent;
  rideId?: number;
  rideName?: string;
  windowHours?: number;
  /** Park-local hour (0–23) for finish_before intent */
  deadlineHour?: number;
  message?: string;
}

export interface AssistantResponse {
  answer: string;
  suggestedRideIds: number[];
  confidence: number;
  confidenceLabel: string;
  supportingReasons: string[];
  reasoning: RecommendationReasoning;
}

export interface WeekdayCrowdInsight {
  dayOfWeek: number;
  label: string;
  averageWait: number;
  sampleDays: number;
  vsOverallPercent: number;
  crowdLevel: "lighter" | "typical" | "busier";
  message: string;
}

export type WeekdayPatternsByRide = Record<
  number,
  Record<number, { hour: number; label: string; average: number; count: number }[]>
>;

export interface ParkRecommendations {
  bestRightNow: RideRecommendation[];
  greatTimeToRide: RideRecommendation[];
  lowerThanNormal: RideRecommendation[];
  trendingUpFast: RideRecommendation[];
  expectedToRiseSoon: RideRecommendation[];
  byRideId: Record<number, RideIntelligence>;
  strategy: ParkStrategySnapshot;
  dataMaturity: DataMaturityMetrics;
  weekdayPatternsByRide: WeekdayPatternsByRide;
  parkWeekdayInsights: Record<number, WeekdayCrowdInsight>;
  generatedAt: string;
}

export interface IntelligencePayload {
  recommendations: ParkRecommendations;
  configured: boolean;
  parkId: string;
}

export type TouringPreference = "thrill" | "family" | "mixed";

export type TouringPlanMode = "live" | "fullday";

export interface TouringPlanPreferences {
  /** live = current waits & next few hours; fullday = historical best times across visit */
  planMode: TouringPlanMode;
  /** Hours ahead to optimize when planMode is live */
  liveWindowHours: number;
  /** ISO date YYYY-MM-DD for fullday mode — weekday patterns derived from this */
  visitDate: string;
  arrivalHour: number;
  departureHour: number;
  mustDoRideIds: number[];
  preference: TouringPreference;
  expressPass: boolean;
  lunchBreak: boolean;
  lunchHour?: number;
  /** Guest has Early Entry for this visit */
  earlyEntry: boolean;
}

export interface TouringPlan {
  items: TouringPlanItem[];
  preferences: TouringPlanPreferences;
  missedMustDo: number[];
  summary?: string;
  generatedAt: string;
  timeSaved?: TimeSavedEstimate;
  rerouteSuggestions?: RerouteSuggestion[];
  /** Plan was optimized with Early Entry strategy */
  earlyEntryOptimized?: boolean;
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
  /** Full-day mode: historically ideal time label */
  idealTime?: string;
}

export interface PlanAdjustment {
  rideId: number;
  rideName: string;
  message: string;
  priority: "urgent" | "opportunity" | "warning";
}
