import { NextResponse } from "next/server";
import { z } from "zod";
import { chatFallback } from "@/lib/ai/fallback";

export const runtime = "nodejs";

const bodySchema = z.object({
  message: z.string().min(1).max(2000),
  remainingCalories: z.number(),
  eatenCalories: z.number(),
  profile: z
    .object({
      name: z.string(),
      level: z.enum(["beginner", "intermediate", "pro"]),
      dailyCalorieTarget: z.number(),
      weightKg: z.number(),
      targetWeightKg: z.number(),
    })
    .nullable(),
});

/**
 * Nutrition chat endpoint.
 * Contract stays stable when swapping fallback → hosted LLM.
 * Add auth + per-user rate limits before public multi-tenant scale.
 */
export async function POST(req: Request) {
  try {
    const json = await req.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "invalid_body" }, { status: 400 });
    }

    const reply = chatFallback(parsed.data);
    return NextResponse.json({
      provider: "fallback",
      reply,
    });
  } catch {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
