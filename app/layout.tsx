import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "JXM · 个人主页",
  description: "关于我与 AI Chater 的个人展示主页",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <Script id="color-mode" strategy="beforeInteractive">
          {`(() => { const mode = localStorage.getItem("jxmfun-color-mode") || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"); document.documentElement.dataset.colorMode = mode; })()`}
        </Script>
      </head>
      <body>{children}</body>
    </html>
  );
}
