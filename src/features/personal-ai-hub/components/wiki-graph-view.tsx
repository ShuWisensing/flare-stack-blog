import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { ArrowLeft, BookOpen, Network, RefreshCw, X } from "lucide-react";
import { useEffect, useState } from "react";
import * as Api from "../api/hub-chat.admin.api";
import { nodePresentation } from "../graph-presentation";
import type { HubGraphEdge } from "../schema/hub-chat.schema";
import { unwrapHubResult } from "../schema/personal-ai-hub.schema";
import type { HubLocation, HubNavigation } from "./hub-app";
import { HubErrorNotice } from "./hub-feedback";
import { HubMarkdown } from "./hub-markdown";
import { WikiGraphCanvas } from "./wiki-graph-canvas";

function useDebounced(value: string) {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), 250);
    return () => clearTimeout(timer);
  }, [value]);
  return settled;
}
const nodeTypes: Record<string, string> = Object.fromEntries(
  Object.entries(nodePresentation).map(([kind, entry]) => [kind, entry.name]),
);
const relationTypes: Record<string, string> = {
  has_summary: "包含摘要",
  has_chunk: "包含片段",
  has_asset: "包含资源",
  wiki_link: "页面链接",
  cites: "引用资料",
};

function NodeReader({
  nodeId,
  revision,
  preview,
  onNode,
  onRead,
  onGraph,
  onClose,
}: {
  nodeId: string;
  revision?: string;
  preview?: boolean;
  onNode: (node: string) => void;
  onRead?: () => void;
  onGraph: () => void;
  onClose?: () => void;
}) {
  const detail = useInfiniteQuery({
    queryKey: ["hub-v2", "wiki-node", nodeId, revision],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) =>
      unwrapHubResult(
        await Api.getWikiNodeFn({
          data: { node_id: nodeId, revision, cursor: pageParam },
        }),
      ),
    getNextPageParam: (page) => page.next_cursor ?? undefined,
    retry: false,
  });
  const first = detail.data?.pages[0];
  const content = useInfiniteQuery({
    queryKey: ["hub-v2", "wiki-content", nodeId, first?.revision],
    enabled: Boolean(first?.node.content_available),
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) =>
      unwrapHubResult(
        await Api.getWikiContentFn({
          data: {
            node_id: nodeId,
            revision: first?.revision,
            cursor: pageParam,
          },
        }),
      ),
    getNextPageParam: (page) => page.next_cursor ?? undefined,
    retry: false,
  });
  const text = content.data?.pages.map((page) => page.content).join("");
  const storedMarkdown =
    first?.node.content_type === "wiki_markdown" ||
    first?.node.content_type === "summary_markdown";
  const header =
    storedMarkdown && text
      ? /^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/.exec(text)?.[0]
      : undefined;
  const incompleteHeader =
    storedMarkdown && /^---\r?\n/.test(text ?? "") && !header;
  const body = incompleteHeader
    ? undefined
    : header
      ? text?.slice(header.length).trimStart()
      : text;
  const displayText =
    body !== undefined &&
    first &&
    body.split("\n")[0].trimEnd() === `# ${first.node.title}`
      ? body.slice(body.indexOf("\n") + 1).trimStart()
      : body;
  const neighbors = Array.from(
    new Map(
      detail.data?.pages
        .flatMap((page) => page.neighbors)
        .map((node) => [node.id, node]),
    ).values(),
  );
  const plain =
    first?.node.content_type === "chunk_text" ||
    first?.node.content_type === "asset_text";
  return (
    <section
      className={preview ? "hub-node-preview" : "hub-reader"}
      aria-label={preview ? "节点预览" : "知识阅读页"}
    >
      <div className="hub-row">
        <span className="hub-node-type">
          {first
            ? (nodeTypes[first.node.kind] ?? first.node.kind)
            : "读取节点…"}
        </span>
        {onClose && (
          <button type="button" aria-label="关闭节点" onClick={onClose}>
            <X size={17} />
          </button>
        )}
      </div>
      {first && (
        <>
          <h2>{first.node.title}</h2>
          <div className="hub-node-actions">
            {onRead && (
              <button type="button" onClick={onRead}>
                打开阅读页
              </button>
            )}
            <button type="button" onClick={onGraph}>
              在图中定位
            </button>
          </div>
          {!first.node.content_available && (
            <p className="hub-error">
              已登记正文暂不可读，请在本机检查文件和目录。
            </p>
          )}
          {incompleteHeader && (
            <p className="hub-muted">知识页头尚未读取完整，请继续读取正文。</p>
          )}
          {displayText !== undefined &&
            (plain ? (
              <div className="hub-user-text">
                {preview ? displayText.slice(0, 1800) : displayText}
              </div>
            ) : (
              <HubMarkdown
                content={preview ? displayText.slice(0, 1800) : displayText}
                links={content.data?.pages[0].links}
                onNode={onNode}
              />
            ))}
          {text === "" && <p className="hub-muted">当前记录没有已提取文字。</p>}
          {first.node.source_url &&
            /^https?:\/\//i.test(first.node.source_url) && (
              <a
                href={first.node.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="hub-inline-link"
              >
                原始链接
              </a>
            )}
          {header && (
            <details className="hub-node-metadata">
              <summary>资料信息</summary>
              <pre>{header}</pre>
            </details>
          )}
          {preview && displayText && displayText.length > 1800 && (
            <p className="hub-muted">预览仅显示开头，完整内容请进入阅读页。</p>
          )}
          {!preview && content.hasNextPage && (
            <button
              type="button"
              className="hub-reader-more"
              disabled={content.isFetchingNextPage}
              onClick={() => void content.fetchNextPage()}
            >
              继续读取正文
            </button>
          )}
          {detail.data && (
            <div className="hub-node-relations">
              <h3>
                入链 {detail.data.pages.flatMap((p) => p.incoming).length} ·
                出链 {detail.data.pages.flatMap((p) => p.outgoing).length} · 共{" "}
                {first.relation_count} 条关系
              </h3>
              {neighbors.map((node) => (
                <button
                  type="button"
                  key={node.id}
                  onClick={() => onNode(node.id)}
                >
                  {node.title}
                  <small> · {nodeTypes[node.kind] ?? node.kind}</small>
                </button>
              ))}
              {detail.hasNextPage && (
                <button
                  type="button"
                  disabled={detail.isFetchingNextPage}
                  onClick={() => void detail.fetchNextPage()}
                >
                  更多关联
                </button>
              )}
            </div>
          )}
          {first.issues.length > 0 && (
            <details className="hub-message-details">
              <summary>数据问题 {first.issues.length} 项</summary>
              <div className="hub-detail-scroll">
                {first.issues.map((issue, index) => (
                  <p key={String(issue.reason) + index}>
                    {String(issue.reason)}
                    {typeof issue.target === "string"
                      ? `：${issue.target}`
                      : ""}
                  </p>
                ))}
              </div>
            </details>
          )}
        </>
      )}
      <HubErrorNotice
        error={detail.error ?? content.error}
        retry={() => {
          void detail.refetch();
          void content.refetch();
        }}
      />
    </section>
  );
}

