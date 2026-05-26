import type {
  AssistantQuery,
  AssistantResponse,
  ParkRecommendations,
  RideIntelligence,
  RideWithLiveData,
  TouringPlan,
  RecommendationReasoning,
} from "@/types";
import { generateRerouteSuggestions } from "../rerouting";
import { getLandTravelMinutes } from "@/lib/touring/lands";
import { getParkParts } from "@/lib/park-time";
import {
  getEarlyEntryWindow,
  isEarlyEntryWindowHour,
} from "@/lib/analytics/operational-phases";
import { getDefaultPark } from "@/lib/parks";

export type { AssistantQuery, AssistantResponse };

export interface AssistantContext {
  rides: RideWithLiveData[];
  recommendations: ParkRecommendations;
  plan?: TouringPlan | null;
}

function confidenceFromIntel(intel?: RideIntelligence): {
  score: number;
  label: string;
} {
  if (!intel) return { score: 40, label: "Medium confidence" };
  return {
    score: intel.confidenceScore,
    label: intel.confidenceLabel,
  };
}

function buildResponse(
  answer: string,
  suggestedRideIds: number[],
  reasoning: RecommendationReasoning,
  intel?: RideIntelligence
): AssistantResponse {
  const conf = confidenceFromIntel(intel);
  return {
    answer,
    suggestedRideIds,
    confidence: conf.score,
    confidenceLabel: conf.label,
    supportingReasons: reasoning.bullets,
    reasoning,
  };
}

function isEarlyEntryContext(
  byRide: Record<number, RideIntelligence>,
  plan?: TouringPlan | null
): boolean {
  if (plan?.earlyEntryOptimized || plan?.preferences.earlyEntry) return true;
  const hour = getParkParts(new Date()).hour;
  if (!isEarlyEntryWindowHour(hour, getDefaultPark())) return false;
  return Object.values(byRide).some((i) => i.earlyEntry.active);
}

function earlyEntryPrefix(
  byRide: Record<number, RideIntelligence>,
  plan?: TouringPlan | null
): string {
  if (!isEarlyEntryContext(byRide, plan)) return "";
  const window = getEarlyEntryWindow(getDefaultPark()).label;
  return `Since you have Early Entry (${window}), prioritize headliners before general crowds enter. `;
}

function effectiveVsAverage(intel: RideIntelligence): number | null {
  if (intel.earlyEntry.active && intel.earlyEntryVsAveragePercent != null) {
    return intel.earlyEntryVsAveragePercent;
  }
  return intel.vsAveragePercent;
}

/** Rule-based strategist — structured for future LLM narration layer */
export function answerAssistantQuery(
  query: AssistantQuery,
  context: AssistantContext
): AssistantResponse {
  const { rides, recommendations, plan } = context;
  const byRide = recommendations.byRideId;
  const strategy = recommendations.strategy;

  switch (query.intent) {
    case "what_next":
      return answerWhatNext(strategy, byRide, plan);
    case "ride_alternative":
      return answerAlternative(query, rides, byRide, plan);
    case "wait_or_ride":
      return answerWaitOrRide(query, byRide, plan);
    case "optimize_window":
      return answerOptimizeWindow(query, rides, byRide, plan);
    case "least_crowded_area":
      return answerLeastCrowded(rides, byRide);
    case "finish_before":
      return answerFinishBefore(query, rides, byRide, plan);
    default:
      return buildResponse(
        strategy?.strategistMessage ??
          "Check the strategist panel for live recommendations.",
        strategy?.nextBestAction ? [strategy.nextBestAction.rideId] : [],
        strategy?.nextBestAction?.reasoning ?? {
          headline: "Park overview",
          bullets: [],
          dataNote: "Based on live waits and historical patterns",
          baselineSource: null,
        }
      );
  }
}

