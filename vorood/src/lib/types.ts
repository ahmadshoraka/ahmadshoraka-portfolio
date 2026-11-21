export type UserLevel = "beginner" | "intermediate" | "pro";
export type Sex = "female" | "male";
export type ActivityLevel =
  | "sedentary"
  | "light"
  | "moderate"
  | "active"
  | "very_active";

export type GoalType = "lose" | "maintain" | "gain";

export type UserProfile = {
  id: string;
  name: string;
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  targetWeightKg: number;
  activity: ActivityLevel;
  level: UserLevel;
  dailyCalorieTarget: number;
  proteinTargetG: number;
  carbTargetG: number;
  fatTargetG: number;
  createdAt: string;
  updatedAt: string;
};

export type FoodItem = {
  id: string;
  nameFa: string;
  nameAr?: string;
  calories: number;
  proteinG: number;
  carbG: number;
  fatG: number;
  servingLabel: string;
  tags: string[];
};

export type DiaryEntrySource = "manual" | "catalog" | "ai";

export type DiaryEntry = {
  id: string;
  dateKey: string; // YYYY-MM-DD
  name: string;
  calories: number;
  proteinG: number;
  carbG: number;
  fatG: number;
  source: DiaryEntrySource;
  createdAt: string;
};

export type DaySummary = {
  dateKey: string;
  calories: number;
  proteinG: number;
  carbG: number;
  fatG: number;
  remaining: number;
};
