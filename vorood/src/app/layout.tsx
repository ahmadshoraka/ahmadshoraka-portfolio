import type { Metadata, Viewport } from "next";
import { Vazirmatn } from "next/font/google";
import { VoroodProvider } from "@/components/vorood-provider";
import "./globals.css";

const vazirmatn = Vazirmatn({
  subsets: ["arabic"],
  variable: "--font-vazirmatn",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ورود | کالری‌شمار تغذیه",
  description:
    "ورود؛ تمرکز روی ورودی کالری به بدن. هدف روزانه، ثبت غذا، و دستیار تغذیه.",
  applicationName: "ورود",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "ورود",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: "#1f6a4c",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl">
      <body className={`${vazirmatn.variable} antialiased`}>
        <VoroodProvider>{children}</VoroodProvider>
      </body>
    </html>
  );
}
