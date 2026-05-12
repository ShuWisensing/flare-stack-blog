import { useNavigate } from "@tanstack/react-router";
import { List } from "lucide-react";
import type { TableOfContentsItem } from "@/features/posts/utils/toc";

interface InlineTableOfContentsProps {
  headers: Array<TableOfContentsItem>;
  title: string;
}

function cleanHeadingText(text: string) {
  return text.endsWith("#") ? text.slice(0, -1) : text;
}

export function InlineTableOfContents({
  headers,
  title,
}: InlineTableOfContentsProps) {
  const navigate = useNavigate();
  const items = headers
    .map((heading) => ({
      ...heading,
      text: cleanHeadingText(heading.text).trim(),
    }))
    .filter((heading) => heading.text && heading.text !== title);

  if (items.length < 3) return null;

  const minLevel = Math.min(...items.map((item) => item.level));

  return (
    <nav className="mb-8 rounded-2xl border border-black/5 bg-black/[0.015] p-4 dark:border-white/10 dark:bg-white/[0.03]">
      <div className="mb-3 flex items-center gap-2 fuwari-text-50">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[oklch(0.89_0.050_var(--fuwari-hue))] text-(--fuwari-btn-content) dark:bg-(--fuwari-btn-regular-bg)">
          <List size={15} strokeWidth={1.8} />
        </div>
        <span className="text-sm font-semibold">本文目录</span>
      </div>

      <div className="flex flex-wrap gap-2">
        {items.map((heading) => (
          <a
            key={heading.id}
            href={`#${heading.id}`}
            onClick={(event) => {
              event.preventDefault();
              const element = document.getElementById(heading.id);
              if (!element) return;

              const top =
                element.getBoundingClientRect().top + window.scrollY - 80;
              window.scrollTo({ top, behavior: "smooth" });
              navigate({ hash: heading.id, replace: true });
            }}
            className="rounded-xl bg-[oklch(0.89_0.050_var(--fuwari-hue))] px-3 py-1.5 text-sm text-(--fuwari-btn-content) transition hover:brightness-95 active:scale-[0.98] dark:bg-(--fuwari-btn-regular-bg)"
            style={{
              marginLeft: `${Math.max(heading.level - minLevel, 0) * 0.5}rem`,
            }}
          >
            {heading.text}
          </a>
        ))}
      </div>
    </nav>
  );
}
