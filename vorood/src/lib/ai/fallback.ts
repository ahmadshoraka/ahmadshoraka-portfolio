import { FOOD_CATALOG } from "../foods/seed-ir";
import type { UserLevel, UserProfile } from "../types";

export type SuggestContext = {
  remainingCalories: number;
  level: UserLevel;
  mealHint?: string;
};

export function suggestMealsFallback(ctx: SuggestContext) {
  const budget = Math.max(0, ctx.remainingCalories);
  const pool = FOOD_CATALOG.filter((f) => f.calories <= budget || budget < 80);
  const ranked = [...pool].sort((a, b) => {
    const aFit = Math.abs(a.calories - Math.min(budget, 450));
    const bFit = Math.abs(b.calories - Math.min(budget, 450));
    return aFit - bFit;
  });

  const picks = ranked.slice(0, 3);
  const tone =
    ctx.level === "beginner"
      ? "ساده و قابل اجرا"
      : ctx.level === "intermediate"
        ? "متناسب با کالری مانده امروز"
        : "دقیق روی بودجه کالری و تعادل نسبی ماکرو";

  return {
    summary: `با حدود ${Math.round(budget)} کالری مانده، این گزینه‌ها ${tone} هستند.`,
    suggestions: picks.map((f) => ({
      id: f.id,
      name: f.nameFa,
      calories: f.calories,
      proteinG: f.proteinG,
      carbG: f.carbG,
      fatG: f.fatG,
      servingLabel: f.servingLabel,
      reason:
        budget < 80
          ? "بودجه امروز تقریباً پر شده؛ گزینه سبک."
          : `حدود ${f.calories} کالری — داخل بودجه مانده.`,
    })),
  };
}

export function chatFallback(input: {
  message: string;
  profile: Pick<
    UserProfile,
    "name" | "level" | "dailyCalorieTarget" | "weightKg" | "targetWeightKg"
  > | null;
  remainingCalories: number;
  eatenCalories: number;
}): string {
  const msg = input.message.trim();
  const remaining = Math.round(input.remainingCalories);
  const eaten = Math.round(input.eatenCalories);
  const target = input.profile?.dailyCalorieTarget ?? 0;
  const level = input.profile?.level ?? "beginner";

  if (/هدف|کالری\s*روز|چقدر\s*باید/.test(msg)) {
    return `هدف کالری روزانهٔ تو حدود ${target} است. تا الان ${eaten} خوردی و حدود ${remaining} کالری مانده. تمرکز ورود فقط روی ورودی غذاست؛ ورزش را جدا پیگیری کن.`;
  }

  if (/شام|ناهار|صبحانه|چی\s*بخورم|پیشنهاد/.test(msg)) {
    const suggestion = suggestMealsFallback({
      remainingCalories: remaining,
      level,
    });
    const lines = suggestion.suggestions
      .map((s) => `• ${s.name} — ${s.calories} کالری (${s.servingLabel})`)
      .join("\n");
    return `${suggestion.summary}\n${lines}\n\nاگر خواستی، بگو کدام را از کاتالوگ ثبت کنیم.`;
  }

  if (/پروتئین|ماکرو|چربی|کرب/.test(msg)) {
    if (level === "beginner") {
      return `فعلاً فقط حواست به مجموع کالری روز باشد (هدف ${target}). وقتی راحت شدی، پروتئین را هم نگاه می‌کنیم.`;
    }
    return `امروز ${eaten} از ${target} کالری را پر کردی. برای جزئیات ماکرو برو سراغ ثبت وعده‌ها؛ در سطح ${level === "pro" ? "حرفه‌ای" : "متوسط"} ماکروها روی صفحه امروز دیده می‌شوند.`;
  }

  return `من دستیار تغذیهٔ «ورود» هستم و فقط روی ورودی کالری به بدن تمرکز دارم. امروز ${eaten} کالری ثبت شده و ${remaining} مانده است. بپرس: شام چی بخورم؟ یا یک غذا را بگو تا کمکت کنم برآورد کنم.\n\nتوجه: این راهنمای عمومی تغذیه است، نه جایگزین پزشک یا متخصص تغذیه.`;
}
