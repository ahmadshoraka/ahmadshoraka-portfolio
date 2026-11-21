"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { computeDailyTargets, formatNumberFa } from "@/lib/calories";
import { useVorood } from "@/components/vorood-provider";
import type { ActivityLevel, Sex, UserLevel } from "@/lib/types";

const LEVELS: { id: UserLevel; label: string; hint: string }[] = [
  { id: "beginner", label: "مبتدی", hint: "فقط کالری روزانه، ساده و شفاف" },
  { id: "intermediate", label: "متوسط", hint: "کالری + پروتئین/کرب/چربی" },
  { id: "pro", label: "حرفه‌ای", hint: "جزئیات بیشتر برای کنترل دقیق" },
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
  const [step, setStep] = useState(0);

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

  function finish() {
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

      <div className="stepper" aria-label="پیشرفت ساخت پروفایل">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={
              i === step ? "step-dot active" : i < step ? "step-dot done" : "step-dot"
            }
          />
        ))}
      </div>

      {step === 0 ? (
        <section className="panel stack-gap">
          <div>
            <h2>از کجا شروع کنیم؟</h2>
            <p className="muted">چند اطلاعات ساده برای محاسبه کالری روزانه.</p>
          </div>
          <div className="field">
            <label htmlFor="name">نام</label>
            <input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثلاً سارا"
              autoComplete="nickname"
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
          <div className="row-2">
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
          </div>
          <button type="button" className="btn btn-primary btn-block" onClick={() => setStep(1)}>
            ادامه
          </button>
        </section>
      ) : null}

      {step === 1 ? (
        <section className="panel stack-gap">
          <div>
            <h2>وزن و هدف</h2>
            <p className="muted">سطح فعالیت فقط برای محاسبه کالری است؛ بخش ورزش نداریم.</p>
          </div>
          <div className="row-2">
            <div className="field">
              <label htmlFor="weight">وزن فعلی</label>
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
              <label htmlFor="target">وزن هدف</label>
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
          </div>
          <div className="field">
            <label htmlFor="activity">سطح فعالیت روزانه</label>
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
          <div className="stack-gap">
            <button type="button" className="btn btn-primary btn-block" onClick={() => setStep(2)}>
              ادامه
            </button>
            <button type="button" className="btn btn-ghost btn-block" onClick={() => setStep(0)}>
              قبلی
            </button>
          </div>
        </section>
      ) : null}

      {step === 2 ? (
        <section className="panel stack-gap">
          <div>
            <h2>سطح و هدف کالری</h2>
            <p className="muted">سطح را هر وقت خواستی می‌توانی جدی‌تر کنی.</p>
          </div>
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
          <p className="muted">{LEVELS.find((l) => l.id === level)?.hint}</p>

          <div className="panel" style={{ boxShadow: "none", marginTop: "0.25rem" }}>
            <p className="muted" style={{ marginTop: 0 }}>
              هدف پیشنهادی امروز
            </p>
            <div className="preview-pill">
              {formatNumberFa(preview.dailyCalorieTarget)} کالری
            </div>
            {level !== "beginner" ? (
              <p className="muted" style={{ marginTop: "0.65rem", marginBottom: 0 }}>
                پروتئین {formatNumberFa(preview.proteinTargetG)}g · کرب{" "}
                {formatNumberFa(preview.carbTargetG)}g · چربی{" "}
                {formatNumberFa(preview.fatTargetG)}g
              </p>
            ) : null}
          </div>

          <div className="stack-gap">
            <button type="button" className="btn btn-primary btn-block" onClick={finish}>
              برو به امروز
            </button>
            <button type="button" className="btn btn-ghost btn-block" onClick={() => setStep(1)}>
              قبلی
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
