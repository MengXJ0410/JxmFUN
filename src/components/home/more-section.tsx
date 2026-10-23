import { ChevronDown, Settings2 } from "lucide-react";
import { HOME_COPY } from "@/content/home";

type MoreSectionProps = { onHome: () => void };

export function MoreSection({ onHome }: MoreSectionProps) {
  return (
    <section className="home-page home-placeholder" aria-label="更多功能">
      <div className="home-placeholder-content">
        <span className="home-placeholder-icon"><Settings2 size={30} /></span>
        <span className="home-section-kicker">{HOME_COPY.moreKicker}</span>
        <h2>{HOME_COPY.moreTitle}</h2>
        <p>{HOME_COPY.moreDescription}</p>
      </div>
      <button className="home-explore-cue" type="button" onClick={onHome}>
        {HOME_COPY.moreCta} <ChevronDown size={15} />
      </button>
    </section>
  );
}
