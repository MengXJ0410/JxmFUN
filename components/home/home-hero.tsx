"use client";

import NextImage from "next/image";
import { type CSSProperties, useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent } from "react";
import { ArrowUpRight, Bot, ChevronDown, Github, Image as ImageIcon, Layers3, MessageSquareText, Settings2, WandSparkles } from "lucide-react";
import { advanceParticles, createBubbleVisuals, placeBubbleParticles, responsiveBubbleSize, type BubbleParticle, type BubbleRect } from "@/client/home/home-bubbles";
import { HOME_PAGE_COUNT, getHomePageIndexFromScroll, nextHomePageIndex } from "@/client/home/home-sections";
import { HOME_STAR_POINTS } from "@/client/home/home-sky";
import { HOME_AUTHOR_PROFILE } from "@/client/home/home-profile";
import { AppearanceControl } from "@/components/home/appearance-control";
import { APPEARANCE_CHANGE_EVENT, APPEARANCE_STORAGE_KEY, DEFAULT_ACCENT, defaultAppearance, deriveBubbleColor, parseAppearance, type AppearanceChangeDetail } from "@/client/appearance";

type HomeHeroProps = { backgrounds: string[] };
const PAGE_LABELS = ["首页", "关于我", "更多功能"];
const HOME_BUBBLE_TERMS = ["棍木", "棍木", "棍木", "棍木", "棍木", "棍木"];
const HOME_FEATURES = [
  { icon: Bot, title: "棍木棍木棍木", description: "棍木棍木棍木" },
  { icon: MessageSquareText, title: "棍木棍木棍木", description: "棍木棍木棍木" },
  { icon: ImageIcon, title: "棍木棍木棍木", description: "棍木棍木棍木" },
  { icon: Layers3, title: "棍木棍木棍木", description: "棍木棍木棍木" },
];

