import Link from "next/link";

export function RealHomeShell() {
  return (
    <main className="real-home">
      <header className="real-home-nav">
        <Link className="real-home-brand" href="/home">JXM · HOME</Link>
        <nav className="real-home-links" aria-label="个人网站导航">
          <span className="is-active">首页</span>
          <span className="is-disabled">监控室 <small>即将开放</small></span>
          <Link href="/">展示首页</Link>
        </nav>
      </header>
      <section className="real-home-stage">
        <span className="real-home-kicker">PERSONAL SITE</span>
        <h1>个人网站建设中</h1>
        <p>这里会是真正的个人主页。监控室等模块会在后续逐步开放。</p>
        <Link className="real-home-back" href="/">返回展示首页</Link>
      </section>
    </main>
  );
}