function SourceLibrary({ onNode }: { onNode: (id: string) => void }) {
  const [query, setQuery] = useState("");
  const settled = useDebounced(query);
  const sources = useInfiniteQuery({
    queryKey: ["hub-v2", "source-library", settled],
    initialPageParam: undefined as
      | { cursor: string; revision: string }
      | undefined,
    queryFn: async ({ pageParam }) =>
      unwrapHubResult(
        await Api.searchWikiGraphFn({
          data: {
            scope: "evidence",
            kinds: "source",
            q: settled,
            cursor: pageParam?.cursor,
            revision: pageParam?.revision,
          },
        }),
      ),
    getNextPageParam: (page) =>
      page.next_cursor
        ? { cursor: page.next_cursor, revision: page.revision }
        : undefined,
    retry: false,
  });
  return (
    <>
      <div className="hub-graph-toolbar">
        <BookOpen size={15} />
        <strong>资料库</strong>
        <input
          aria-label="搜索资料"
          placeholder="搜索资料名称"
          maxLength={200}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <span className="hub-muted">只读浏览 · 摘要与已解析内容</span>
      </div>
      <div className="hub-sources">
        <div className="hub-sources-grid">
          {sources.data?.pages
            .flatMap((page) => page.items)
            .map((node) => (
              <button
                type="button"
                className="hub-source-card"
                key={node.id}
                onClick={() => onNode(node.id)}
              >
                <BookOpen size={18} />
                <h3>{node.title}</h3>
                <p>查看概况、摘要与关联片段</p>
              </button>
            ))}
        </div>
        {sources.isPending && <p className="hub-muted">读取本地资料…</p>}
        {sources.data?.pages[0].total === 0 && (
          <p className="hub-muted">没有找到匹配的资料。</p>
        )}
        <HubErrorNotice
          error={sources.error}
          retry={() => void sources.refetch()}
        />
        {sources.hasNextPage && (
          <button
            type="button"
            className="hub-reader-more"
            disabled={sources.isFetchingNextPage}
            onClick={() => void sources.fetchNextPage()}
          >
            更多资料
          </button>
        )}
      </div>
    </>
  );
}

