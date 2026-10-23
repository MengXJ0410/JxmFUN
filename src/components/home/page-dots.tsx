import { HOME_PAGE_LABELS } from "@/content/home";

type PageDotsProps = {
  activePage: number;
  onSelect: (index: number) => void;
};

export function PageDots({ activePage, onSelect }: PageDotsProps) {
  return (
    <nav className="home-page-dots" aria-label="页面导航">
      {HOME_PAGE_LABELS.map((label, index) => (
        <button
          key={label}
          type="button"
          className={activePage === index ? "is-active" : ""}
          aria-current={activePage === index ? "page" : undefined}
          aria-label={`跳转至${label}`}
          onClick={() => onSelect(index)}
        >
          <span>{String(index + 1).padStart(2, "0")} {label}</span>
        </button>
      ))}
    </nav>
  );
}
