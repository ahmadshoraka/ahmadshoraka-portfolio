"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { computeDailyTargets, formatNumberFa } from "@/lib/calories";
import { useVorood } from "@/components/vorood-provider";
import type { ActivityLevel, Sex, UserLevel } from "@/lib/types";

const LEVELS: { id: UserLevel; label: string; hint: string }[] = [
  { id: "beginner", label: "مبتدی", hint: "فقط کالری روزانه" },
  { id: "intermediate", label: "متوسط", hint: "کالری + ماکرو" },
  { id: "pro", label: "حرفه‌ای", hint: "کنترل دقیق‌تر" },
];

const ACTIVITY: { id: ActivityLevel; label: string }[] = [
  { id: "sedentary", label: "کم‌تحرک" },
  { id: "light", label: "سبک" },
  { id: "moderate", label: "متوسط" },
  { id: "active", label: "فعال" },
  { id: "very_active", label: "خیلی فعال" },
];

export default function OnboardingPage() {
  const { completeOnboarding } = useVorood();
  const router = useRouter();

  const [name, setName] = useState("");
  const [sex, setSex] = useState<Sex>("female");
  const [age, setAge] = useState(28);
  const [heightCm, setHeightCm] = useState(165);
  const [weightKg, setWeightKg] = useState(70);
  const [targetWeightKg, setTargetWeightKg] = useState(65);
  const [activity, setActivity] = useState<ActivityLevel>("light");
  const [level, setLevel] = useState<UserLevel>("beginner");

  const preview = useMemo(
    () =>
      computeDailyTargets({
        sex,
        age,
        heightCm,
        weightKg,
        targetWeightKg,
        activity,
      }),
    [sex, age, heightCm, weightKg, targetWeightKg, activity],
  );

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    completeOnboarding({
      name: name.trim() || "کاربر",
      sex,
      age,
      heightCm,
      weightKg,
      targetWeightKg,
      activity,
      level,
    });
    router.push("/today");
  }

  return (
    <div className="app-frame" style={{ paddingBottom: "2rem" }}>
      <header className="topbar">
        <span className="brand-mark">ورود</span>
        <p className="topbar-title">ساخت پروفایل</p>
      </header>

      <form className="stack-gap" onSubmit={onSubmit}>
        <div className="panel">
          <h2>اطلاعات پایه</h2>
          <p className="muted">برای محاسبه کالری هدف روزانه — فقط تغذیه.</p>
          <div className="field">
            <label htmlFor="name">نام</label>
            <input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثلاً سارا"
            />
          </div>
          <div className="field">
            <label>جنسیت</label>
            <div className="chip-row">
              {(
                [
                  ["female", "زن"],
                  ["male", "مرد"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={sex === id ? "chip active" : "chip"}
                  onClick={() => setSex(id)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <label htmlFor="age">سن</label>
            <input
              id="age"
              type="number"
              min={14}
              max={90}
              value={age}
              onChange={(e) => setAge(Number(e.target.value))}
            />
          </div>
          <div className="field">
            <label htmlFor="height">قد (سانتی‌متر)</label>
            <input
              id="height"
              type="number"
              min={120}
              max={230}
              value={heightCm}
              onChange={(e) => setHeightCm(Number(e.target.value))}
            />
          </div>
          <div className="field">
            <label htmlFor="weight">وزن فعلی (کیلو)</label>
            <input
              id="weight"
              type="number"
              min={35}
              max={250}
              step={0.1}
              value={weightKg}
              onChange={(e) => setWeightKg(Number(e.target.value))}
            />
          </div>
          <div className="field">
            <label htmlFor="target">وزن هدف (کیلو)</label>
            <input
              id="target"
              type="number"
              min={35}
              max={250}
              step={0.1}
              value={targetWeightKg}
              onChange={(e) => setTargetWeightKg(Number(e.target.value))}
            />
          </div>
          <div className="field">
            <label htmlFor="activity">سطح فعالیت (فقط برای محاسبه کالری)</label>
            <select
              id="activity"
              value={activity}
              onChange={(e) => setActivity(e.target.value as ActivityLevel)}
            >
              {ACTIVITY.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="panel">
          <h2>سطح کاربری</h2>
          <div className="chip-row">
            {LEVELS.map((l) => (
              <button
                key={l.id}
                type="button"
                className={level === l.id ? "chip active" : "chip"}
                onClick={() => setLevel(l.id)}
              >
                {l.label}
              </button>
            ))}
          </div>
          <p className="muted" style={{ marginTop: "0.7rem" }}>
            {LEVELS.find((l) => l.id === level)?.hint}
          </p>
        </div>

        <div className="panel">
          <h2>هدف کالری پیشنهادی</h2>
          <p className="muted">
            حدود{" "}
            <strong style={{ color: "var(--leaf-deep)" }}>
              {formatNumberFa(preview.dailyCalorieTarget)}
            </strong>{" "}
            کالری در روز
          </p>
          {level !== "beginner" ? (
            <p className="muted">
              پروتئین {formatNumberFa(preview.proteinTargetG)}g · کرب{" "}
              {formatNumberFa(preview.carbTargetG)}g · چربی{" "}
              {formatNumberFa(preview.fatTargetG)}g
            </p>
          ) : null}
        </div>

        <button type="submit" className="btn btn-primary">
          برو به امروز
        </button>
      </form>
    </div>
  );
}
