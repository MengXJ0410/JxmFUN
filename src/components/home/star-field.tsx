import type { CSSProperties } from "react";
import { HOME_STAR_POINTS } from "@/lib/home/starfield";

export function StarField() {
  return (
    <>
      <div className="home-about-stars" aria-hidden="true">
        <div className="home-nebula home-nebula-far" />
        <div className="home-nebula home-nebula-mid" />
        <div className="home-nebula home-nebula-dust" />
        {HOME_STAR_POINTS.map((star, index) => (
          <i
            key={index}
            className={`home-star home-star-${star.kind} home-star-color-${star.color}`}
            style={{
              left: `${star.left}%`,
              top: `${star.top}%`,
              width: star.size,
              height: star.size,
              "--star-opacity": star.opacity,
              "--star-delay": `${star.delay}s`,
              "--star-duration": `${star.duration}s`,
            } as CSSProperties}
          />
        ))}
        <i className="home-meteor" style={{ top: "12%", left: "66%", animationDelay: "-2s" }} />
        <i className="home-meteor" style={{ top: "40%", left: "88%", animationDelay: "-6s" }} />
      </div>
      <div className="home-day-tech" aria-hidden="true">
        <i className="home-day-grid" />
        <i className="home-day-track home-day-track-one" />
        <i className="home-day-track home-day-track-two" />
        <i className="home-day-track home-day-track-three" />
        <i className="home-day-track home-day-track-four" />
      </div>
    </>
  );
}
