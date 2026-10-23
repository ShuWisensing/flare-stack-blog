export function HubCitations({
  citations,
}: {
  citations: Record<string, unknown>[];
}) {
  return (
    <div className="space-y-2 text-xs">
      <h3 className="font-medium">本次提供的知识库引用</h3>
      {citations.length === 0 && (
        <p className="text-muted-foreground">没有召回引用。</p>
      )}
      <ol className="space-y-2 break-words">
        {citations.map((citation, index) => {
          const url = typeof citation.url === "string" ? citation.url : "";
          const linked =
            URL.canParse(url) &&
            ["http:", "https:"].includes(new URL(url).protocol);
          const path =
            typeof citation.relative_path === "string"
              ? citation.relative_path
              : citation.path;
          return (
            <li key={index}>
              <span>
                [{index + 1}]{" "}
                {String(
                  path ?? citation.source_id ?? citation.wiki_page_id ?? "",
                )}
                {typeof citation.start_line === "number" &&
                  ` · 行 ${citation.start_line}–${citation.end_line}`}
                {typeof citation.heading === "string" &&
                  citation.heading &&
                  ` · ${citation.heading}`}
              </span>
              {linked && (
                <a
                  className="block underline"
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {url}
                </a>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
