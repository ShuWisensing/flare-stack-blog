import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Bot, Loader2, Plus, RefreshCw, Send } from "lucide-react";
import { useState } from "react";
import {
  createPersonalAiHubAgentSessionFn,
  getPersonalAiHubAgentStatusFn,
  listPersonalAiHubAgentMessagesFn,
  listPersonalAiHubAgentSessionsFn,
  sendPersonalAiHubAgentChatMessageFn,
} from "@/features/personal-ai-hub/api/personal-ai-hub.admin.api";
import type { AgentChatResponse } from "@/features/personal-ai-hub/schema/personal-ai-hub.schema";
import type {
  AgentMessagesResponse,
  AgentSessionResponse,
  AgentSessionsResponse,
  AgentStatusResponse,
} from "@/features/personal-ai-hub/schema/personal-ai-hub.schema";

export const Route = createFileRoute("/admin/personal-ai-hub/agent-chat")({
  component: AgentChatPage,
  loader: () => ({ title: "Agent Chat" }),
  head: ({ loaderData }) => ({
    meta: [{ title: loaderData?.title }],
  }),
});

function AgentChatPage() {
  const [sessionId, setSessionId] = useState("");
  const [sessionTitle, setSessionTitle] = useState("Personal AI Hub Session");
  const [question, setQuestion] = useState("");
  const [model, setModel] = useState<"deepseek-v4-flash" | "deepseek-v4-pro">(
    "deepseek-v4-flash",
  );
  const [result, setResult] = useState<AgentChatResponse | null>(null);

  const sessionsQuery = useQuery({
    queryKey: ["personal-ai-hub", "agent-sessions"],
    queryFn: async () =>
      (await listPersonalAiHubAgentSessionsFn()) as AgentSessionsResponse,
  });

  const statusQuery = useQuery({
    queryKey: ["personal-ai-hub", "agent-status"],
    queryFn: async () =>
      (await getPersonalAiHubAgentStatusFn()) as AgentStatusResponse,
  });

  const messagesQuery = useQuery({
    enabled: Boolean(sessionId.trim()),
    queryKey: ["personal-ai-hub", "agent-messages", sessionId],
    queryFn: async () =>
      (await listPersonalAiHubAgentMessagesFn({
        data: { sessionId },
      })) as AgentMessagesResponse,
  });

  const createSessionMutation = useMutation({
    mutationFn: async () =>
      (await createPersonalAiHubAgentSessionFn({
        data: { title: sessionTitle },
      })) as AgentSessionResponse,
    onSuccess: (response) => {
      const id = String(response.session.id ?? "");
      setSessionId(id);
      sessionsQuery.refetch();
    },
  });

  const mutation = useMutation({
    mutationFn: async () =>
      (await sendPersonalAiHubAgentChatMessageFn({
        data: {
          bm25Weight: 0.45,
          model,
          question,
          retrievalMode: "hybrid",
          sessionId,
          topK: 8,
        },
      })) as AgentChatResponse,
    onSuccess: (response) => {
      setResult(response);
      messagesQuery.refetch();
      statusQuery.refetch();
    },
  });

  const isDisabled = !sessionId.trim() || !question.trim() || mutation.isPending;

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
              LLM Wiki pre-retrieval to opencode runtime
            </p>
          </div>
        </div>
      </header>

      <section className="border border-border/30 p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="block space-y-2">
            <span className="text-xs font-mono uppercase tracking-widest">
              opencode session
            </span>
            <select
              value={sessionId}
              onChange={(event) => setSessionId(event.target.value)}
              className="w-full border border-border/40 bg-background p-3 text-sm outline-none focus:border-foreground/70"
            >
              <option value="">选择已有会话</option>
              {(sessionsQuery.data?.items ?? []).map((session) => {
                const id = String(session.id ?? "");
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
              value={model}
              onChange={(event) =>
                setModel(event.target.value as "deepseek-v4-flash" | "deepseek-v4-pro")
              }
              className="w-full border border-border/40 bg-background p-3 text-sm outline-none focus:border-foreground/70"
            >
              <option value="deepseek-v4-flash">deepseek-v4-flash</option>
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
            onClick={() => createSessionMutation.mutate()}
            disabled={!sessionTitle.trim() || createSessionMutation.isPending}
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
            }}
            className="h-11 px-4 flex items-center justify-center gap-2 border border-border/40 text-xs font-mono uppercase tracking-widest"
          >
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InfoBox title="runtime status" value={statusQuery.data?.opencode ?? {}} />
          <InfoBox title="session messages" value={messagesQuery.data?.items ?? []} />
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
          onClick={() => mutation.mutate()}
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
          <InfoBox title="opencode result" value={result.opencode_result} />
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
    <div className="border border-border/30 p-4">
      <h2 className="text-xs font-mono uppercase tracking-widest mb-3">
        {title}
      </h2>
      <pre className="text-xs overflow-x-auto">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}