function answerWhatNext(
  strategy: ParkRecommendations["strategy"],
  byRide: Record<number, RideIntelligence>,
  plan?: TouringPlan | null
): AssistantResponse {
  const next = strategy?.nextBestAction;
  if (!next) {
    return buildResponse(
      "Not enough historical data for a strong recommendation yet — check back as snapshots accumulate.",
      [],
      {
        headline: "Still learning",
        bullets: ["Recommendations improve with each 5-minute snapshot collected"],
        dataNote: recommendationsDataNote(),
        baselineSource: null,
      }
    );
  }

  const intel = byRide[next.rideId];
  const bullets = [
    ...next.reasoning.bullets,
    next.predictedWait60
      ? `~${next.predictedWait60}m predicted in an hour`
      : "",
  ].filter(Boolean);

  return buildResponse(
    `${earlyEntryPrefix(byRide, plan)}${next.headline}. Current wait: ${next.currentWait}m.`,
    [next.rideId],
    {
      headline: next.reasoning.headline,
      bullets,
      dataNote: intel?.reasoning.dataNote ?? "Live + historical analysis",
      baselineSource: intel?.baselineSource ?? null,
    },
    intel
  );
}

function recommendationsDataNote(): string {
  return "Based on live waits and historical slot averages";
}

function answerAlternative(
  query: AssistantQuery,
  rides: RideWithLiveData[],
  byRide: Record<number, RideIntelligence>,
  plan?: TouringPlan | null
): AssistantResponse {
  const target = findRide(query, rides);
  if (!target) {
    return buildResponse(
      "I couldn't identify that ride — try selecting it from the ride list.",
      [],
      {
        headline: "Ride not found",
        bullets: [],
        dataNote: "",
        baselineSource: null,
      }
    );
  }

  const targetIntel = byRide[target.ride_id];

  if (plan) {
    const reroutes = generateRerouteSuggestions(plan, rides, byRide);
    const alt = reroutes.find((r) => r.rideId === target.ride_id);
    if (alt?.alternativeRideId) {
      return buildResponse(
        alt.message,
        [alt.alternativeRideId],
        alt.reasoning,
        byRide[alt.alternativeRideId]
      );
    }
  }

  const alternatives = rides
    .filter(
      (r) =>
        r.is_open &&
        r.ride_id !== target.ride_id &&
        (r.land === target.land ||
          getLandTravelMinutes(target.land, r.land) <= 8)
    )
    .sort(
      (a, b) =>
        (byRide[b.ride_id]?.opportunityScore ?? 0) -
        (byRide[a.ride_id]?.opportunityScore ?? 0)
    );

  const best = alternatives[0];
  if (!best) {
    return buildResponse(
      `No strong open alternative near ${target.land}. Check other lands for opportunities.`,
      [],
      {
        headline: "No nearby alternative",
        bullets: [`${target.name} is in ${target.land}`],
        dataNote: "Filtered by land proximity and opportunity score",
        baselineSource: null,
      },
      targetIntel
    );
  }

  const bestIntel = byRide[best.ride_id];
  return buildResponse(
    `Try ${best.name} (${best.wait_time}m) in ${best.land}${bestIntel?.vsAveragePercent && bestIntel.vsAveragePercent >= 10 ? ` — ${bestIntel.vsAveragePercent}% below typical` : ""}.`,
    [best.ride_id],
    bestIntel?.reasoning ?? {
      headline: "Best nearby alternative",
      bullets: [`${best.wait_time}m current wait`],
      dataNote: "Ranked by opportunity score and walking distance",
      baselineSource: bestIntel?.baselineSource ?? null,
    },
    bestIntel
  );
}

