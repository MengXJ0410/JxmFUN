import { type CSSProperties, type RefObject } from "react";
import { ArrowLeft, ChevronDown } from "lucide-react";
import { AppearanceControl } from "@/components/home/appearance-control";
import { HOME_COPY } from "@/content/home";
import { responsiveBubbleSize, type BubbleVisual } from "@/lib/home/bubbles";
import type { BackgroundEnvironment } from "@/lib/home/backgrounds";

type HeroSectionProps = {
  backgroundSrc: string | null;
  environment: BackgroundEnvironment;
  bubbles: BubbleVisual[];
  canvasRef: RefObject<HTMLCanvasElement | null>;
  onExplore: () => void;
  onReturnToGate: () => void;
  returning: boolean;
};

export function HeroSection({ backgroundSrc, environment, bubbles, canvasRef, onExplore, onReturnToGate, returning }: HeroSectionProps) {
  return (
    <section className={`home-page home-hero home-theme-${environment.theme}${backgroundSrc ? " has-background" : ""}`} aria-label="首页">
      <div className="home-backgrounds" aria-hidden="true">
        {backgroundSrc ? (
          <div
            key={backgroundSrc}
            className="home-background-layer is-active"
            style={{ backgroundImage: `url("${backgroundSrc}")` }}
          />
        ) : null}
      </div>
      {backgroundSrc ? <div className="home-scrim" aria-hidden="true" /> : null}
      <canvas className="home-bubble-canvas" ref={canvasRef} aria-hidden="true" />
      <div className="home-bubble-field" aria-hidden="true">
        {bubbles.map((bubble, index) => (
          <div
            key={bubble.id}
            className="home-bubble-float"
            data-bubble-index={index}
            style={{ "--bubble-size": `${responsiveBubbleSize(bubble, 1200)}px` } as CSSProperties}
          >
            <div className="home-bubble">
              <span className="home-bubble-label">{bubble.term}</span>
            </div>
          </div>
        ))}
      </div>
      <header className="home-nav" aria-label="个人主页">
        <span>{HOME_COPY.brand}</span>
        <AppearanceControl />
      </header>
      <div className="home-stage">
        <div className="home-stage-content">
          <h1>{HOME_COPY.heroTitle}</h1>
          <p>{HOME_COPY.heroSubtitle}</p>
          <button className="home-launch" type="button" onClick={onExplore}>{HOME_COPY.heroCta}</button>
        </div>
      </div>
      <button className="home-return-gate" type="button" onClick={onReturnToGate} disabled={returning}>
        <ArrowLeft size={15} />{HOME_COPY.returnToGate}
      </button>
      <button className="home-explore-cue" type="button" onClick={onExplore}>
        {HOME_COPY.heroExplore} <ChevronDown size={15} />
      </button>
    </section>
  );
}
