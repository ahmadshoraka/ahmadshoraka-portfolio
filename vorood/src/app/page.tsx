"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useVorood } from "@/components/vorood-provider";

export default function HomePage() {
  const { ready, profile } = useVorood();
  const router = useRouter();

  useEffect(() => {
    if (ready && profile) router.replace("/today");
  }, [ready, profile, router]);

  if (!ready) {
    return <div className="hero-landing muted">در حال آماده‌سازی…</div>;
  }

  if (profile) {
    return <div className="hero-landing muted">در حال ورود به امروز…</div>;
  }

  return (
    <section className="hero-landing">
      <h1 className="hero-brand">ورود</h1>
      <p className="hero-line">کالری ورودی به بدن، ساده و قابل پیگیری.</p>
      <p className="hero-sub">
        وزن هدف بگذار، کالری روزانه‌ات را ببین، غذا را ثبت کن، و با دستیار تغذیه حرف بزن.
        بدون بخش ورزش.
      </p>
      <div className="stack-gap" style={{ position: "relative" }}>
        <Link href="/onboarding" className="btn btn-primary">
          شروع کن
        </Link>
      </div>
    </section>
  );
}