function answerWaitOrRide(
  query: AssistantQuery,
  byRide: Record<number, RideIntelligence>,
  plan?: TouringPlan | null
): AssistantResponse {
  const intel = query.rideId ? byRide[query.rideId] : undefined;
  if (!intel) {
    return buildResponse(
      "Select a ride to compare ride-now vs wait-later tradeoffs.",
      [],
      {
        headline: "No ride selected",
        bullets: [],
        dataNote: "",
        baselineSource: null,
      }
    );
  }

  const rise = (intel.predictedWait60 ?? intel.currentWait) - intel.currentWait;
  const vsAvg = effectiveVsAverage(intel);

  if (
    intel.earlyEntry.active &&
    intel.waitInflation.isHeadliner &&
    intel.waitInflation.score >= 40
  ) {
    return buildResponse(
      `${earlyEntryPrefix(byRide, plan)}Ride ${intel.rideName} now — ${intel.waitInflation.message}.`,
      [intel.rideId],
      {
        headline: "Best opening-hour opportunity",
        bullets: [
          ...intel.reasoning.bullets,
          intel.waitInflation.message,
        ].filter(Boolean),
        dataNote: intel.reasoning.dataNote,
        baselineSource: intel.baselineSource,
      },
      intel
    );
  }

  if (rise >= 15 && intel.prediction60?.confidenceLevel !== "low") {
    return buildResponse(
      `Ride ${intel.rideName} now — ${intel.prediction60?.summary ?? `expected ~${intel.predictedWait60}m in an hour`}.`,
      [intel.rideId],
      {
        headline: "Ride now before the spike",
        bullets: [
          ...intel.urgencyReasoning.bullets,
          intel.prediction60?.confidenceLabel ?? "",
        ].filter(Boolean),
        dataNote: intel.reasoning.dataNote,
        baselineSource: intel.baselineSource,
      },
      intel
    );
  }

  if (vsAvg !== null && vsAvg < -12) {
    return buildResponse(
      `${intel.rideName} is ${Math.abs(vsAvg)}% above ${intel.earlyEntry.active ? "Early Entry" : "typical"} now. ${intel.bestTimeToRide ? `Historically better around ${intel.bestTimeToRide}.` : "Consider waiting for a lower window."}`,
      [],
      {
        headline: "Wait for a better window",
        bullets: intel.reasoning.bullets,
        dataNote: intel.reasoning.dataNote,
        baselineSource: intel.baselineSource,
      },
      intel
    );
  }

  return buildResponse(
    `${intel.rideName} is reasonable now (${intel.currentWait}m). ${intel.trendForecast}`,
    [intel.rideId],
    intel.reasoning,
    intel
  );
}

function answerOptimizeWindow(
  query: AssistantQuery,
  rides: RideWithLiveData[],
  byRide: Record<number, RideIntelligence>,
  plan?: TouringPlan | null
): AssistantResponse {
  const hours = query.windowHours ?? 2;
  const eeMode = isEarlyEntryContext(byRide, plan);
  const ranked = rides
    .filter((r) => r.is_open)
    .map((r) => {
      const intel = byRide[r.ride_id];
      const inflationBoost =
        eeMode && intel?.earlyEntry.eligible
          ? (intel.waitInflation.score ?? 0) * 0.35
          : 0;
      return {
        ride: r,
        intel,
        score:
          (intel?.opportunityScore ?? 0) * 0.55 +
          (intel?.urgencyScore ?? 0) * 0.45 +
          inflationBoost,
      };
    })
    .filter((r) => r.intel?.confidenceLevel !== "low")
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);

  if (!ranked.length) {
    return buildResponse(
      "Limited data for optimization — recommendations will sharpen as more snapshots are collected.",
      [],
      {
        headline: "Building intelligence",
        bullets: [],
        dataNote: "",
        baselineSource: null,
      }
    );
  }

  const bullets = ranked.map((r) => {
    const top = r.intel?.reasoning.bullets[0];
    return top
      ? `${r.ride.name}: ${top}`
      : `${r.ride.name}: ${r.ride.wait_time}m`;
  });

  return buildResponse(
    `${earlyEntryPrefix(byRide, plan)}For the next ${hours} hour${hours === 1 ? "" : "s"}, prioritize: ${ranked.map((r) => r.ride.name).join(", ")}. Sequence by land in the touring planner.`,
    ranked.map((r) => r.ride.ride_id),
    {
      headline: eeMode
        ? `Optimized for Early Entry — next ${hours} hour${hours === 1 ? "" : "s"}`
        : `Optimized next ${hours} hour${hours === 1 ? "" : "s"}`,
      bullets,
      dataNote: "Ranked by opportunity + urgency with confidence filter",
      baselineSource: null,
    },
    ranked[0]?.intel
  );
}

