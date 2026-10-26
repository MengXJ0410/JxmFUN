import Link from "next/link";
import type { ReactNode } from "react";
import { AppearanceControl } from "@/components/home/appearance-control";
import { StarField } from "@/components/home/star-field";

type RealHomeShellProps = {
  active: "home" | "monitor";
  children?: ReactNode;
};

export function RealHomeShell({ active, children }: RealHomeShellProps) {
  return (
    <main className="real-home">
      <StarField />
      <header className="real-home-nav">
        <Link className="real-home-brand" href="/home">JXM · HOME</Link>
        <nav className="real-home-links" aria-label="个人网站导航">
          <Link className={active === "home" ? "is-active" : ""} aria-current={active === "home" ? "page" : undefined} href="/home">首页</Link>
          <Link className={active === "monitor" ? "is-active" : ""} aria-current={active === "monitor" ? "page" : undefined} href="/home/monitor">监控室</Link>
          <Link href="/">展示首页</Link>
        </nav>
      </header>
      <AppearanceControl variant="compact" />
      {children ? (
        <div className="real-home-content">{children}</div>
      ) : (
        <section className="real-home-stage">
          <span className="real-home-kicker">PERSONAL SITE</span>
          <h1>个人网站建设中</h1>
          <p>这里会是真正的个人主页。更多模块会在后续逐步开放。</p>
          <Link className="real-home-back" href="/">返回展示首页</Link>
        </section>
      )}
    </main>
  );
}
