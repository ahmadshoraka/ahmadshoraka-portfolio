"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { useVorood } from "@/components/vorood-provider";

export default function ChatPage() {
  const router = useRouter();
  const {
    ready,
    profile,
    chat,
    appendChat,
    remainingCalories,
    eatenCalories,
  } = useVorood();
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ready && !profile) router.replace("/onboarding");
  }, [ready, profile, router]);

  useEffect(() => {
    const el = logRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [chat, loading]);

  async function send(text: string) {
    if (!profile || !text.trim() || loading) return;
    const content = text.trim();
    setMessage("");
    appendChat("user", content);
    setLoading(true);
    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: content,
          remainingCalories,
          eatenCalories,
          profile: {
            name: profile.name,
            level: profile.level,
            dailyCalorieTarget: profile.dailyCalorieTarget,
            weightKg: profile.weightKg,
            targetWeightKg: profile.targetWeightKg,
          },
        }),
      });
      const data = await res.json();
      appendChat(
        "assistant",
        res.ok
          ? data.reply
          : "الان نتوانستم پاسخ بدهم. کمی بعد دوباره امتحان کن.",
      );
    } catch {
      appendChat("assistant", "ارتباط برقرار نشد. اتصال اینترنت را بررسی کن.");
    } finally {
      setLoading(false);
    }
  }

  if (!ready || !profile) {
    return <div className="loading-screen">در حال آماده‌سازی دستیار…</div>;
  }

  return (
    <AppShell title="دستیار تغذیه">
      <section className="panel stack-gap">
        <p className="muted" style={{ margin: 0 }}>
          فقط درباره ورودی غذا و کالری حرف می‌زنیم — جایگزین پزشک نیست.
        </p>
        <div className="chat-log" aria-live="polite" ref={logRef}>
          {chat.length === 0 ? (
            <div className="bubble assistant">
              سلام {profile.name}. بپرس مثلاً: «شام با کالری مانده چی بخورم؟»
            </div>
          ) : (
            chat.map((m) => (
              <div key={m.id} className={`bubble ${m.role}`}>
                {m.content}
              </div>
            ))
          )}
          {loading ? <div className="bubble assistant muted">در حال فکر…</div> : null}
        </div>

        <div className="chip-row">
          {["شام چی بخورم؟", "هدف کالری‌ام چقدر است؟", "پروتئین چی؟"].map((q) => (
            <button
              key={q}
              type="button"
              className="chip"
              disabled={loading}
              onClick={() => void send(q)}
            >
              {q}
            </button>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send(message);
          }}
          className="stack-gap"
        >
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="msg">پیام تو</label>
            <textarea
              id="msg"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="درباره وعده، کالری مانده، یا جایگزینی غذا بپرس"
            />
          </div>
          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            ارسال
          </button>
        </form>
      </section>
    </AppShell>
  );
}
