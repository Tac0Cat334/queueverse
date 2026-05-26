import { NextResponse } from "next/server";
import { answerAssistantQuery } from "@/lib/intelligence/assistant";
import { loadIntelligenceContext } from "@/lib/intelligence-data";
import type { AssistantQuery } from "@/types";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AssistantQuery;
    if (!body?.intent) {
      return NextResponse.json({ error: "Missing intent" }, { status: 400 });
    }

    const context = await loadIntelligenceContext();

    const response = answerAssistantQuery(body, {
      rides: context.rides,
      recommendations: context.recommendations,
    });

    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      { error: "Assistant request failed", details: String(error) },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
