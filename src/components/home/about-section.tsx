import { useState } from "react";
import NextImage from "next/image";
import { ArrowUpRight, Bot, ChevronDown, Github, Image as ImageIcon, Layers3, MessageSquareText, WandSparkles, type LucideIcon } from "lucide-react";
import { HOME_COPY, HOME_FEATURES, type HomeFeatureIcon } from "@/content/home";
import { HOME_AUTHOR_PROFILE } from "@/content/profile";
import { StarField } from "@/components/home/star-field";

const FEATURE_ICONS: Record<HomeFeatureIcon, LucideIcon> = {
  bot: Bot,
  chat: MessageSquareText,
  image: ImageIcon,
  layers: Layers3,
};

type AboutSectionProps = { onExplore: () => void };

export function AboutSection({ onExplore }: AboutSectionProps) {
  const [avatarAvailable, setAvatarAvailable] = useState(true);

  return (
    <section className="home-page home-about" aria-label="关于我">
      <StarField />
      <div className="home-about-content">
        <section className="home-about-author">
          <span className="home-section-kicker">{HOME_COPY.authorKicker}</span>
          <div className="home-author-avatar-frame">
            {avatarAvailable ? (
              <NextImage
                className="home-author-avatar"
                src={HOME_AUTHOR_PROFILE.avatarSrc}
                alt={`${HOME_AUTHOR_PROFILE.name}头像`}
                width={132}
                height={132}
                onError={() => setAvatarAvailable(false)}
              />
            ) : (
              <span className="home-author-avatar-fallback"><WandSparkles size={30} /></span>
            )}
          </div>
          <h2>{HOME_AUTHOR_PROFILE.name}</h2>
          <p>{HOME_AUTHOR_PROFILE.bio}</p>
          <nav className="home-author-links" aria-label="作者链接">
            <a href={HOME_AUTHOR_PROFILE.githubUrl} target="_blank" rel="noreferrer">
              <Github size={15} />GitHub<ArrowUpRight size={13} />
            </a>
            <a href={HOME_AUTHOR_PROFILE.bilibiliUrl} target="_blank" rel="noreferrer">
              <ArrowUpRight size={14} />哔哩哔哩
            </a>
            <a href={HOME_AUTHOR_PROFILE.csdnUrl} target="_blank" rel="noreferrer">
              <ArrowUpRight size={14} />CSDN
            </a>
          </nav>
        </section>
        <section className="home-about-project">
          <span className="home-section-kicker">{HOME_COPY.projectKicker}</span>
          <h2>{HOME_COPY.projectTitle}</h2>
          <p className="home-project-lead">{HOME_COPY.projectLead}</p>
          <ul className="home-feature-list">
            {HOME_FEATURES.map(({ icon, title, description }, index) => {
              const Icon = FEATURE_ICONS[icon];
              return (
                <li key={index}>
                  <Icon size={18} />
                  <span><strong>{title}</strong><small>{description}</small></span>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
      <button className="home-explore-cue" type="button" onClick={onExplore}>
        {HOME_COPY.aboutExplore} <ChevronDown size={15} />
      </button>
    </section>
  );
}
