import type { Metadata } from "next";
import { ColorModeSync } from "@/components/home/color-mode-sync";
import { SITE } from "@/content/site";
import "./globals.css";

export const metadata: Metadata = {
  title: SITE.title,
  description: SITE.description,
};

const COLOR_MODE_BOOTSTRAP = `(function(){try{var raw=localStorage.getItem("jxmfun-appearance-v1");var mode="system";if(raw){var parsed=JSON.parse(raw);if(parsed&&(parsed.colorMode==="light"||parsed.colorMode==="dark"))mode=parsed.colorMode;}var resolved=mode==="system"?(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):mode;document.documentElement.dataset.colorMode=resolved;}catch(e){document.documentElement.dataset.colorMode=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}})();`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: COLOR_MODE_BOOTSTRAP }} />
        <ColorModeSync />
        {children}
      </body>
    </html>
  );
}
