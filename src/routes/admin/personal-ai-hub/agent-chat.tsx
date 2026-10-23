import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Bot, Loader2, Plus, RefreshCw, Send } from "lucide-react";
import { useRef, useState } from "react";
import { agentMessageText } from "@/features/personal-ai-hub/agent-message";
import {
  createPersonalAiHubAgentSessionFn,
  getPersonalAiHubAgentStatusFn,
  listPersonalAiHubAgentMessagesFn,
  listPersonalAiHubAgentSessionsFn,
  sendPersonalAiHubAgentChatMessageFn,
} from "@/features/personal-ai-hub/api/personal-ai-hub.admin.api";
import { HubCitations } from "@/features/personal-ai-hub/components/hub-citations";
import type {
  AgentChatInput,
  AgentChatResponse,
  AgentSessionCreateInput,
} from "@/features/personal-ai-hub/schema/personal-ai-hub.schema";
import { unwrapHubResult } from "@/features/personal-ai-hub/schema/personal-ai-hub.schema";

export const Route = createFileRoute("/admin/personal-ai-hub/agent-chat")({
  component: AgentChatPage,
  loader: () => ({ title: "Agent Chat" }),
  head: ({ loaderData }) => ({
    meta: [{ title: loaderData?.title }],
  }),
});

function AgentChatPage() {
  const operationPending = useRef(false);
  const startOperation = (action: () => void) => {
    if (operationPending.current) return;
    operationPending.current = true;
    action();
  };
  const [runtime, setRuntime] = useState<"opencode" | "codex">("opencode");
  const [retrievalMode, setRetrievalMode] = useState<"bm25" | "hybrid">(
    "hybrid",
  );
  const [sessionId, setSessionId] = useState("");
  const [rerankMode, setRerankMode] = useState<"off" | "local">("local");
  const [sessionTitle, setSessionTitle] = useState("Personal AI Hub Session");
  const [question, setQuestion] = useState("");
  const [model, setModel] = useState<"deepseek-flash" | "deepseek-v4-pro">(
    "deepseek-flash",
  );
  const [completed, setCompleted] = useState<{
    runtime: string;
    sessionId: string;
    response: AgentChatResponse;
  } | null>(null);
  const result =
    completed?.runtime === runtime && completed.sessionId === sessionId
      ? completed.response
      : null;

  const sessionsQuery = useQuery({
    retry: false,
    queryKey: ["personal-ai-hub", "agent-sessions", runtime],
    queryFn: async () =>
      unwrapHubResult(
        await listPersonalAiHubAgentSessionsFn({ data: { runtime } }),
      ),
  });

  const statusQuery = useQuery({
    retry: false,
    queryKey: ["personal-ai-hub", "agent-status", runtime],
    queryFn: async () =>
      unwrapHubResult(
        await getPersonalAiHubAgentStatusFn({ data: { runtime } }),
      ),
  });

  const messagesQuery = useQuery({
    retry: false,
    enabled: Boolean(sessionId.trim()),
    queryKey: ["personal-ai-hub", "agent-messages", runtime, sessionId],
    queryFn: async () =>
      unwrapHubResult(
        await listPersonalAiHubAgentMessagesFn({
          data: { sessionId, runtime },
        }),
      ),
  });

  const createSessionMutation = useMutation({
    retry: false,
    mutationFn: async (data: AgentSessionCreateInput) =>
      unwrapHubResult(
        await createPersonalAiHubAgentSessionFn({
          data,
        }),
      ),
    onMutate: () => {
      setCompleted(null);
      mutation.reset();
    },
    onSuccess: (response) => {
      setSessionId(response.session.id);
      sessionsQuery.refetch();
    },
    onSettled: () => {
      operationPending.current = false;
    },
  });

  const mutation = useMutation({
    retry: false,
    mutationFn: async (data: AgentChatInput) =>
      unwrapHubResult(
        await sendPersonalAiHubAgentChatMessageFn({
          data,
        }),
      ),
    onMutate: () => setCompleted(null),
    onSuccess: (response, input) => {
      setCompleted({
        runtime: input.runtime,
        sessionId: input.sessionId,
        response,
      });
      messagesQuery.refetch();
      statusQuery.refetch();
    },
    onSettled: () => {
      operationPending.current = false;
    },
  });

  const isDisabled =
    !sessionId.trim() ||
    !question.trim() ||
    mutation.isPending ||
    createSessionMutation.isPending;

  return (
    <div className="space-y-8 max-w-5xl mx-auto animate-in fade-in duration-500">
      <header className="border-b border-border/30 pb-6 space-y-3">
        <div className="flex items-center gap-3">
          <div className="size-10 border border-border/40 flex items-center justify-center">
            <Bot size={18} strokeWidth={1.5} />
          </div>
          <div>
            <h1 className="text-3xl font-serif font-medium tracking-tight">
              Agent Chat
            </h1>
            <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest">
              LLM Wiki + local Agent Runtime
            </p>
          </div>
        </div>
      </header>

      <section className="border border-border/30 p-5 space-y-4">
        <label>
          执行器
          <select
            className="w-full border p-3 bg-background"
            value={runtime}
            disabled={mutation.isPending || createSessionMutation.isPending}
            onChange={(e) => {
              if (operationPending.current) return;
              setRuntime(e.target.value as typeof runtime);
              setSessionId("");
              setCompleted(null);
              mutation.reset();
              createSessionMutation.reset();
            }}
          >
            <option value="opencode">opencode · DeepSeek API</option>
            <option value="codex">Codex · 当前登录账号额度</option>
          </select>
        </label>
        <p className="text-xs text-muted-foreground">
          {runtime === "codex"
            ? "Hub 独立会话；使用本机配置模型，首版支持只读项目任务。"
            : "使用本机 opencode，模型费用由 DeepSeek API 计费。"}
        </p>
        <label>
          知识检索
          <select
            className="w-full border p-2 bg-background"
            value={retrievalMode}
            disabled={mutation.isPending}
            onChange={(e) =>
              setRetrievalMode(e.target.value as typeof retrievalMode)
            }
          >
            <option value="hybrid">本地混合检索</option>
            <option value="bm25">BM25</option>
          </select>
        </label>
        <label>
          知识重排
          <select
            className="w-full border p-2 bg-background"
            value={rerankMode}
            disabled={mutation.isPending}
            onChange={(event) =>
              setRerankMode(event.target.value as typeof rerankMode)
            }
          >
            <option value="local">本地 BGE 重排</option>
            <option value="off">关闭</option>
          </select>
        </label>
        {[sessionsQuery, statusQuery, messagesQuery].map((query, index) =>
          query.error ? (
            <p role="alert" className="text-destructive text-xs" key={index}>
              {query.error.message}
            </p>
          ) : query.isFetching ? (
            <p key={index}>加载中…</p>
          ) : null,
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="block space-y-2">
            <span className="text-xs font-mono uppercase tracking-widest">
              Hub session
            </span>
            <select
              disabled={mutation.isPending || createSessionMutation.isPending}
              value={sessionId}
              onChange={(event) => {
                if (operationPending.current) return;
                setSessionId(event.target.value);
                setCompleted(null);
                mutation.reset();
                createSessionMutation.reset();
              }}
              className="w-full border border-border/40 bg-background p-3 text-sm outline-none focus:border-foreground/70"
            >
              <option value="">选择已有会话</option>
              {(sessionsQuery.data?.items ?? []).map((session) => {
                const id = session.id;
                const title = String(session.title ?? id);
                return (
                  <option key={id} value={id}>
                    {title}
                  </option>
                );
              })}
            </select>
          </label>
          <label className="block space-y-2">
            <span className="text-xs font-mono uppercase tracking-widest">
              model
            </span>
            <select
              disabled={runtime === "codex" || mutation.isPending}
              value={model}
              onChange={(event) =>
                setModel(
                  event.target.value as "deepseek-flash" | "deepseek-v4-pro",
                )
              }
              className="w-full border border-border/40 bg-background p-3 text-sm outline-none focus:border-foreground/70"
            >
              <option value="deepseek-flash">deepseek-flash</option>
              <option value="deepseek-v4-pro">deepseek-v4-pro</option>
            </select>
          </label>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-3">
          <input
            value={sessionTitle}
            onChange={(event) => setSessionTitle(event.target.value)}
            className="border border-border/40 bg-background p-3 text-sm outline-none focus:border-foreground/70"
            placeholder="新会话标题"
          />
          <button
            type="button"
            onClick={() =>
              startOperation(() =>
                createSessionMutation.mutate({ title: sessionTitle, runtime }),
              )
            }
            disabled={
              !sessionTitle.trim() ||
              createSessionMutation.isPending ||
              mutation.isPending
            }
            className="h-11 px-4 flex items-center justify-center gap-2 border border-border/40 text-xs font-mono uppercase tracking-widest disabled:opacity-50"
          >
            <Plus size={14} />
            Create
          </button>
          <button
            type="button"
            onClick={() => {
              sessionsQuery.refetch();
              statusQuery.refetch();
              if (sessionId.trim()) messagesQuery.refetch();
            }}
            className="h-11 px-4 flex items-center justify-center gap-2 border border-border/40 text-xs font-mono uppercase tracking-widest"
          >
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InfoBox
            title="runtime status"
            value={statusQuery.data?.runtime_status ?? null}
          />
          <InfoBox
            title="session messages"
            value={messagesQuery.data?.items ?? null}
          />
        </div>
        <label className="block space-y-2">
          <span className="text-xs font-mono uppercase tracking-widest">
            Question
          </span>
          <textarea
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            rows={6}
            className="w-full border border-border/40 bg-background p-4 text-sm outline-none focus:border-foreground/70"
            placeholder="输入要交给 Agent 的问题"
          />
        </label>
        <button
          type="button"
          onClick={() =>
            startOperation(() =>
              mutation.mutate({
                runtime,
                sessionId,
                question,
                model: runtime === "codex" ? undefined : model,
                rerankMode,
                retrievalMode,
                bm25Weight: 0.45,
                topK: 8,
              }),
            )
          }
          disabled={isDisabled}
          className="h-11 w-full flex items-center justify-center gap-2 bg-foreground text-background text-xs font-mono uppercase tracking-widest disabled:opacity-50"
        >
          {mutation.isPending ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Send size={14} />
          )}
          {mutation.isPending ? "Running Agent" : "Send To Agent"}
        </button>
        {mutation.error && (
          <div className="border border-destructive/30 text-destructive p-3 text-xs">
            {String(mutation.error.message)}
          </div>
        )}
        {createSessionMutation.error && (
          <div className="border border-destructive/30 text-destructive p-3 text-xs">
            {String(createSessionMutation.error.message)}
          </div>
        )}
      </section>

      {result && (
        <section className="space-y-4">
          <div className="border border-border/30 p-4 space-y-3">
            <h2 className="font-medium">回答</h2>
            <p className="whitespace-pre-wrap break-words text-sm">
              {agentMessageText(result.runtime_result)}
            </p>
            <HubCitations citations={result.citations} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InfoBox title="timings" value={result.timings} />
            <InfoBox title="execution" value={result.execution} />
          </div>
          <InfoBox title="run record" value={result.run_record ?? {}} />
          <InfoBox title="recall items" value={result.recall_items} />
        </section>
      )}
    </div>
  );
}

function InfoBox({ title, value }: { title: string; value: unknown }) {
  return (
    <details className="border border-border/30 p-4">
      <summary className="text-xs font-mono uppercase tracking-widest mb-3 cursor-pointer">
        {title}
      </summary>
      <pre className="text-xs overflow-x-auto">
        {JSON.stringify(value, null, 2)}
      </pre>
    </details>
  );
}
