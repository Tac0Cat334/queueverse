import { NextResponse } from "next/server";
import { EMPTY_DATA_MATURITY } from "@/lib/data-maturity";
import { EMPTY_PARK_STRATEGY } from "@/lib/intelligence/strategy";
import { loadIntelligenceContext } from "@/lib/intelligence-data";

export async function GET() {
  try {
    const context = await loadIntelligenceContext();

    if (!context.configured) {
      return NextResponse.json({
        recommendations: {
          bestRightNow: [],
          greatTimeToRide: [],
          lowerThanNormal: [],
          trendingUpFast: [],
          expectedToRiseSoon: [],
          byRideId: {},
          strategy: EMPTY_PARK_STRATEGY,
          dataMaturity: {
            ...EMPTY_DATA_MATURITY,
            totalRides: context.rides.length,
          },
          weekdayPatternsByRide: {},
          parkWeekdayInsights: {},
          generatedAt: context.loadedAt,
        },
        rides: context.rides,
        configured: false,
        parkId: context.parkId,
      });
    }

    return NextResponse.json(
      {
        recommendations: context.recommendations,
        rides: context.rides,
        configured: true,
        parkId: context.parkId,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
        },
      }
    );
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch intelligence", details: String(error) },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
