import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "JXM · 个人主页",
  description: "关于我与 AI Chater 的个人展示主页",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
