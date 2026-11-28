import { NextResponse } from "next/server";
import { z } from "zod";
import { suggestMealsFallback } from "@/lib/ai/fallback";

export const runtime = "nodejs";

const bodySchema = z.object({
  remainingCalories: z.number().min(0).max(10000),
  level: z.enum(["beginner", "intermediate", "pro"]),
  mealHint: z.string().max(120).optional(),
});

/**
 * Meal suggestions. Uses deterministic catalog fallback by default.
 * When OPENAI_API_KEY (or compatible) is set later, swap the provider here
 * without changing the client contract — important for scaling.
 */
export async function POST(req: Request) {
  try {
    const json = await req.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "invalid_body" }, { status: 400 });
    }

    // Provider seam: plug external LLM here when keys exist.
    const data = suggestMealsFallback(parsed.data);
    return NextResponse.json({
      provider: "fallback",
      ...data,
    });
  } catch {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
