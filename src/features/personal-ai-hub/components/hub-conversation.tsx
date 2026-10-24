import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  ArrowUp,
  BookOpen,
  ChevronDown,
  Loader2,
  RefreshCw,
  Settings2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import * as Api from "../api/hub-chat.admin.api";
import type {
  HubConversation,
  HubMessage,
  HubTurnInput,
} from "../schema/hub-chat.schema";
import { unwrapHubResult } from "../schema/personal-ai-hub.schema";
import { HubErrorNotice } from "./hub-feedback";
import { HubMarkdown } from "./hub-markdown";

const busyStates = new Set([
  "queued",
  "preparing",
  "submitting",
  "running",
  "unknown",
]);
const labels: Record<string, string> = {
  queued: "等待执行",
  preparing: "正在准备上下文",
  submitting: "正在提交原生任务",
  running: "正在处理",
  completed: "已完成",
  failed: "本轮未完成",
  interrupted: "服务重启，本轮已中断",
  unknown: "任务结果未知，请核验原任务后再发送",
};

function SavedCitation({
  message,
  ordinal,
  onNode,
}: {
  message: HubMessage;
  ordinal: number;
  onNode?: (id: string) => void;
}) {
  const citation = useQuery({
    queryKey: ["hub-v2", "citation", message.id, ordinal],
    queryFn: async () =>
      unwrapHubResult(
        await Api.getHubCitationFn({
          data: { message_id: message.id, ordinal },
        }),
      ),
    retry: false,
  });
  const snapshot = citation.data?.source_snapshot;
  const title =
    typeof snapshot?.title === "string"
      ? snapshot.title
      : typeof snapshot?.relative_path === "string"
        ? snapshot.relative_path
        : `引用 ${ordinal}`;
  return (
    <li>
      <strong>
        [{ordinal}] {title}
      </strong>
      {citation.data && <small>知识版本：{citation.data.generation}</small>}
      {snapshot && typeof snapshot.start_line === "number" && (
        <small>
          行 {snapshot.start_line}–
          {typeof snapshot.end_line === "number"
            ? snapshot.end_line
            : snapshot.start_line}
        </small>
      )}
      {snapshot && typeof snapshot.source_id === "string" && onNode && (
        <button
          type="button"
          onClick={() => onNode("source:" + snapshot.source_id)}
        >
          查看资料
        </button>
      )}
      <HubErrorNotice
        error={citation.error}
        retry={() => void citation.refetch()}
      />
    </li>
  );
}

