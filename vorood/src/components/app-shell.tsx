"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const NAV = [
  {
    href: "/today",
    label: "امروز",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M4 11.5 12 5l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-8.5Z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    href: "/log",
    label: "ثبت غذا",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M12 5v14M5 12h14"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <circle cx="12" cy="12" r="8.25" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    ),
  },
  {
    href: "/chat",
    label: "دستیار",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M5 16.5V8.8A3.8 3.8 0 0 1 8.8 5h6.4A3.8 3.8 0 0 1 19 8.8v4.4a3.8 3.8 0 0 1-3.8 3.8H9l-4 3v-3.5Z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
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
        <Link href="/today" className="brand-mark" aria-label="ورود — صفحه امروز">
          ورود
        </Link>
        {title ? <p className="topbar-title">{title}</p> : <span />}
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
              aria-current={active ? "page" : undefined}
            >
              {item.icon}
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
