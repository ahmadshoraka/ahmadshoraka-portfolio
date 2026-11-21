"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { AppShell } from "@/components/app-shell";
import { useVorood } from "@/components/vorood-provider";
import { formatNumberFa } from "@/lib/calories";

export default function TodayPage() {
  const router = useRouter();
  const {
    ready,
    profile,
    entriesToday,
    eatenCalories,
    remainingCalories,
    eatenProteinG,
    eatenCarbG,
    eatenFatG,
    removeEntry,
    resetAll,
  } = useVorood();

  useEffect(() => {
    if (ready && !profile) router.replace("/onboarding");
  }, [ready, profile, router]);

  if (!ready || !profile) {
    return <div className="hero-landing muted">در حال بارگذاری…</div>;
  }

  const ratio = Math.min(
    100,
    Math.round((eatenCalories / Math.max(1, profile.dailyCalorieTarget)) * 100),
  );
  const showMacros = profile.level !== "beginner";

  return (
    <AppShell title={`سلام ${profile.name}`}>
      <section className="panel">
        <h2>بودجه کالری امروز</h2>
        <div className="stat-row">
          <div className="stat">
            <strong>{formatNumberFa(profile.dailyCalorieTarget)}</strong>
            <span>هدف</span>
          </div>
          <div className="stat">
            <strong>{formatNumberFa(eatenCalories)}</strong>
            <span>خورده</span>
          </div>
          <div className="stat">
            <strong>{formatNumberFa(Math.max(0, remainingCalories))}</strong>
            <span>مانده</span>
          </div>
        </div>
        <div className="progress" style={{ marginTop: "0.85rem" }} aria-hidden>
          <span style={{ width: `${ratio}%` }} />
        </div>
        <p className="muted" style={{ marginTop: "0.7rem" }}>
          وزن هدف: {formatNumberFa(profile.targetWeightKg)} کیلو · سطح:{" "}
          {profile.level === "beginner"
            ? "مبتدی"
            : profile.level === "intermediate"
              ? "متوسط"
              : "حرفه‌ای"}
        </p>
      </section>

      {showMacros ? (
        <section className="panel">
          <h2>ماکرو امروز</h2>
          <div className="stat-row">
            <div className="stat">
              <strong>
                {formatNumberFa(eatenProteinG)}/{formatNumberFa(profile.proteinTargetG)}
              </strong>
              <span>پروتئین</span>
            </div>
            <div className="stat">
              <strong>
                {formatNumberFa(eatenCarbG)}/{formatNumberFa(profile.carbTargetG)}
              </strong>
              <span>کرب</span>
            </div>
            <div className="stat">
              <strong>
                {formatNumberFa(eatenFatG)}/{formatNumberFa(profile.fatTargetG)}
              </strong>
              <span>چربی</span>
            </div>
          </div>
        </section>
      ) : null}

      <section className="panel">
        <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem" }}>
          <h2>وعده‌های امروز</h2>
          <Link href="/log" className="muted">
            + ثبت
          </Link>
        </div>
        {entriesToday.length === 0 ? (
          <p className="muted">هنوز چیزی ثبت نشده. اولین وعده را اضافه کن.</p>
        ) : (
          <div className="list">
            {entriesToday.map((e) => (
              <div key={e.id} className="list-item">
                <div>
                  <div style={{ fontWeight: 700 }}>{e.name}</div>
                  <div className="muted">
                    {formatNumberFa(e.calories)} کالری
                    <span className="badge" style={{ marginInlineStart: "0.4rem" }}>
                      {e.source === "manual"
                        ? "دستی"
                        : e.source === "catalog"
                          ? "کاتالوگ"
                          : "AI"}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  className="danger-text"
                  onClick={() => removeEntry(e.id)}
                >
                  حذف
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="stack-gap">
        <Link href="/chat" className="btn btn-primary">
          بپرس از دستیار: شام چی بخورم؟
        </Link>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => {
            if (confirm("پروفایل و داده‌های محلی پاک شود؟")) {
              resetAll();
              router.replace("/");
            }
          }}
        >
          ریست داده‌های این دستگاه
        </button>
      </div>
    </AppShell>
  );
}
