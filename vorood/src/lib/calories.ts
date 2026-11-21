import type { ActivityLevel, GoalType, Sex, UserProfile } from "./types";

const ACTIVITY_MULTIPLIER: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

/** Mifflin-St Jeor BMR */
export function bmrMifflin(sex: Sex, weightKg: number, heightCm: number, age: number): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return sex === "male" ? base + 5 : base - 161;
}

export function tdee(bmr: number, activity: ActivityLevel): number {
  return Math.round(bmr * ACTIVITY_MULTIPLIER[activity]);
}

export function inferGoal(weightKg: number, targetWeightKg: number): GoalType {
  const delta = targetWeightKg - weightKg;
  if (delta < -0.5) return "lose";
  if (delta > 0.5) return "gain";
  return "maintain";
}

/** Daily calorie target from profile inputs (nutrition-only product). */
export function computeDailyTargets(input: {
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  targetWeightKg: number;
  activity: ActivityLevel;
}): Pick<
  UserProfile,
  "dailyCalorieTarget" | "proteinTargetG" | "carbTargetG" | "fatTargetG"
> {
  const bmr = bmrMifflin(input.sex, input.weightKg, input.heightCm, input.age);
  const maintenance = tdee(bmr, input.activity);
  const goal = inferGoal(input.weightKg, input.targetWeightKg);

  let calories = maintenance;
  if (goal === "lose") calories = Math.max(1200, maintenance - 500);
  if (goal === "gain") calories = maintenance + 300;

  // Macro split oriented to intake tracking: higher protein when losing.
  const proteinPerKg = goal === "lose" ? 1.8 : goal === "gain" ? 1.6 : 1.4;
  const proteinTargetG = Math.round(input.weightKg * proteinPerKg);
  const fatTargetG = Math.round((calories * 0.28) / 9);
  const proteinCals = proteinTargetG * 4;
  const fatCals = fatTargetG * 9;
  const carbTargetG = Math.max(0, Math.round((calories - proteinCals - fatCals) / 4));

  return {
    dailyCalorieTarget: Math.round(calories),
    proteinTargetG,
    carbTargetG,
    fatTargetG,
  };
}

export function todayKey(timeZone = "Asia/Tehran"): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function formatNumberFa(value: number): string {
  return new Intl.NumberFormat("fa-IR").format(Math.round(value));
}