function MessageDetails({
  message,
  onNode,
}: {
  message: HubMessage;
  onNode?: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const details = useQuery({
    queryKey: ["hub-v2", "details", message.turn_id],
    enabled: open,
    queryFn: async () =>
      unwrapHubResult(
        await Api.getHubTurnDetailsFn({ data: { id: message.turn_id } }),
      ),
    retry: false,
  });
  return (
    <details
      className="hub-message-details"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>
        <BookOpen size={13} />
        {message.citations.length
          ? `引用 ${message.citations.length} 条 · `
          : ""}
        活动与详情
        <ChevronDown size={13} />
      </summary>
      {open && (
        <div className="hub-detail-scroll">
          <ol>
            {message.citations.map((citation) => (
              <SavedCitation
                key={citation.ordinal}
                message={message}
                ordinal={citation.ordinal}
                onNode={onNode}
              />
            ))}
          </ol>
          {details.data && (
            <>
              <p>
                {details.data.tool_summary.length} 项活动 ·{" "}
                {typeof details.data.timings.total_ms === "number"
                  ? (details.data.timings.total_ms / 1000).toFixed(1) + " 秒"
                  : "耗时未记录"}
              </p>
              {typeof details.data.settings?.model_id === "string" && (
                <p>本轮选择：{details.data.settings.model_id}</p>
              )}
              {details.data.tool_summary.map((item, index) => (
                <p key={String(item.type) + index}>
                  {item.type === "runtime"
                    ? "执行器"
                    : typeof item.type === "string"
                      ? item.type
                      : "原生活动"}
                  {typeof item.runtime === "string" ? `：${item.runtime}` : ""}
                  {typeof item.model === "string" ? ` · ${item.model}` : ""}
                  {typeof item.query === "string" ? `：${item.query}` : ""}
                  {typeof item.status === "string" ? ` · ${item.status}` : ""}
                </p>
              ))}
              <details>
                <summary>诊断数据</summary>
                <pre>
                  {JSON.stringify(
                    {
                      timings: details.data.timings,
                      retrieval: details.data.recall_items.map((item) => ({
                        kind: item.kind,
                        title: item.title,
                        score: item.score,
                      })),
                    },
                    null,
                    2,
                  )}
                </pre>
              </details>
            </>
          )}
          <HubErrorNotice
            error={details.error}
            retry={() => void details.refetch()}
          />
        </div>
      )}
    </details>
  );
}

export function HubConversationView({
  chat,
  onNode,
}: {
  chat: HubConversation;
  onNode?: (id: string) => void;
}) {
  const cache = useQueryClient();
  const [question, setQuestion] = useState("");
  const saved = chat.last_settings;
  const [model, setModel] = useState(
    saved?.model_id ?? chat.preferred_model_id,
  );
  const [knowledge, setKnowledge] = useState(
    saved ? saved.knowledge.enabled : true,
  );
  const [retrievalMode, setRetrievalMode] = useState<
    "bm25" | "vector" | "hybrid"
  >(saved ? saved.knowledge.retrieval_mode : "hybrid");
  const [rerankMode, setRerankMode] = useState<"off" | "local">(
    saved ? saved.knowledge.rerank_mode : "local",
  );
  const [answerMode, setAnswerMode] = useState<"chat" | "search">(
    saved ? saved.answer_mode : "chat",
  );
  const [turnId, setTurnId] = useState(chat.active_turn?.id);
  const [uncertain, setUncertain] = useState(false);
  const [modelMenu, setModelMenu] = useState(false);
  const submission = useRef(false);
  const mounted = useRef(true);
  const pending = useRef<HubTurnInput | null>(null);
  const stream = useRef<HTMLDivElement>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const nearBottom = useRef(true);
  const messages = useInfiniteQuery({
    queryKey: ["hub-v2", "messages", chat.id],
    initialPageParam: undefined as number | undefined,
    queryFn: async ({ pageParam }) =>
      unwrapHubResult(
        await Api.listHubMessagesFn({
          data: { id: chat.id, before_seq: pageParam },
        }),
      ),
    getNextPageParam: (page) => page.next_before_seq ?? undefined,
    retry: false,
  });
  const turn = useQuery({
    queryKey: ["hub-v2", "turn", turnId],
    enabled: Boolean(turnId),
    retry: false,
    queryFn: async () => {
      if (!turnId) throw new Error("未选择请求");
      return unwrapHubResult(await Api.getHubTurnFn({ data: { id: turnId } }));
    },
    refetchInterval: (query) =>
      query.state.data &&
      ["queued", "preparing", "submitting", "running"].includes(
        query.state.data.state,
      )
        ? 1200
        : false,
  });
  const runtime = useQuery({
    queryKey: ["hub-v2", "runtimes", chat.workspace_id],
    enabled: chat.runtime !== "wiki",
    retry: false,
    queryFn: async () =>
      unwrapHubResult(
        await Api.getHubRuntimesFn({
          data: { workspace_id: chat.workspace_id },
        }),
      ),
    refetchInterval: (query) => {
      const states = query.state.data?.items.map((item) => item.runtime_status);
      if (states?.some((state) => state.status === "checking")) return 1200;
      const expiries = states
        ?.filter((state) => state.status === "ready" && state.expires_at)
        .map((state) => Date.parse(state.expires_at as string));
      return expiries?.length
        ? Math.max(
            1000,
            Math.min(60000, Math.min(...expiries) - Date.now() + 50),
          )
        : false;
    },
  });
  const status = runtime.data?.items.find(
    (item) => item.runtime === chat.runtime,
  )?.runtime_status;
  const models = useQuery({
    queryKey: ["hub-v2", "models", chat.runtime, chat.workspace_id],
    enabled: chat.runtime !== "wiki" && modelMenu,
    retry: false,
    queryFn: async () => {
      if (chat.runtime === "wiki") throw new Error("Wiki 不使用原生模型目录");
      return unwrapHubResult(
        await Api.getHubModelsFn({
          data: { runtime: chat.runtime, workspace_id: chat.workspace_id },
        }),
      );
    },
  });
  const check = useMutation({
    retry: false,
    mutationFn: async () => {
      if (chat.runtime === "wiki") throw new Error("Wiki 不使用原生连接检查");
      return unwrapHubResult(
        await Api.checkHubRuntimeFn({
          data: { runtime: chat.runtime, workspace_id: chat.workspace_id },
        }),
      );
    },
    onSuccess: () =>
      cache.invalidateQueries({
        queryKey: ["hub-v2", "runtimes", chat.workspace_id],
      }),
  });
  const verify = useMutation({
    retry: false,
    mutationFn: async () => {
      if (!turnId) throw new Error("没有原任务编号");
      return unwrapHubResult(
        await Api.getHubTurnFn({ data: { id: turnId, verify_native: true } }),
      );
    },
    onSuccess: (data) => {
      cache.setQueryData(["hub-v2", "turn", turnId], data);
      void messages.refetch();
    },
  });
  const send = useMutation({
    retry: false,
    mutationFn: async (input: HubTurnInput) =>
      unwrapHubResult(
        await Api.submitHubTurnFn({ data: { id: chat.id, input } }),
      ),
    onSuccess: (result) => {
      void cache.invalidateQueries({
        queryKey: ["hub-v2", "messages", chat.id],
      });
      void cache.invalidateQueries({
        queryKey: ["hub-v2", "conversation", chat.id],
      });
      if (mounted.current) {
        setTurnId(result.turn_id);
        setQuestion("");
        setUncertain(false);
        sessionStorage.removeItem("hub-request:" + chat.id);
      }
    },
    onError: (error) => {
      const status =
        "upstreamStatus" in error ? error.upstreamStatus : undefined;
      const rejected =
        status === 401 || status === 422 || status === 409 || status === 404;
      if (rejected) sessionStorage.removeItem("hub-request:" + chat.id);
      if (mounted.current) setUncertain(!rejected);
    },
    onSettled: () => {
      submission.current = false;
    },
  });
  const recover = useMutation({
    retry: false,
    mutationFn: async () => {
      const requestId =
        pending.current?.client_request_id ??
        sessionStorage.getItem("hub-request:" + chat.id);
      if (!requestId) throw new Error("缺少待核对的请求编号");
      return unwrapHubResult(
        await Api.getHubRequestFn({
          data: { conversation_id: chat.id, client_request_id: requestId },
        }),
      );
    },
    onSuccess: (data) => {
      if (!mounted.current) return;
      setTurnId(data.turn_id);
      setUncertain(false);
      setQuestion("");
      sessionStorage.removeItem("hub-request:" + chat.id);
      void messages.refetch();
    },
  });
  useEffect(() => {
    mounted.current = true;
    if (sessionStorage.getItem("hub-request:" + chat.id)) setUncertain(true);
    return () => {
      mounted.current = false;
    };
  }, [chat.id]);
  useEffect(() => {
    if (!turn.data || busyStates.has(turn.data.state)) return;
    void cache.invalidateQueries({ queryKey: ["hub-v2", "messages", chat.id] });
    void cache.invalidateQueries({
      queryKey: ["hub-v2", "conversation", chat.id],
    });
  }, [turn.data, cache, chat.id]);
  const items = messages.data?.pages
    .slice()
    .reverse()
    .flatMap((page) => page.items);
  useEffect(() => {
    if (nearBottom.current) bottom.current?.scrollIntoView?.({ block: "end" });
  }, [items?.length, turn.data?.state]);
  const state = turn.data?.state ?? chat.active_turn?.state;
  const busy =
    Boolean(state && busyStates.has(state)) ||
    send.isPending ||
    uncertain ||
    Boolean(turnId && turn.isPending);
  const modelMissing =
    chat.runtime !== "codex" && answerMode === "chat" && model === null;
  function submit() {
    if (
      submission.current ||
      busy ||
      modelMissing ||
      !question.trim() ||
      chat.archived_at
    )
      return;
    submission.current = true;
    const input: HubTurnInput = {
      client_request_id: crypto.randomUUID(),
      question,
      model_id:
        answerMode === "search" && chat.runtime === "wiki" ? null : model,
      answer_mode: answerMode,
      knowledge: {
        enabled: chat.runtime === "wiki" || knowledge,
        retrieval_mode: retrievalMode,
        rerank_mode: rerankMode,
      },
    };
    pending.current = input;
    sessionStorage.setItem("hub-request:" + chat.id, input.client_request_id);
    nearBottom.current = true;
    send.mutate(input);
  }
  return (
    <div className="hub-conversation">
      {chat.runtime !== "wiki" && (
        <div className="hub-runtime-status">
          <span
            className={`hub-status-dot ${status?.status === "ready" ? "is-ready" : ""}`}
          />
          {chat.runtime === "codex"
            ? "Codex · 只读项目任务 · 当前账号额度"
            : "opencode · 本机执行 · DeepSeek API"}
          <button
            type="button"
            disabled={check.isPending || status?.status === "checking"}
            onClick={() => check.mutate()}
          >
            {status?.status === "checking"
              ? "检查中…"
              : status?.status === "ready"
                ? "重新检查连接"
                : "检查连接"}
          </button>
          {status?.error && <span role="alert">{status.error.message}</span>}
          <HubErrorNotice error={check.error ?? runtime.error} />
        </div>
      )}
      <div
        className="hub-message-stream"
        ref={stream}
        onScroll={() => {
          const el = stream.current;
          if (el)
            nearBottom.current =
              el.scrollHeight - el.scrollTop - el.clientHeight < 100;
        }}
        aria-label="聊天消息"
      >
        <div className="hub-message-column">
          {messages.hasNextPage && (
            <button
              type="button"
              className="hub-load-older"
              disabled={messages.isFetchingNextPage}
              onClick={() => {
                nearBottom.current = false;
                void messages.fetchNextPage();
              }}
            >
              加载更早消息
            </button>
          )}
          {messages.isPending && <p className="hub-muted">读取本地聊天记录…</p>}
          <HubErrorNotice
            error={messages.error}
            retry={() => void messages.refetch()}
          />
          {items?.length === 0 && (
            <div className="hub-chat-empty">
              <BookOpen size={24} />
              <h2>
                {chat.runtime === "wiki"
                  ? "想从知识库了解什么？"
                  : "这个项目需要做什么？"}
              </h2>
              <p>
                {chat.runtime === "wiki"
                  ? "可以直接提问，也可以先去资料库浏览。"
                  : "每个聊天保留独立的原生上下文。"}
              </p>
            </div>
          )}
          {items?.map((message) => (
            <article
              key={message.id}
              className={`hub-message is-${message.role}`}
              aria-label={message.role === "user" ? "用户消息" : "助手回答"}
            >
              {message.role === "user" ? (
                <div className="hub-user-text">{message.content_md}</div>
              ) : (
                <>
                  <HubMarkdown content={message.content_md} />
                  <MessageDetails message={message} onNode={onNode} />
                </>
              )}
            </article>
          ))}
          {state && state !== "completed" && (
            <div
              role="status"
              className={`hub-turn-status ${busyStates.has(state) ? "" : "is-error"}`}
            >
              {["queued", "preparing", "submitting", "running"].includes(
                state,
              ) && <Loader2 size={15} className="animate-spin" />}
              {labels[state]}
              {turn.data?.error_reason && (
                <small>{turn.data.error_reason}</small>
              )}
              {state === "unknown" && (
                <button
                  type="button"
                  disabled={verify.isPending}
                  onClick={() => verify.mutate()}
                >
                  核验原任务
                </button>
              )}
            </div>
          )}
          <HubErrorNotice
            error={turn.error}
            retry={() => void turn.refetch()}
          />
          <HubErrorNotice error={verify.error} />
          <div ref={bottom} />
        </div>
      </div>
      <div className="hub-composer-wrap">
        {modelMissing && (
          <p className="hub-error">本轮模型未指定，请在模型菜单明确选择。</p>
        )}
        {uncertain && (
          <div className="hub-error">
            提交响应未确认，已暂停发送；核对原请求后继续。
            <button
              type="button"
              disabled={recover.isPending}
              onClick={() => recover.mutate()}
            >
              核对原请求
            </button>
          </div>
        )}
        <HubErrorNotice error={send.error ?? recover.error} />
        <form
          className="hub-composer"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <textarea
            aria-label="发送消息"
            placeholder={
              chat.runtime === "wiki"
                ? "询问知识库，或继续追问…"
                : "描述项目任务…"
            }
            value={question}
            maxLength={16000}
            disabled={busy || Boolean(chat.archived_at)}
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                !event.shiftKey &&
                !event.nativeEvent.isComposing &&
                event.nativeEvent.keyCode !== 229
              ) {
                event.preventDefault();
                submit();
              }
            }}
          />
          <div className="hub-composer-tools">
            <details className="hub-settings">
              <summary>
                <Settings2 size={15} />
                设置
                <ChevronDown size={12} />
              </summary>
              <div className="hub-settings-panel">
                {chat.runtime === "wiki" && (
                  <label>
                    回答方式
                    <select
                      aria-label="回答方式"
                      value={answerMode}
                      disabled={busy}
                      onChange={(event) =>
                        setAnswerMode(event.target.value as "chat" | "search")
                      }
                    >
                      <option value="chat">知识库问答</option>
                      <option value="search">只查找资料</option>
                    </select>
                  </label>
                )}
                {chat.runtime !== "wiki" && (
                  <label>
                    <input
                      type="checkbox"
                      checked={knowledge}
                      disabled={busy}
                      onChange={(event) => setKnowledge(event.target.checked)}
                    />
                    查询知识库后执行
                  </label>
                )}
                <label>
                  检索
                  <select
                    aria-label="检索模式"
                    disabled={busy}
                    value={retrievalMode}
                    onChange={(event) =>
                      setRetrievalMode(
                        event.target.value as typeof retrievalMode,
                      )
                    }
                  >
                    <option value="hybrid">本地混合检索</option>
                    <option value="bm25">BM25</option>
                    <option value="vector">本地向量</option>
                  </select>
                </label>
                <label>
                  重排
                  <select
                    aria-label="重排模式"
                    disabled={busy}
                    value={rerankMode}
                    onChange={(event) =>
                      setRerankMode(event.target.value as typeof rerankMode)
                    }
                  >
                    <option value="local">本地 BGE 重排</option>
                    <option value="off">关闭重排</option>
                  </select>
                </label>
                <p>
                  向量与重排均在本机运行。Wiki 追问必要时会额外调用一次 DeepSeek
                  改写问题，仍计入本轮总预算。
                </p>
              </div>
            </details>
            <details
              className="hub-settings"
              onToggle={(event) => setModelMenu(event.currentTarget.open)}
            >
              <summary>
                {chat.runtime === "codex"
                  ? (model ?? "本机 Codex 配置")
                  : (model ?? "选择模型")}
                <ChevronDown size={12} />
              </summary>
              <div className="hub-settings-panel">
                <label>
                  模型
                  <select
                    aria-label="模型"
                    disabled={busy}
                    value={model ?? ""}
                    onChange={(event) => setModel(event.target.value || null)}
                  >
                    {chat.runtime === "codex" ? (
                      <option value="">使用本机 Codex 配置</option>
                    ) : (
                      <>
                        <option value="" disabled>
                          请选择模型
                        </option>
                        <option value="deepseek-flash">deepseek-flash</option>
                        <option value="deepseek-v4-pro">deepseek-v4-pro</option>
                      </>
                    )}
                    {models.data?.items
                      .filter(
                        (item) =>
                          chat.runtime === "codex" ||
                          !["deepseek-flash", "deepseek-v4-pro"].includes(
                            item.id,
                          ),
                      )
                      .map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                  </select>
                </label>
                {chat.runtime !== "wiki" && (
                  <button
                    type="button"
                    disabled={models.isFetching}
                    onClick={() => void models.refetch()}
                  >
                    <RefreshCw size={13} />
                    刷新原生模型目录
                  </button>
                )}
                <HubErrorNotice error={models.error} />
              </div>
            </details>
            <span className="hub-knowledge-indicator">
              {chat.runtime === "wiki" || knowledge
                ? "知识库已启用"
                : "本轮不查询知识库"}
            </span>
            <button
              type="submit"
              className="hub-send"
              aria-label="发送"
              disabled={
                busy ||
                modelMissing ||
                !question.trim() ||
                Boolean(chat.archived_at)
              }
            >
              {send.isPending ? (
                <Loader2 size={17} className="animate-spin" />
              ) : (
                <ArrowUp size={19} />
              )}
            </button>
          </div>
        </form>
        <p className="hub-composer-note">
          Enter 发送 · Shift + Enter 换行 · 结果需结合来源核验
        </p>
      </div>
    </div>
  );
}
