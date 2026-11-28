"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { AppShell } from "@/components/app-shell";
import { useVorood } from "@/components/vorood-provider";
import { formatNumberFa } from "@/lib/calories";

function levelLabel(level: string): string {
  if (level === "beginner") return "مبتدی";
  if (level === "intermediate") return "متوسط";
  return "حرفه‌ای";
}

function sourceLabel(source: string): string {
  if (source === "manual") return "دستی";
  if (source === "catalog") return "کاتالوگ";
  return "AI";
}

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
    return <div className="loading-screen">در حال آماده‌سازی امروز…</div>;
  }

  const overBudget = remainingCalories < 0;
  const ratio = Math.min(
    100,
    Math.round((eatenCalories / Math.max(1, profile.dailyCalorieTarget)) * 100),
  );
  const showMacros = profile.level !== "beginner";

  return (
    <AppShell title={`سلام ${profile.name}`}>
      <section className="panel panel-hero">
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
          <div className={`stat emphasis ${overBudget ? "danger" : ""}`}>
            <strong>
              {formatNumberFa(overBudget ? Math.abs(remainingCalories) : remainingCalories)}
            </strong>
            <span>{overBudget ? "بیش از هدف" : "مانده"}</span>
          </div>
        </div>
        <div
          className={overBudget ? "progress over" : "progress"}
          style={{ marginTop: "0.9rem" }}
          aria-hidden
        >
          <span style={{ width: `${ratio}%` }} />
        </div>
        <p className={overBudget ? "budget-note warn" : "budget-note"}>
          {overBudget
            ? "از بودجه امروز رد شدی؛ برای وعده بعدی سراغ گزینه‌های سبک‌تر برو."
            : `وزن هدف ${formatNumberFa(profile.targetWeightKg)} کیلو · سطح ${levelLabel(profile.level)}`}
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
        <div className="section-head">
          <h2>وعده‌های امروز</h2>
          <Link href="/log" className="link-action">
            + ثبت غذا
          </Link>
        </div>
        {entriesToday.length === 0 ? (
          <div className="empty-state">
            <div className="empty-orb" aria-hidden />
            <h3>هنوز وعده‌ای ثبت نشده</h3>
            <p className="muted">اولین غذا را اضافه کن تا بودجه امروز زنده شود.</p>
            <Link href="/log" className="btn btn-primary btn-sm" style={{ marginTop: "0.5rem" }}>
              ثبت اولین وعده
            </Link>
          </div>
        ) : (
          <div className="list">
            {entriesToday.map((e) => (
              <div key={e.id} className="list-item">
                <div>
                  <div className="item-title">{e.name}</div>
                  <div className="muted">
                    {formatNumberFa(e.calories)} کالری
                    <span className="badge">{sourceLabel(e.source)}</span>
                  </div>
                </div>
                <button
                  type="button"
                  className="danger-text"
                  aria-label={`حذف ${e.name}`}
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
        <Link href="/chat" className="btn btn-primary btn-block">
          بپرس از دستیار: شام چی بخورم؟
        </Link>
        <button
          type="button"
          className="quiet-link"
          onClick={() => {
            if (confirm("پروفایل و داده‌های این دستگاه پاک شود؟")) {
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
