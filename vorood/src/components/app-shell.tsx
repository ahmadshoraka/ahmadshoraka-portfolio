"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const NAV = [
  { href: "/today", label: "امروز" },
  { href: "/log", label: "ثبت غذا" },
  { href: "/chat", label: "دستیار" },
] as const;

export function AppShell({
  children,
  title,
}: {
  children: ReactNode;
  title?: string;
}) {
  const pathname = usePathname();

  return (
    <div className="app-frame">
      <header className="topbar">
        <Link href="/today" className="brand-mark">
          ورود
        </Link>
        {title ? <p className="topbar-title">{title}</p> : null}
      </header>
      <main className="page-main">{children}</main>
      <nav className="bottom-nav" aria-label="ناوبری اصلی">
        {NAV.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={active ? "nav-item active" : "nav-item"}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