function answerLeastCrowded(
  rides: RideWithLiveData[],
  byRide: Record<number, RideIntelligence>
): AssistantResponse {
  const byLand = new Map<string, { total: number; count: number }>();
  for (const ride of rides.filter((r) => r.is_open)) {
    const entry = byLand.get(ride.land) ?? { total: 0, count: 0 };
    entry.total += ride.wait_time;
    entry.count += 1;
    byLand.set(ride.land, entry);
  }

  let bestLand = "";
  let bestAvg = Infinity;
  for (const [land, { total, count }] of byLand.entries()) {
    const avg = total / count;
    if (avg < bestAvg) {
      bestAvg = avg;
      bestLand = land;
    }
  }

  const landRides = rides
    .filter((r) => r.is_open && r.land === bestLand)
    .sort(
      (a, b) =>
        (byRide[b.ride_id]?.opportunityScore ?? 0) -
        (byRide[a.ride_id]?.opportunityScore ?? 0)
    )
    .slice(0, 3);

  return buildResponse(
    bestLand
      ? `${bestLand} has the lowest average wait (~${Math.round(bestAvg)}m). Start with ${landRides.map((r) => r.name).join(" or ")}.`
      : "No open rides to analyze.",
    landRides.map((r) => r.ride_id),
    {
      headline: bestLand ? `${bestLand} is least crowded` : "No data",
      bullets: landRides.map((r) => {
        const intel = byRide[r.ride_id];
        const note = intel?.reasoning.bullets[0];
        return note ? `${r.name}: ${note}` : `${r.name}: ${r.wait_time}m`;
      }),
      dataNote: "Based on current live waits across open rides",
      baselineSource: null,
    },
    landRides[0] ? byRide[landRides[0].ride_id] : undefined
  );
}

function answerFinishBefore(
  query: AssistantQuery,
  rides: RideWithLiveData[],
  byRide: Record<number, RideIntelligence>,
  plan?: TouringPlan | null
): AssistantResponse {
  const deadlineHour = query.deadlineHour ?? 18;
  const nowHour = getParkParts(new Date()).hour;
  const hoursLeft = Math.max(1, deadlineHour - nowHour);

  const mustDo =
    plan?.preferences.mustDoRideIds ??
    rides.filter((r) => r.is_open).map((r) => r.ride_id);

  const remaining = mustDo.filter((id) => {
    const ride = rides.find((r) => r.ride_id === id);
    return ride?.is_open;
  });

  const ranked = remaining
    .map((id) => {
      const ride = rides.find((r) => r.ride_id === id)!;
      const intel = byRide[id];
      const wait = ride.wait_time + 10;
      return { ride, intel, wait, score: (intel?.urgencyScore ?? 0) + (intel?.opportunityScore ?? 0) };
    })
    .sort((a, b) => b.score - a.score);

  const totalWait = ranked.reduce((s, r) => s + r.wait, 0);
  const feasible = totalWait <= hoursLeft * 60;

  const bullets = ranked.slice(0, 4).map((r) => {
    const note = r.intel?.reasoning.bullets[0];
    return note
      ? `${r.ride.name} (~${r.wait}m incl. ride): ${note}`
      : `${r.ride.name}: ~${r.wait}m`;
  });

  if (!feasible) {
    bullets.push(
      `Tight schedule — ~${totalWait}m total vs ${hoursLeft}h available. Drop lower-priority rides or extend deadline.`
    );
  }

  return buildResponse(
    feasible
      ? `You can likely finish ${ranked.length} ride${ranked.length === 1 ? "" : "s"} before ${deadlineHour > 12 ? deadlineHour - 12 : deadlineHour} PM if you start with ${ranked[0]?.ride.name}.`
      : `Finishing all ${ranked.length} rides before ${deadlineHour}:00 may be tight — prioritize ${ranked.slice(0, 2).map((r) => r.ride.name).join(" and ")}.`,
    ranked.slice(0, 3).map((r) => r.ride.ride_id),
    {
      headline: feasible ? "Achievable before deadline" : "Tight timeline",
      bullets,
      dataNote: `Estimates include wait + ~10m ride time · ${hoursLeft}h remaining`,
      baselineSource: null,
    },
    ranked[0]?.intel
  );
}

function findRide(
  query: AssistantQuery,
  rides: RideWithLiveData[]
): RideWithLiveData | undefined {
  if (query.rideId) {
    return rides.find((r) => r.ride_id === query.rideId);
  }
  if (query.rideName) {
    const q = query.rideName.toLowerCase();
    return rides.find((r) => r.name.toLowerCase().includes(q));
  }
  return undefined;
}
