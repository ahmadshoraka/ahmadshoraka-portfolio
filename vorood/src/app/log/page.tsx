"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { useVorood } from "@/components/vorood-provider";
import { formatNumberFa } from "@/lib/calories";
import { FOOD_CATALOG, searchFoods } from "@/lib/foods/seed-ir";

type Tab = "catalog" | "manual" | "ai";

type AiSuggestion = {
  id: string;
  name: string;
  calories: number;
  proteinG: number;
  carbG: number;
  fatG: number;
  servingLabel: string;
  reason: string;
};

export default function LogPage() {
  const router = useRouter();
  const { ready, profile, remainingCalories, addEntry } = useVorood();
  const [tab, setTab] = useState<Tab>("catalog");
  const [query, setQuery] = useState("");
  const [manualName, setManualName] = useState("");
  const [manualCal, setManualCal] = useState(200);
  const [manualP, setManualP] = useState(0);
  const [manualC, setManualC] = useState(0);
  const [manualF, setManualF] = useState(0);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSummary, setAiSummary] = useState("");
  const [aiItems, setAiItems] = useState<AiSuggestion[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (ready && !profile) router.replace("/onboarding");
  }, [ready, profile, router]);

  const foods = useMemo(() => searchFoods(query), [query]);

  async function loadAiSuggestions() {
    if (!profile) return;
    setAiLoading(true);
    setError("");
    try {
      const res = await fetch("/api/ai/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          remainingCalories: Math.max(0, remainingCalories),
          level: profile.level,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "failed");
      setAiSummary(data.summary ?? "");
      setAiItems(data.suggestions ?? []);
    } catch {
      setError("پیشنهاد AI الان در دسترس نیست. از کاتالوگ یا ثبت دستی استفاده کن.");
    } finally {
      setAiLoading(false);
    }
  }

  useEffect(() => {
    if (tab === "ai" && profile && aiItems.length === 0 && !aiLoading) {
      void loadAiSuggestions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, profile]);

  if (!ready || !profile) {
    return <div className="hero-landing muted">در حال بارگذاری…</div>;
  }

  return (
    <AppShell title="ثبت غذا">
      <section className="panel">
        <p className="muted" style={{ marginTop: 0 }}>
          مانده امروز:{" "}
          <strong>{formatNumberFa(Math.max(0, remainingCalories))}</strong> کالری
        </p>
        <div className="tabs" role="tablist">
          {(
            [
              ["catalog", "کاتالوگ"],
              ["manual", "دستی"],
              ["ai", "پیشنهاد AI"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              className={tab === id ? "tab active" : "tab"}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "catalog" ? (
          <div className="stack-gap">
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="q">جستجو در غذاهای آماده</label>
              <input
                id="q"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="مثلاً قیمه، نان، تخم‌مرغ"
              />
            </div>
            <div className="list">
              {(query ? foods : FOOD_CATALOG).map((f) => (
                <div key={f.id} className="list-item">
                  <div>
                    <div style={{ fontWeight: 700 }}>{f.nameFa}</div>
                    <div className="muted">
                      {formatNumberFa(f.calories)} کالری · {f.servingLabel}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{ padding: "0.45rem 0.8rem" }}
                    onClick={() => {
                      addEntry({
                        name: f.nameFa,
                        calories: f.calories,
                        proteinG: f.proteinG,
                        carbG: f.carbG,
                        fatG: f.fatG,
                        source: "catalog",
                      });
                      router.push("/today");
                    }}
                  >
                    افزودن
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {tab === "manual" ? (
          <form
            className="stack-gap"
            onSubmit={(e) => {
              e.preventDefault();
              if (!manualName.trim()) return;
              addEntry({
                name: manualName.trim(),
                calories: Number(manualCal) || 0,
                proteinG: Number(manualP) || 0,
                carbG: Number(manualC) || 0,
                fatG: Number(manualF) || 0,
                source: "manual",
              });
              router.push("/today");
            }}
          >
            <div className="field">
              <label htmlFor="mname">نام غذا</label>
              <input
                id="mname"
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                placeholder="غذای خانگی یا بیرون"
                required
              />
            </div>
            <div className="field">
              <label htmlFor="mcal">کالری</label>
              <input
                id="mcal"
                type="number"
                min={0}
                value={manualCal}
                onChange={(e) => setManualCal(Number(e.target.value))}
                required
              />
            </div>
            {profile.level !== "beginner" ? (
              <>
                <div className="field">
                  <label htmlFor="mp">پروتئین (g)</label>
                  <input
                    id="mp"
                    type="number"
                    min={0}
                    value={manualP}
                    onChange={(e) => setManualP(Number(e.target.value))}
                  />
                </div>
                <div className="field">
                  <label htmlFor="mc">کربوهیدرات (g)</label>
                  <input
                    id="mc"
                    type="number"
                    min={0}
                    value={manualC}
                    onChange={(e) => setManualC(Number(e.target.value))}
                  />
                </div>
                <div className="field">
                  <label htmlFor="mf">چربی (g)</label>
                  <input
                    id="mf"
                    type="number"
                    min={0}
                    value={manualF}
                    onChange={(e) => setManualF(Number(e.target.value))}
                  />
                </div>
              </>
            ) : null}
            <button type="submit" className="btn btn-primary">
              ثبت دستی
            </button>
          </form>
        ) : null}

        {tab === "ai" ? (
          <div className="stack-gap">
            <p className="muted" style={{ margin: 0 }}>
              پیشنهاد بر اساس کالری مانده و سطح تو.
            </p>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => void loadAiSuggestions()}
              disabled={aiLoading}
            >
              {aiLoading ? "در حال پیشنهاد…" : "تازه‌سازی پیشنهادها"}
            </button>
            {error ? <p className="danger-text">{error}</p> : null}
            {aiSummary ? <p className="muted">{aiSummary}</p> : null}
            <div className="list">
              {aiItems.map((s) => (
                <div key={s.id} className="list-item">
                  <div>
                    <div style={{ fontWeight: 700 }}>{s.name}</div>
                    <div className="muted">
                      {formatNumberFa(s.calories)} کالری · {s.servingLabel}
                    </div>
                    <div className="muted">{s.reason}</div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{ padding: "0.45rem 0.8rem" }}
                    onClick={() => {
                      addEntry({
                        name: s.name,
                        calories: s.calories,
                        proteinG: s.proteinG,
                        carbG: s.carbG,
                        fatG: s.fatG,
                        source: "ai",
                      });
                      router.push("/today");
                    }}
                  >
                    افزودن
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </section>
    </AppShell>
  );
}
