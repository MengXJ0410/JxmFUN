import { type CSSProperties, type RefObject } from "react";
import { ChevronDown } from "lucide-react";
import { AppearanceControl } from "@/components/home/appearance-control";
import { HOME_COPY } from "@/content/home";
import { responsiveBubbleSize, type BubbleVisual } from "@/lib/home/bubbles";

type HeroSectionProps = {
  backgrounds: string[];
  backgroundIndex: number;
  bubbles: BubbleVisual[];
  canvasRef: RefObject<HTMLCanvasElement | null>;
  onExplore: () => void;
};

export function HeroSection({ backgrounds, backgroundIndex, bubbles, canvasRef, onExplore }: HeroSectionProps) {
  return (
    <section className="home-page home-hero" aria-label="首页">
      <div className="home-backgrounds" aria-hidden="true">
        {backgrounds.map((src, index) => (
          <div
            key={src}
            className={`home-background-layer ${index === backgroundIndex ? "is-active" : ""}`}
            style={{ backgroundImage: `url("${src}")` }}
          />
        ))}
      </div>
      <div className="home-scrim" aria-hidden="true" />
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
      <button className="home-explore-cue" type="button" onClick={onExplore}>
        {HOME_COPY.heroExplore} <ChevronDown size={15} />
      </button>
    </section>
  );
}