export function HomeHero({ backgrounds }: HomeHeroProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<BubbleParticle[]>([]);
  const pointerRef = useRef<{ x: number; y: number } | null>(null);
  const activityRef = useRef(defaultAppearance.bubbleActivity);
  const wheelLockRef = useRef(false);
  const [bubbles] = useState(() => createBubbleVisuals(HOME_BUBBLE_TERMS, () => 0.5));
  const [activePage, setActivePage] = useState(0);
  const [backgroundIndex, setBackgroundIndex] = useState(0);
  const [accent, setAccent] = useState(() => typeof window === "undefined" ? DEFAULT_ACCENT : parseAppearance(localStorage.getItem(APPEARANCE_STORAGE_KEY)).accent);
  const [bubbleColorRange, setBubbleColorRange] = useState(() => typeof window === "undefined" ? defaultAppearance.bubbleColorRange : parseAppearance(localStorage.getItem(APPEARANCE_STORAGE_KEY)).bubbleColorRange);
  const [avatarAvailable, setAvatarAvailable] = useState(true);
  const scrollToPage = useCallback((index: number) => {
    const root = scrollRef.current;
    if (!root) return;
    const target = Math.max(0, Math.min(HOME_PAGE_COUNT - 1, index));
    root.scrollTo({ top: root.clientHeight * target, behavior: "smooth" });
    setActivePage(target);
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem(APPEARANCE_STORAGE_KEY);
    if (stored) activityRef.current = parseAppearance(stored).bubbleActivity;
    const onAppearanceChange = (event: Event) => {
      const detail = (event as CustomEvent<AppearanceChangeDetail>).detail;
      setAccent(detail.accent); setBubbleColorRange(detail.bubbleColorRange); activityRef.current = detail.bubbleActivity;
    };
    window.addEventListener(APPEARANCE_CHANGE_EVENT, onAppearanceChange);
    return () => window.removeEventListener(APPEARANCE_CHANGE_EVENT, onAppearanceChange);
  }, []);

  useEffect(() => {
    if (backgrounds.length < 2) return;
    const timer = window.setInterval(() => setBackgroundIndex((index) => (index + 1) % backgrounds.length), 7200);
    return () => window.clearInterval(timer);
  }, [backgrounds]);

  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;
    let scrollTimer = 0;
    let wheelTimer = 0;
    const onScroll = () => { window.clearTimeout(scrollTimer); scrollTimer = window.setTimeout(() => setActivePage(getHomePageIndexFromScroll(root.scrollTop, root.clientHeight)), 70); };
    const onWheel = (event: WheelEvent) => {
      const current = getHomePageIndexFromScroll(root.scrollTop, root.clientHeight);
      const target = nextHomePageIndex(current, event.deltaY);
      if (target === current || wheelLockRef.current) return;
      event.preventDefault(); wheelLockRef.current = true; scrollToPage(target);
      window.clearTimeout(wheelTimer); wheelTimer = window.setTimeout(() => { wheelLockRef.current = false; }, 680);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      const current = getHomePageIndexFromScroll(root.scrollTop, root.clientHeight);
      if (["ArrowDown", "PageDown"].includes(event.key)) { event.preventDefault(); scrollToPage(current + 1); }
      else if (["ArrowUp", "PageUp"].includes(event.key)) { event.preventDefault(); scrollToPage(current - 1); }
      else if (event.key === "Home") { event.preventDefault(); scrollToPage(0); }
      else if (event.key === "End") { event.preventDefault(); scrollToPage(HOME_PAGE_COUNT - 1); }
    };
    root.addEventListener("scroll", onScroll, { passive: true }); root.addEventListener("wheel", onWheel, { passive: false }); root.addEventListener("keydown", onKeyDown);
    return () => { window.clearTimeout(scrollTimer); window.clearTimeout(wheelTimer); root.removeEventListener("scroll", onScroll); root.removeEventListener("wheel", onWheel); root.removeEventListener("keydown", onKeyDown); };
  }, [scrollToPage]);

  useEffect(() => {
    const root = scrollRef.current, canvas = canvasRef.current;
    if (!root || !canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0, paused = reducedMotion.matches || document.hidden, previousTime = 0;
    const shell = root, drawingCanvas = canvas, ctx = context;
    function bounds() { return { width: shell.clientWidth, height: shell.clientHeight, padding: 16 }; }
    function stageRect(): BubbleRect {
      const stage = shell.querySelector<HTMLElement>(".home-stage-content")?.getBoundingClientRect(), box = shell.getBoundingClientRect();
      return stage ? { left: stage.left-box.left, top: stage.top-box.top, right: stage.right-box.left, bottom: stage.bottom-box.top } : { left:shell.clientWidth/2-130,top:shell.clientHeight/2-70,right:shell.clientWidth/2+130,bottom:shell.clientHeight/2+70 };
    }
    function syncColors() {
      shell.querySelectorAll<HTMLElement>("[data-bubble-index]").forEach((element) => {
        const bubble = bubbles[Number(element.dataset.bubbleIndex)]; if (!bubble) return;
        const color = deriveBubbleColor(bubble, accent, bubbleColorRange);
        element.style.setProperty("--bubble-gradient", `radial-gradient(circle at 30% 25%,${color.highlight},${color.base} 72%,${color.shadow})`);
        element.style.setProperty("--bubble-text", color.text);
      });
    }
    function draw() {
      ctx.clearRect(0,0,shell.clientWidth,shell.clientHeight);
      particlesRef.current.forEach((particle) => {
        const tint = `hsla(${particle.gradientAngle},85%,65%,`;
        const gradient = ctx.createRadialGradient(particle.x-particle.radius*.3,particle.y-particle.radius*.36,particle.radius*.04,particle.x,particle.y,particle.radius);
        gradient.addColorStop(0,`${tint}.38)`); gradient.addColorStop(.68,`${tint}.22)`); gradient.addColorStop(1,`${tint}.08)`);
        ctx.beginPath(); ctx.arc(particle.x,particle.y,particle.radius,0,Math.PI*2); ctx.fillStyle=gradient; ctx.fill(); ctx.strokeStyle=`hsla(${particle.gradientAngle},90%,82%,.52)`; ctx.lineWidth=1; ctx.stroke();
      });
    }
    function resize() {
      const ratio = Math.min(window.devicePixelRatio||1,2);
      drawingCanvas.width=Math.round(shell.clientWidth*ratio); drawingCanvas.height=Math.round(shell.clientHeight*ratio);
      drawingCanvas.style.width=`${shell.clientWidth}px`; drawingCanvas.style.height=`${shell.clientHeight}px`; ctx.setTransform(ratio,0,0,ratio,0,0);
      particlesRef.current=placeBubbleParticles(bubbles,bounds(),stageRect()); syncColors(); draw();
    }
    function animate(time: number) {
      frame=0; if (paused) return;
      const elapsed=Math.min((time-(previousTime||time))/1000,.05); previousTime=time;
      const activity=activityRef.current/100, pointer=pointerRef.current;
      if(pointer&&activity>0) for(const particle of particlesRef.current){const dx=particle.x-pointer.x,dy=particle.y-pointer.y,distance=Math.hypot(dx,dy),influence=particle.radius+112;if(distance>0&&distance<influence){const force=(1-distance/influence)*(20+34*activity)*elapsed;particle.vx+=dx/distance*force;particle.vy+=dy/distance*force;}}
      if(activity>0)advanceParticles(particlesRef.current,elapsed*(.45+activity*1.1),bounds(),stageRect());
      particlesRef.current.forEach((particle,index)=>{const element=shell.querySelector<HTMLElement>(`[data-bubble-index="${index}"]`);if(!element)return;element.style.setProperty("--bubble-x",`${particle.x-particle.radius}px`);element.style.setProperty("--bubble-y",`${particle.y-particle.radius}px`);element.style.setProperty("--squash-angle",`${particle.squashAngle}rad`);element.style.setProperty("--squash-x",`${1+particle.squash}px`);element.style.setProperty("--squash-y",`${1-particle.squash}px`);element.style.setProperty("--bubble-ready","1");});
      draw(); frame=window.requestAnimationFrame(animate);
    }
    const syncMotion=()=>{paused=reducedMotion.matches||document.hidden;if(paused){window.cancelAnimationFrame(frame);frame=0;}else if(!frame)frame=window.requestAnimationFrame(animate);};
    reducedMotion.addEventListener("change",syncMotion); document.addEventListener("visibilitychange",syncMotion);
    const observer=new ResizeObserver(resize);observer.observe(shell);resize();if(!paused)frame=window.requestAnimationFrame(animate);
    return()=>{observer.disconnect();reducedMotion.removeEventListener("change",syncMotion);document.removeEventListener("visibilitychange",syncMotion);window.cancelAnimationFrame(frame);};
  },[accent,bubbleColorRange,bubbles]);

  const onPointerMove=(event:PointerEvent<HTMLElement>)=>{const rect=event.currentTarget.getBoundingClientRect();pointerRef.current={x:event.clientX-rect.left,y:event.clientY-rect.top};};
  const pageStyle={"--accent":accent} as CSSProperties;
  return <main className="home-scroll-shell" ref={scrollRef} tabIndex={0} onPointerMove={onPointerMove} onPointerLeave={()=>{pointerRef.current=null;}} style={pageStyle}>
    <section className="home-page home-hero" aria-label="首页"><div className="home-backgrounds" aria-hidden="true">{backgrounds.map((src,index)=><div key={src} className={`home-background-layer ${index===backgroundIndex?"is-active":""}`} style={{backgroundImage:`url("${src}")`}} />)}</div><div className="home-scrim" aria-hidden="true"/><canvas className="home-bubble-canvas" ref={canvasRef} aria-hidden="true"/><div className="home-bubble-field" aria-hidden="true">{bubbles.map((bubble,index)=><div key={bubble.id} className="home-bubble-float" data-bubble-index={index} style={{"--bubble-size":`${responsiveBubbleSize(bubble,1200)}px`} as CSSProperties}><div className="home-bubble"><span className="home-bubble-label">{bubble.term}</span></div></div>)}</div><header className="home-nav" aria-label="个人主页"><span>JXM · PERSONAL SPACE</span><AppearanceControl /></header><div className="home-stage"><div className="home-stage-content"><h1>喵喵喵喵</h1><p>让每一次对话，都成为新的灵感入口。</p><button className="home-launch" type="button" onClick={()=>scrollToPage(1)}>了解这个项目</button></div></div><button className="home-explore-cue" type="button" onClick={()=>scrollToPage(1)}>向下探索 <ChevronDown size={15}/></button></section>
    <section className="home-page home-about" aria-label="关于我"><div className="home-about-stars" aria-hidden="true"><div className="home-nebula home-nebula-far"/><div className="home-nebula home-nebula-mid"/><div className="home-nebula home-nebula-dust"/>{HOME_STAR_POINTS.map((star,index)=><i key={index} className={`home-star home-star-${star.kind} home-star-color-${star.color}`} style={{left:`${star.left}%`,top:`${star.top}%`,width:star.size,height:star.size,"--star-opacity":star.opacity,"--star-delay":`${star.delay}s`,"--star-duration":`${star.duration}s`} as CSSProperties}/>)}<i className="home-meteor" style={{top:"12%",left:"66%",animationDelay:"-2s"}}/><i className="home-meteor" style={{top:"40%",left:"88%",animationDelay:"-6s"}}/></div><div className="home-day-tech" aria-hidden="true"><i className="home-day-grid"/><i className="home-day-track home-day-track-one"/><i className="home-day-track home-day-track-two"/><i className="home-day-track home-day-track-three"/><i className="home-day-track home-day-track-four"/></div><div className="home-about-content"><section className="home-about-author"><span className="home-section-kicker">ABOUT THE CREATOR</span><div className="home-author-avatar-frame">{avatarAvailable?<NextImage className="home-author-avatar" src={HOME_AUTHOR_PROFILE.avatarSrc} alt={`${HOME_AUTHOR_PROFILE.name}头像`} width={132} height={132} onError={()=>setAvatarAvailable(false)}/>:<span className="home-author-avatar-fallback"><WandSparkles size={30}/></span>}</div><h2>{HOME_AUTHOR_PROFILE.name}</h2><p>{HOME_AUTHOR_PROFILE.bio}</p><nav className="home-author-links" aria-label="作者链接"><a href={HOME_AUTHOR_PROFILE.githubUrl} target="_blank" rel="noreferrer"><Github size={15}/>GitHub<ArrowUpRight size={13}/></a><a href={HOME_AUTHOR_PROFILE.bilibiliUrl} target="_blank" rel="noreferrer"><ArrowUpRight size={14}/>哔哩哔哩</a><a href={HOME_AUTHOR_PROFILE.csdnUrl} target="_blank" rel="noreferrer"><ArrowUpRight size={14}/>CSDN</a></nav></section><section className="home-about-project"><span className="home-section-kicker">LUGUAN LUGUAN</span><h2>棍木棍木棍木</h2><p className="home-project-lead">棍木棍木棍木</p><ul className="home-feature-list">{HOME_FEATURES.map(({icon:Icon,title,description},index)=><li key={index}><Icon size={18}/><span><strong>{title}</strong><small>{description}</small></span></li>)}</ul></section></div><button className="home-explore-cue" type="button" onClick={()=>scrollToPage(2)}>继续探索 <ChevronDown size={15}/></button></section>
    <section className="home-page home-placeholder" aria-label="更多功能"><div className="home-placeholder-content"><span className="home-placeholder-icon"><Settings2 size={30}/></span><span className="home-section-kicker">WHAT&apos;S NEXT</span><h2>更多可能，正在路上</h2><p>新的想法仍在生长，期待下一次与你见面。</p></div><button className="home-explore-cue" type="button" onClick={()=>scrollToPage(0)}>回到首页 <ChevronDown size={15}/></button></section>
    <nav className="home-page-dots" aria-label="页面导航">{PAGE_LABELS.map((label,index)=><button key={label} type="button" className={activePage===index?"is-active":""} aria-current={activePage===index?"page":undefined} aria-label={`跳转至${label}`} onClick={()=>scrollToPage(index)}><span>{String(index+1).padStart(2,"0")} {label}</span></button>)}</nav>
  </main>;
}