export function WikiGraphView({
  location,
  navigate,
}: {
  location: HubLocation;
  navigate: HubNavigation;
}) {
  const [query, setQuery] = useState("");
  const settled = useDebounced(query);
  const [depth, setDepth] = useState(1);
  const [kinds, setKinds] = useState("");
  const [relations, setRelations] = useState("");
  const [isolated, setIsolated] = useState(true);
  const [revision, setRevision] = useState<string | undefined>();
  const [edge, setEdge] = useState<HubGraphEdge | null>(null);
  const graph = useQuery({
    queryKey: [
      "hub-v2",
      "graph",
      location.scope,
      location.node,
      depth,
      kinds,
      relations,
      isolated,
      revision,
    ],
    enabled: location.view === "graph",
    retry: false,
    queryFn: async () =>
      unwrapHubResult(
        await Api.getWikiGraphFn({
          data: {
            scope: location.scope,
            center_id: location.node,
            depth,
            kinds: kinds || undefined,
            relations: relations || undefined,
            include_isolated: isolated,
            revision,
          },
        }),
      ),
  });
  const searches = useInfiniteQuery({
    queryKey: [
      "hub-v2",
      "graph-search",
      location.scope,
      settled,
      kinds,
      graph.data?.revision,
    ],
    enabled: location.view === "graph" && Boolean(settled),
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) =>
      unwrapHubResult(
        await Api.searchWikiGraphFn({
          data: {
            scope: location.scope,
            q: settled,
            kinds: kinds || undefined,
            revision: graph.data?.revision,
            cursor: pageParam,
          },
        }),
      ),
    getNextPageParam: (page) => page.next_cursor ?? undefined,
    retry: false,
  });
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setEdge(null);
        navigate({ ...location, node: undefined, view: "graph" });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [location, navigate]);
  const selectNode = (node: string) => {
    setRevision(graph.data?.revision ?? revision);
    setQuery("");
    setEdge(null);
    navigate({
      ...location,
      scope: node.startsWith("wiki:") ? "knowledge" : "evidence",
      node,
    });
  };
  const readNode = (node: string) => {
    setQuery("");
    setEdge(null);
    navigate({ ...location, view: "reader", node });
  };
  const toGraph = (node: string) =>
    navigate({
      ...location,
      view: "graph",
      node,
      scope: node.startsWith("wiki:") ? "knowledge" : "evidence",
    });
  const refresh = () => {
    setEdge(null);
    if (revision !== undefined) setRevision(undefined);
    else void graph.refetch();
  };
  return (
    <div className="hub-graph-view">
      {location.view === "sources" ? (
        <SourceLibrary onNode={readNode} />
      ) : location.view === "reader" && location.node ? (
        <>
          <div className="hub-graph-toolbar">
            <button
              type="button"
              onClick={() => navigate({ ...location, view: "graph" })}
            >
              <ArrowLeft size={15} />
              返回图谱
            </button>
          </div>
          <NodeReader
            key={location.node}
            nodeId={location.node}
            revision={revision}
            onNode={readNode}
            onGraph={() => toGraph(location.node as string)}
          />
        </>
      ) : (
        <>
          <div className="hub-graph-legend" aria-label="节点类型说明">
            <span className="hub-muted">节点类型</span>
            {Object.entries(nodePresentation)
              .filter(([kind]) =>
                location.scope === "evidence"
                  ? ["source", "summary", "chunk", "asset"].includes(kind)
                  : !["summary", "chunk", "asset"].includes(kind),
              )
              .map(([kind, entry]) => (
                <span key={kind} title={entry.description}>
                  <i style={{ backgroundColor: entry.color }} />
                  {entry.name}
                  <small>
                    {graph.data?.nodes.filter((node) => node.kind === kind)
                      .length ?? 0}
                  </small>
                </span>
              ))}
          </div>
          <div className="hub-graph-toolbar">
            <Network size={16} />
            <select
              aria-label="图谱范围"
              value={location.scope}
              onChange={(event) => {
                setRevision(undefined);
                setEdge(null);
                setQuery("");
                setKinds("");
                setRelations("");
                navigate({
                  ...location,
                  scope: event.target.value as "knowledge" | "evidence",
                  node: undefined,
                });
              }}
            >
              <option value="knowledge">知识网络</option>
              <option value="evidence">资料结构</option>
            </select>
            <input
              aria-label="搜索知识节点"
              placeholder="搜索全部节点…"
              value={query}
              maxLength={200}
              onChange={(event) => setQuery(event.target.value)}
            />
            <select
              aria-label="节点类型"
              value={kinds}
              onChange={(event) => setKinds(event.target.value)}
            >
              <option value="">全部类型</option>
              {graph.data?.available_kinds.map((kind) => (
                <option value={kind} key={kind}>
                  {nodeTypes[kind] ?? kind}
                </option>
              ))}
            </select>
            <select
              aria-label="关系类型"
              value={relations}
              onChange={(event) => setRelations(event.target.value)}
            >
              <option value="">全部关系</option>
              {graph.data?.available_relations.map((kind) => (
                <option value={kind} key={kind}>
                  {relationTypes[kind] ?? kind}
                </option>
              ))}
            </select>
            {location.node && (
              <select
                aria-label="局部图深度"
                value={depth}
                onChange={(event) => setDepth(Number(event.target.value))}
              >
                <option value={1}>一跳关系</option>
                <option value={2}>两跳关系</option>
              </select>
            )}
            <label>
              <input
                type="checkbox"
                checked={isolated}
                onChange={(event) => setIsolated(event.target.checked)}
              />
              孤立节点
            </label>
            <button type="button" aria-label="刷新图谱" onClick={refresh}>
              <RefreshCw size={15} />
            </button>
            {location.node && (
              <button
                type="button"
                onClick={() => {
                  setEdge(null);
                  navigate({ ...location, node: undefined });
                }}
              >
                全局图
              </button>
            )}
          </div>
          <HubErrorNotice error={graph.error} retry={refresh} />
          <div className="hub-graph-body">
            {graph.data?.nodes.length ? (
              <WikiGraphCanvas
                graph={graph.data}
                center={location.node}
                onNode={selectNode}
                onEdge={setEdge}
              />
            ) : (
              <div className="hub-welcome">
                <span className="hub-welcome-icon">
                  <Network size={27} />
                </span>
                <h2>
                  {graph.isPending
                    ? "正在读取知识关系"
                    : location.scope === "knowledge"
                      ? "尚无已登记的知识节点"
                      : "当前范围没有匹配节点"}
                </h2>
                {graph.data && (
                  <>
                    <p>
                      {location.scope === "knowledge"
                        ? "资料已入库，实体与概念页面尚未建立。你可以先浏览现有资料及其关联。"
                        : "可以清除筛选、返回全局图，或到资料库查找内容。"}
                    </p>
                    {location.scope === "knowledge" && (
                      <button
                        type="button"
                        className="hub-primary"
                        onClick={() => {
                          setRevision(undefined);
                          navigate({
                            ...location,
                            scope: "evidence",
                            node: undefined,
                          });
                        }}
                      >
                        查看资料结构
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
            {Boolean(settled) && (
              <div
                className="hub-graph-search-results"
                aria-label="完整范围搜索结果"
              >
                {searches.data?.pages
                  .flatMap((page) => page.items)
                  .map((node) => (
                    <button
                      type="button"
                      key={node.id}
                      onClick={() => selectNode(node.id)}
                    >
                      {node.title}
                      <small>{nodeTypes[node.kind] ?? node.kind}</small>
                    </button>
                  ))}
                {searches.data?.pages[0].total === 0 && (
                  <p className="hub-muted">没有匹配节点</p>
                )}
                <HubErrorNotice error={searches.error} />
                {searches.hasNextPage && (
                  <button
                    type="button"
                    onClick={() => void searches.fetchNextPage()}
                  >
                    更多搜索结果
                  </button>
                )}
              </div>
            )}
            {location.node && !edge && (
              <NodeReader
                key={location.node}
                nodeId={location.node}
                revision={graph.data?.revision}
                preview
                onNode={selectNode}
                onRead={() => readNode(location.node as string)}
                onGraph={() => toGraph(location.node as string)}
                onClose={() => navigate({ ...location, node: undefined })}
              />
            )}
            {edge && (
              <section className="hub-node-preview">
                <div className="hub-row">
                  <h2>关系依据</h2>
                  <button
                    type="button"
                    aria-label="关闭关系"
                    onClick={() => setEdge(null)}
                  >
                    <X size={16} />
                  </button>
                </div>
                <p>{edge.kind}</p>
                <div className="hub-node-actions">
                  <button type="button" onClick={() => selectNode(edge.source)}>
                    查看起点
                  </button>
                  <button type="button" onClick={() => selectNode(edge.target)}>
                    查看终点
                  </button>
                </div>
                {edge.evidence_refs.map((ref, index) => (
                  <p key={String(ref.node_id) + index} className="hub-muted">
                    {typeof ref.node_id === "string" && (
                      <button
                        type="button"
                        onClick={() => readNode(ref.node_id as string)}
                      >
                        打开来源
                      </button>
                    )}
                    {typeof ref.line === "number" ? ` · 第 ${ref.line} 行` : ""}
                    {typeof ref.field === "string"
                      ? ` · 字段 ${ref.field}`
                      : ""}
                  </p>
                ))}
              </section>
            )}
          </div>
          {graph.data && (
            <div className="hub-graph-status">
              <span>
                {graph.data.visible_nodes} / {graph.data.matching_nodes} 节点 ·{" "}
                {graph.data.visible_edges} / {graph.data.matching_edges} 关系
              </span>
              {graph.data.clipped && (
                <strong>当前为部分关系，请搜索或缩小范围</strong>
              )}
              {graph.error && <strong>当前为旧快照，连接或版本异常</strong>}
              <details>
                <summary>节点列表与数据质量</summary>
                <div className="hub-detail-scroll">
                  {graph.data.nodes.map((node) => (
                    <button
                      type="button"
                      key={node.id}
                      className="block py-1"
                      onClick={() => selectNode(node.id)}
                    >
                      {node.title}
                    </button>
                  ))}
                  <p>
                    数据问题 {graph.data.issues.length} 项 · 实体{" "}
                    {graph.data.coverage.entities} · 概念{" "}
                    {graph.data.coverage.concepts}
                  </p>
                </div>
              </details>
            </div>
          )}
        </>
      )}
    </div>
  );
}
