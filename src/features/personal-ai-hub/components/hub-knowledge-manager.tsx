import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { BookOpen, FileUp, Link, Plus, X } from "lucide-react";
import { useState } from "react";
import * as Api from "../api/hub-knowledge.admin.api";
import type { KnowledgeCandidate } from "../schema/hub-knowledge.schema";
import { unwrapHubResult } from "../schema/personal-ai-hub.schema";
import { HubErrorNotice } from "./hub-feedback";

const stateLabels: Record<string, string> = {
  queued: "等待处理",
  running: "正在处理",
  completed: "已完成",
  failed: "处理失败",
  interrupted: "已中断",
};
const jobLabels: Record<string, string> = {
  ingest: "资料入库",
  extract: "知识整理",
  publish: "知识更新",
  collect: "聊天整理",
  rebuild: "知识库重建",
};
async function sha256(bytes: Uint8Array<ArrayBuffer>) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

function AddMaterial({
  close,
  saved,
  previousSourceId,
}: {
  close: () => void;
  saved: () => void;
  previousSourceId?: string;
}) {
  const [kind, setKind] = useState<"file" | "text" | "url">("file");
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File>();
  const [progress, setProgress] = useState("");
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const capabilities = useQuery({
    queryKey: ["hub-knowledge", "capabilities"],
    queryFn: async () => unwrapHubResult(await Api.getIngestCapabilitiesFn()),
    retry: false,
  });
  const save = useMutation({
    retry: false,
    mutationFn: async () => {
      if (kind !== "file")
        return unwrapHubResult(
          await Api.submitKnowledgeImportFn({
            data: {
              request_id: requestId,
              kind,
              title,
              previous_source_id: previousSourceId,
              ...(kind === "text" ? { text } : { url }),
            },
          }),
        );
      if (!file || !capabilities.data) throw new Error("请先选择支持的文件");
      if (file.size > capabilities.data.max_file_bytes || file.size === 0)
        throw new Error("文件必须大于 0 且不超过 20MiB");
      const extension = "." + file.name.split(".").at(-1)?.toLowerCase();
      if (!capabilities.data.formats.some((f) => f.extension === extension))
        throw new Error("当前文件格式不受支持");
      const bytes = new Uint8Array(await file.arrayBuffer());
      setProgress("校验文件…");
      const upload = unwrapHubResult(
        await Api.beginKnowledgeUploadFn({
          data: {
            request_id: requestId,
            filename: file.name,
            size_bytes: file.size,
            sha256: await sha256(bytes),
          },
        }),
      );
      for (
        let start = 0, index = 0;
        start < bytes.length;
        start += upload.chunk_bytes, index++
      ) {
        const chunk = bytes.slice(start, start + upload.chunk_bytes);
        let binary = "";
        for (let pos = 0; pos < chunk.length; pos += 8192)
          binary += String.fromCharCode(...chunk.subarray(pos, pos + 8192));
        unwrapHubResult(
          await Api.sendKnowledgeChunkFn({
            data: {
              id: upload.id,
              index,
              data_base64: btoa(binary),
              sha256: await sha256(chunk),
            },
          }),
        );
        setProgress(
          `已上传 ${Math.min(100, Math.round(((start + chunk.length) / bytes.length) * 100))}%`,
        );
      }
      return unwrapHubResult(
        await Api.finishKnowledgeUploadFn({
          data: { id: upload.id, previous_source_id: previousSourceId },
        }),
      );
    },
    onSuccess: saved,
  });
  return (
    <div className="hub-modal-backdrop">
      <section
        className="hub-modal hub-material-modal"
        role="dialog"
        aria-modal="true"
        aria-label="添加资料"
      >
        <div className="hub-row">
          <h2>添加资料</h2>
          <button
            type="button"
            aria-label="关闭"
            disabled={save.isPending}
            onClick={close}
          >
            <X size={18} />
          </button>
        </div>
        {previousSourceId && (
          <p className="hub-muted">
            将保存为此资料的新版本，旧原文与历史引用会保留。
          </p>
        )}
        <div className="hub-material-tabs">
          {(
            [
              { value: "file", name: "上传文件", Icon: FileUp },
              { value: "text", name: "文字笔记", Icon: BookOpen },
              { value: "url", name: "网页链接", Icon: Link },
            ] as const
          ).map((t) => (
            <button
              type="button"
              key={t.value}
              className={kind === t.value ? "is-active" : ""}
              disabled={save.isPending}
              onClick={() => {
                setKind(t.value);
                setRequestId(crypto.randomUUID());
              }}
            >
              <t.Icon size={16} />
              {t.name}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          {kind === "file" ? (
            <label className="hub-upload-zone">
              选择本机文档
              <input
                aria-label="上传文件"
                type="file"
                disabled={save.isPending}
                accept={capabilities.data?.formats
                  .map((f) => f.extension)
                  .join(",")}
                onChange={(e) => {
                  setFile(e.target.files?.[0]);
                  setRequestId(crypto.randomUUID());
                }}
              />
              <small>单文件不超过 20MiB，原文件保存在笔记本。</small>
            </label>
          ) : (
            <>
              <label>
                资料标题
                <input
                  aria-label="资料标题"
                  value={title}
                  disabled={save.isPending}
                  maxLength={200}
                  required
                  onChange={(e) => {
                    setTitle(e.target.value);
                    setRequestId(crypto.randomUUID());
                  }}
                />
              </label>
              {kind === "text" ? (
                <label>
                  资料正文
                  <textarea
                    aria-label="资料正文"
                    value={text}
                    disabled={save.isPending}
                    rows={8}
                    required
                    onChange={(e) => {
                      setText(e.target.value);
                      setRequestId(crypto.randomUUID());
                    }}
                  />
                </label>
              ) : (
                <label>
                  公开网页地址
                  <input
                    aria-label="网页地址"
                    type="url"
                    value={url}
                    disabled={save.isPending}
                    required
                    onChange={(e) => {
                      setUrl(e.target.value);
                      setRequestId(crypto.randomUUID());
                    }}
                  />
                </label>
              )}
            </>
          )}
          {capabilities.data && (
            <details className="hub-supported-formats">
              <summary>支持哪些资料？</summary>
              <p>
                {capabilities.data.formats.map((f) => f.extension).join("、")}
              </p>
              {capabilities.data.unsupported.map((f) => (
                <p key={f.extension}>
                  {f.extension}：{f.reason}
                </p>
              ))}
            </details>
          )}
          <HubErrorNotice error={capabilities.error ?? save.error} />
          <p className="hub-muted">
            资料入库后可以检索；提取的知识经你确认后进入知识网络。
          </p>
          <button
            className="hub-primary"
            type="submit"
            disabled={save.isPending || !capabilities.data}
          >
            {save.isPending ? progress || "正在保存…" : "保存到知识库"}
          </button>
        </form>
      </section>
    </div>
  );
}

function CandidateCard({
  candidate,
  pages,
  onNode,
  changed,
}: {
  candidate: KnowledgeCandidate;
  pages: {
    wiki_page_id: string;
    title: string;
    node_type: string;
    status: string;
  }[];
  onNode: (id: string) => void;
  changed: () => void;
}) {
  const [title, setTitle] = useState(candidate.payload.title);
  const [statement, setStatement] = useState(candidate.payload.statement);
  const [target, setTarget] = useState(candidate.payload.merge_target_id ?? "");
  const [scope, setScope] = useState(candidate.payload.scope.kind);
  const workspaceId =
    candidate.payload.scope.workspace_id ??
    candidate.evidence.find((e) => e.origin?.workspace_id)?.origin
      ?.workspace_id;
  const mutation = useMutation({
    retry: false,
    mutationFn: async (action: "save" | "reject" | "publish") => {
      if (action === "publish")
        return unwrapHubResult(
          await Api.publishKnowledgeCandidatesFn({
            data: {
              request_id: crypto.randomUUID(),
              candidates: [{ id: candidate.id, version: candidate.version }],
            },
          }),
        );
      return unwrapHubResult(
        await Api.editKnowledgeCandidateFn({
          data: {
            id: candidate.id,
            version: candidate.version,
            ...(action === "reject"
              ? { status: "rejected" as const }
              : {
                  title,
                  statement,
                  merge_target_id: target || null,
                  scope:
                    scope === "global"
                      ? { kind: "global" as const }
                      : { kind: "project" as const, workspace_id: workspaceId },
                }),
          },
        }),
      );
    },
    onSuccess: changed,
  });
  const edited =
    title !== candidate.payload.title ||
    statement !== candidate.payload.statement ||
    target !== (candidate.payload.merge_target_id ?? "") ||
    scope !== candidate.payload.scope.kind;
  return (
    <article className="hub-knowledge-card">
      <div className="hub-row">
        <span className="hub-knowledge-kind">
          {
            {
              concept: "概念",
              entity: "实体",
              method: "方法",
              project: "项目",
              preference: "偏好",
              rule: "规则",
            }[candidate.payload.node_type]
          }
        </span>
        <small className="hub-muted">
          {candidate.payload.scope.kind === "global" ? "通用知识" : "项目知识"}
        </small>
      </div>
      <label>
        知识标题
        <input
          aria-label="知识标题"
          maxLength={200}
          value={title}
          disabled={mutation.isPending}
          onChange={(e) => setTitle(e.target.value)}
        />
      </label>
      <label>
        知识正文
        <textarea
          aria-label="知识正文"
          rows={5}
          maxLength={16000}
          value={statement}
          disabled={mutation.isPending}
          onChange={(e) => setStatement(e.target.value)}
        />
      </label>
      <strong>原文证据</strong>
      <div className="hub-row">
        <label>
          确认方式
          <select
            aria-label="确认方式"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            disabled={mutation.isPending}
          >
            <option value="">建立新知识页</option>
            {pages
              .filter(
                (p) =>
                  p.node_type === candidate.payload.node_type &&
                  ["active", "needs_review"].includes(p.status),
              )
              .map((p) => (
                <option key={p.wiki_page_id} value={p.wiki_page_id}>
                  更新：{p.title}
                  {p.status === "needs_review" ? "（待复核）" : ""}
                </option>
              ))}
          </select>
        </label>
        <label>
          作用范围
          <select
            aria-label="知识作用范围"
            value={scope}
            onChange={(e) => setScope(e.target.value as typeof scope)}
            disabled={mutation.isPending}
          >
            <option value="global">通用知识</option>
            <option value="project" disabled={!workspaceId}>
              仅来源项目
            </option>
          </select>
        </label>
      </div>
      {candidate.evidence.map((e) => (
        <div className="hub-evidence-quote" key={e.id}>
          {e.origin && (
            <p className="hub-muted">
              {e.origin.runtime} ·{" "}
              {e.origin.role === "user" ? "用户原话" : "助手回答"} ·{" "}
              {new Date(e.origin.created_at).toLocaleString("zh-CN")}
            </p>
          )}
          <blockquote>{e.excerpt}</blockquote>
          <div className="hub-row">
            <button
              type="button"
              onClick={() => onNode("source:" + e.source_id)}
            >
              查看原文 · 行 {e.start_line}–{e.end_line}
            </button>
            {e.source_url && (
              <a href={e.source_url} target="_blank" rel="noreferrer">
                来源链接
              </a>
            )}
            {e.origin && (
              <a
                href={
                  (e.origin.runtime === "wiki"
                    ? "/admin/personal-ai-hub"
                    : "/admin/personal-ai-hub/agent-chat") +
                  "?" +
                  new URLSearchParams({
                    view: "chat",
                    scope: "knowledge",
                    workspace: e.origin.workspace_id,
                    chat: e.origin.conversation_id,
                    ...(e.origin.runtime === "wiki"
                      ? {}
                      : { runtime: e.origin.runtime }),
                  })
                }
              >
                返回来源聊天
              </a>
            )}
          </div>
        </div>
      ))}
      {candidate.payload.related_titles.length > 0 && (
        <p className="hub-muted">
          关联：{candidate.payload.related_titles.join("、")}
        </p>
      )}
      <div className="hub-knowledge-actions">
        {edited ? (
          <button
            type="button"
            disabled={mutation.isPending || !title.trim() || !statement.trim()}
            onClick={() => mutation.mutate("save")}
          >
            保存修改
          </button>
        ) : (
          <button
            type="button"
            className="hub-primary"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate("publish")}
          >
            确认并更新知识库
          </button>
        )}
        <button
          type="button"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate("reject")}
        >
          不保留
        </button>
      </div>
      <HubErrorNotice error={mutation.error} />
    </article>
  );
}

export function HubKnowledgeManager({
  onNode,
  initialTab = "sources",
}: {
  onNode: (id: string) => void;
  initialTab?: "sources" | "review";
}) {
  const cache = useQueryClient();
  const [tab, setTab] = useState<"sources" | "review" | "jobs">(initialTab);
  const [adding, setAdding] = useState(false);
  const [replacing, setReplacing] = useState<string>();
  const [query, setQuery] = useState("");
  const [extractSource, setExtractSource] = useState<string>();
  const [relativePath, setRelativePath] = useState("");
  const [range, setRange] = useState({ start: "", end: "" });
  const [model, setModel] = useState<"deepseek-flash" | "deepseek-v4-pro">(
    "deepseek-flash",
  );
  const refresh = () => {
    void cache.invalidateQueries({ queryKey: ["hub-knowledge"] });
    void cache.invalidateQueries({ queryKey: ["hub-v2", "graph"] });
  };
  const catalog = useQuery({
    queryKey: ["hub-knowledge", "catalog"],
    queryFn: async () => unwrapHubResult(await Api.getKnowledgeCatalogFn()),
    retry: false,
    refetchInterval: (q) =>
      q.state.data?.jobs.some((j) => ["queued", "running"].includes(j.state))
        ? 2000
        : false,
  });
  const candidates = useInfiniteQuery({
    queryKey: ["hub-knowledge", "candidates"],
    enabled: tab === "review",
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) =>
      unwrapHubResult(
        await Api.getKnowledgeCandidatesFn({ data: { cursor: pageParam } }),
      ),
    getNextPageParam: (page) => page.next_cursor ?? undefined,
    retry: false,
    refetchInterval: catalog.data?.jobs.some((j) =>
      ["queued", "running"].includes(j.state),
    )
      ? 3000
      : false,
  });
  const extraction = useMutation({
    retry: false,
    mutationFn: async () => {
      if (!extractSource) throw new Error("请选择资料");
      return unwrapHubResult(
        await Api.submitKnowledgeExtractionFn({
          data: {
            request_id: crypto.randomUUID(),
            source_id: extractSource,
            model,
            ...(relativePath ? { relative_path: relativePath } : {}),
            ...(range.start ? { start_line: Number(range.start) } : {}),
            ...(range.end ? { end_line: Number(range.end) } : {}),
          },
        }),
      );
    },
    onSuccess: () => {
      setExtractSource(undefined);
      setTab("jobs");
      refresh();
    },
  });
  const retry = useMutation({
    retry: false,
    mutationFn: async (id: string) =>
      unwrapHubResult(await Api.retryKnowledgeJobFn({ data: { id } })),
    onSuccess: refresh,
  });
  const rebuild = useMutation({
    retry: false,
    mutationFn: async () =>
      unwrapHubResult(
        await Api.rebuildKnowledgeFn({
          data: { request_id: crypto.randomUUID() },
        }),
      ),
    onSuccess: () => {
      setTab("jobs");
      refresh();
    },
  });
  return (
    <div className="hub-knowledge-manager">
      <div className="hub-knowledge-toolbar">
        <div className="hub-material-tabs">
          {(
            [
              { id: "sources", name: "我的资料" },
              { id: "review", name: "待确认知识" },
              { id: "jobs", name: "处理进度" },
            ] as const
          ).map((t) => (
            <button
              type="button"
              key={t.id}
              className={tab === t.id ? "is-active" : ""}
              onClick={() => setTab(t.id)}
            >
              {t.name}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="hub-primary"
          onClick={() => setAdding(true)}
        >
          <Plus size={16} />
          添加资料
        </button>
      </div>
      <HubErrorNotice
        error={
          catalog.error ?? candidates.error ?? retry.error ?? rebuild.error
        }
        retry={() => {
          refresh();
        }}
      />
      {catalog.data?.publication.state !== undefined &&
        catalog.data.publication.state !== "ready" && (
          <p className="hub-error">
            知识更新尚未完成，请在处理进度中查看或重新运行失败任务。
          </p>
        )}
      {tab === "sources" && (
        <>
          <div className="hub-row">
            <p className="hub-muted">
              {catalog.data?.sources.length ?? 0} 份原始资料，保留来源与证据。
            </p>
            <input
              aria-label="搜索资料"
              placeholder="搜索资料…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="hub-material-grid">
            {catalog.data?.sources
              .filter((s) =>
                s.original_name.toLowerCase().includes(query.toLowerCase()),
              )
              .map((s) => (
                <article className="hub-material-card" key={s.source_id}>
                  <span className="hub-knowledge-kind">{s.source_type}</span>
                  <h3>{s.original_name}</h3>
                  <small>{s.created_at.slice(0, 10)}</small>
                  {s.status === "review_only" && (
                    <small> · 聊天原文，仅供核查证据</small>
                  )}
                  <div className="hub-knowledge-actions">
                    <button
                      type="button"
                      onClick={() => onNode("source:" + s.source_id)}
                    >
                      查看资料
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setExtractSource(s.source_id);
                        setRelativePath("");
                        setRange({ start: "", end: "" });
                      }}
                    >
                      整理成知识
                    </button>
                    {s.status !== "review_only" && (
                      <button
                        type="button"
                        onClick={() => {
                          setReplacing(s.source_id);
                          setAdding(true);
                        }}
                      >
                        更新资料
                      </button>
                    )}
                  </div>
                </article>
              ))}
          </div>
          {catalog.isPending && <p>正在读取资料…</p>}
          {catalog.data?.sources.length === 0 && (
            <div className="hub-knowledge-empty">
              <BookOpen size={32} />
              <h2>从第一份资料开始</h2>
              <p>上传文档、保存笔记或导入网页，逐步建立自己的知识库。</p>
            </div>
          )}
        </>
      )}
      {tab === "review" && (
        <>
          <p className="hub-muted">
            核对原文后再确认。未确认的内容不会进入知识问答或知识网络。
          </p>
          <div className="hub-review-grid">
            {candidates.data?.pages
              .flatMap((page) => page.items)
              .map((c) => (
                <CandidateCard
                  key={c.id + ":" + c.version}
                  candidate={c}
                  pages={catalog.data?.wiki_pages ?? []}
                  onNode={onNode}
                  changed={refresh}
                />
              ))}
          </div>
          {candidates.hasNextPage && (
            <button
              type="button"
              className="hub-native-open"
              disabled={candidates.isFetchingNextPage}
              onClick={() => void candidates.fetchNextPage()}
            >
              {candidates.isFetchingNextPage
                ? "正在读取…"
                : "继续查看待确认知识"}
            </button>
          )}
          {candidates.data?.pages.every((page) => page.items.length === 0) && (
            <p className="hub-knowledge-empty">
              暂无待确认知识。可以从资料或聊天中发起整理。
            </p>
          )}
        </>
      )}
      {tab === "jobs" && (
        <div className="hub-job-list">
          <div className="hub-row">
            <p className="hub-muted">
              文件解析、知识确认和索引更新都在笔记本上处理。
            </p>
            <button
              type="button"
              disabled={
                rebuild.isPending ||
                catalog.data?.jobs.some((j) =>
                  ["queued", "running"].includes(j.state),
                )
              }
              onClick={() => rebuild.mutate()}
            >
              重新构建索引
            </button>
          </div>
          {catalog.data?.jobs.map((j) => (
            <article key={j.id}>
              <div className="hub-row">
                <strong>{jobLabels[j.kind] ?? j.kind}</strong>
                <span>{stateLabels[j.state]}</span>
              </div>
              {j.error && <p className="hub-error">{j.error.message}</p>}
              {["failed", "interrupted"].includes(j.state) && (
                <button
                  type="button"
                  disabled={retry.isPending}
                  onClick={() => retry.mutate(j.id)}
                >
                  {j.kind === "extract"
                    ? "重新运行（调用 DeepSeek）"
                    : "重新运行"}
                </button>
              )}
              <details>
                <summary>任务详情</summary>
                <small>
                  {j.id} · {j.created_at}
                </small>
              </details>
            </article>
          ))}
        </div>
      )}
      {adding && (
        <AddMaterial
          previousSourceId={replacing}
          close={() => {
            setAdding(false);
            setReplacing(undefined);
          }}
          saved={() => {
            setAdding(false);
            setReplacing(undefined);
            setTab("jobs");
            refresh();
          }}
        />
      )}
      {extractSource && (
        <div className="hub-modal-backdrop">
          <section
            className="hub-modal hub-material-modal"
            role="dialog"
            aria-modal="true"
            aria-label="整理知识"
          >
            <div className="hub-row">
              <h2>整理成知识</h2>
              <button
                type="button"
                aria-label="关闭"
                disabled={extraction.isPending}
                onClick={() => setExtractSource(undefined)}
              >
                <X size={18} />
              </button>
            </div>
            <p>将选定原文交给 DeepSeek 提取知识，结果先存为待确认候选。</p>
            <label>
              整理模型
              <select
                value={model}
                onChange={(e) => setModel(e.target.value as typeof model)}
              >
                <option value="deepseek-flash">DeepSeek Flash</option>
                <option value="deepseek-v4-pro">DeepSeek V4 Pro</option>
              </select>
            </label>
            <label>
              项目文件路径（项目资料必填）
              <input
                value={relativePath}
                onChange={(e) => setRelativePath(e.target.value)}
              />
            </label>
            <div className="hub-row">
              <label>
                开始行（可选）
                <input
                  type="number"
                  min={1}
                  value={range.start}
                  onChange={(e) =>
                    setRange({ ...range, start: e.target.value })
                  }
                />
              </label>
              <label>
                结束行（可选）
                <input
                  type="number"
                  min={1}
                  value={range.end}
                  onChange={(e) => setRange({ ...range, end: e.target.value })}
                />
              </label>
            </div>
            <small>
              每次最多整理 60000 字符；长文可分段整理，原文会完整保留。
            </small>
            <HubErrorNotice error={extraction.error} />
            <button
              className="hub-primary"
              type="button"
              disabled={extraction.isPending}
              onClick={() => extraction.mutate()}
            >
              {extraction.isPending ? "正在提交…" : "提取知识候选"}
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
