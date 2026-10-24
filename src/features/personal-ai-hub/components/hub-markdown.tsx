import { Children, isValidElement, type ReactNode, useState } from "react";
import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Plugin } from "unified";

type WikiLink = { target_id: string; label: string; aliases?: string[] };
type SyntaxNode = {
  type: string;
  value?: string;
  url?: string;
  children?: SyntaxNode[];
};
const wikiLinks: Plugin<[{ links: WikiLink[] }]> = (options) => (tree) => {
  const targets = new Map<string, string | null>();
  for (const link of options.links) {
    for (const label of [link.label, link.target_id, ...(link.aliases ?? [])]) {
      const key = label.toLowerCase();
      targets.set(
        key,
        targets.has(key) && targets.get(key) !== link.target_id
          ? null
          : link.target_id,
      );
    }
  }
  function walk(node: SyntaxNode) {
    if (!node.children || node.type === "link") return;
    node.children = node.children.flatMap((child) => {
      if (child.type !== "text" || !child.value) {
        walk(child);
        return [child];
      }
      const output: SyntaxNode[] = [];
      let offset = 0;
      for (const match of child.value.matchAll(/\[\[([^\]\n]{1,256})\]\]/g)) {
        const [rawTarget, label] = match[1].split("|");
        const target = targets.get(rawTarget.split("#")[0].toLowerCase());
        if (!target) continue;
        const index = match.index ?? 0;
        output.push(
          { type: "text", value: child.value.slice(offset, index) },
          {
            type: "link",
            url: "hub-node:" + encodeURIComponent(target),
            children: [{ type: "text", value: label ?? rawTarget }],
          },
        );
        offset = index + match[0].length;
      }
      output.push({ type: "text", value: child.value.slice(offset) });
      return output;
    });
  }
  walk(tree as unknown as SyntaxNode);
};

function CodeBlock({ children }: { children?: ReactNode }) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">(
    "idle",
  );
  const code = Children.toArray(children)[0];
  const text =
    isValidElement<{ children?: ReactNode }>(code) &&
    typeof code.props.children === "string"
      ? code.props.children
      : "";
  const size = text.length;
  const block = (
    <div className="hub-code-block">
      <button
        type="button"
        className="hub-copy-code"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text);
            setCopyState("copied");
          } catch {
            setCopyState("error");
          }
        }}
      >
        {copyState === "copied" ? "已复制" : "复制代码"}
      </button>
      {copyState === "error" && (
        <small role="status">复制失败，请检查浏览器剪贴板权限。</small>
      )}
      <pre className="hub-code">{children}</pre>
    </div>
  );
  return size > 8000 ? (
    <details className="hub-long-code">
      <summary>展开代码（{size} 字符）</summary>
      {block}
    </details>
  ) : (
    block
  );
}

export function HubMarkdown({
  content,
  links = [],
  onNode,
}: {
  content: string;
  links?: WikiLink[];
  onNode?: (id: string) => void;
}) {
  return (
    <div className="hub-markdown">
      <ReactMarkdown
        skipHtml
        remarkPlugins={[remarkGfm, [wikiLinks, { links }]]}
        urlTransform={(url) =>
          url.startsWith("hub-node:")
            ? url
            : /^(https?:|#|\/[^/])/i.test(url)
              ? defaultUrlTransform(url)
              : ""
        }
        components={{
          a: ({ href, children }) => {
            if (href?.startsWith("hub-node:") && onNode)
              return (
                <button
                  type="button"
                  className="hub-inline-link"
                  onClick={() => onNode(decodeURIComponent(href.slice(9)))}
                >
                  {children}
                </button>
              );
            return href ? (
              <a href={href} target="_blank" rel="noopener noreferrer">
                {children}
              </a>
            ) : (
              <span>{children}</span>
            );
          },
          img: ({ alt }) => (
            <span className="text-muted-foreground">
              [图片：{alt || "附件"}]
            </span>
          ),
          pre: ({ children }) => <CodeBlock>{children}</CodeBlock>,
          table: ({ children }) => (
            <div className="hub-table">
              <table>{children}</table>
            </div>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
