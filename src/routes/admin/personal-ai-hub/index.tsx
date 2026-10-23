import { useMutation } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Activity, Brain, Database, Loader2, Send } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import {
  getPersonalAiHubStatusFn,
  queryPersonalAiHubKnowledgeBaseFn,
} from "@/features/personal-ai-hub/api/personal-ai-hub.admin.api";
import { HubCitations } from "@/features/personal-ai-hub/components/hub-citations";
import type {
  HubQueryResponse,
  HubStatusResponse,
} from "@/features/personal-ai-hub/schema/personal-ai-hub.schema";
import { unwrapHubResult } from "@/features/personal-ai-hub/schema/personal-ai-hub.schema";

export const Route = createFileRoute("/admin/personal-ai-hub/")({
  component: PersonalAiHubPage,
  loader: () => ({ title: "Personal AI Hub" }),
  head: ({ loaderData }) => ({
    meta: [{ title: loaderData?.title }],
  }),
});

function PersonalAiHubPage() {
  const [answerMode, setAnswerMode] = useState<"local" | "llm_rag">("llm_rag");
  const [llmModel, setLlmModel] = useState<
    "deepseek-flash" | "deepseek-v4-pro"
  >("deepseek-flash");
  const [retrievalMode, setRetrievalMode] = useState<
    "bm25" | "hybrid" | "vector" | "local"
  >("hybrid");
  const [rerankMode, setRerankMode] = useState<"off" | "local">("local");
  const [question, setQuestion] = useState("");
  const [status, setStatus] = useState<HubStatusResponse | null>(null);
  const [result, setResult] = useState<HubQueryResponse | null>(null);

  const statusMutation = useMutation({
    retry: false,
    mutationFn: async () => unwrapHubResult(await getPersonalAiHubStatusFn()),
    onMutate: () => setStatus(null),
    onSuccess: setStatus,
  });

  const queryMutation = useMutation({
    retry: false,
    mutationFn: async () =>
      unwrapHubResult(
        await queryPersonalAiHubKnowledgeBaseFn({
          data: {
            question,
            answerMode,
            llmModel,
            retrievalMode,
            topK: 8,
            rerankMode,
            rerankTopK: 8,
            bm25Weight: 0.45,
          },
        }),
      ),
    onMutate: () => setResult(null),
    onSuccess: setResult,
  });

  const isQueryDisabled = !question.trim() || queryMutation.isPending;

  return (
    <div className="space-y-8 max-w-5xl mx-auto animate-in fade-in duration-500">
      <header className="border-b border-border/30 pb-6 space-y-3">
        <div className="flex items-center gap-3">
          <div className="size-10 border border-border/40 flex items-center justify-center">
            <Brain size={18} strokeWidth={1.5} />
          </div>
          <div>
            <h1 className="text-3xl font-serif font-medium tracking-tight">
              Personal AI Hub
            </h1>
            <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest">
              Local knowledge, agent runtime, admin-only gateway
            </p>
          </div>
        </div>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <ModulePanel
          icon={<Database size={16} />}
          title="LLM Wiki"
          status="已接入"
          description="本地知识库查询、召回、引用与缓存。"
        />
        <ModulePanel
          icon={<Brain size={16} />}
          title="Agent Chat"
          status="已接入第一版"
          description="先检索知识库，再使用 Codex 或 opencode。"
          to="/admin/personal-ai-hub/agent-chat"
        />
        <ModulePanel
          icon={<Activity size={16} />}
          title="Tasks"
          status="规划中"
          description="学术、实验、代码项目等任务型模块。"
        />
      </section>

      <section className="border border-border/30 p-5 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-mono uppercase tracking-widest">
              Local Service
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              通过博客代理检查 E:\\wiki 本地 FastAPI 状态。
            </p>
          </div>
          <button
            type="button"
            onClick={() => statusMutation.mutate()}
            disabled={statusMutation.isPending}
            className="h-10 px-4 border border-border/40 text-xs font-mono uppercase tracking-widest hover:bg-muted/40 disabled:opacity-50"
          >
            {statusMutation.isPending ? "Checking" : "Check"}
          </button>
        </div>
        {statusMutation.error && (
          <ErrorBlock message={String(statusMutation.error.message)} />
        )}
        {status && (
          <pre className="text-xs bg-muted/20 border border-border/30 p-4 overflow-x-auto">
            {JSON.stringify(status, null, 2)}
          </pre>
        )}
      </section>

      <section className="border border-border/30 p-5 space-y-4">
        <div>
          <h2 className="text-sm font-mono uppercase tracking-widest">
            Knowledge Query
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            单轮知识问答，回答附来源引用。
          </p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <label>
            回答模式
            <select
              className="w-full border p-2 bg-background"
              value={answerMode}
              onChange={(e) =>
                setAnswerMode(e.target.value as typeof answerMode)
              }
            >
              <option value="local">检索摘录</option>
              <option value="llm_rag">DeepSeek 问答</option>
            </select>
          </label>
          <label>
            问答模型
            <select
              className="w-full border p-2 bg-background"
              value={llmModel}
              onChange={(e) => setLlmModel(e.target.value as typeof llmModel)}
            >
              <option>deepseek-flash</option>
              <option>deepseek-v4-pro</option>
            </select>
          </label>
          <label>
            检索
            <select
              className="w-full border p-2 bg-background"
              value={retrievalMode}
              onChange={(e) =>
                setRetrievalMode(e.target.value as typeof retrievalMode)
              }
            >
              <option value="hybrid">本地混合检索</option>
              <option value="bm25">BM25</option>
              <option value="vector">本地向量</option>
              <option value="local">本地词项扫描</option>
            </select>
          </label>
          <label>
            重排
            <select
              className="w-full border p-2 bg-background"
              value={rerankMode}
              onChange={(e) =>
                setRerankMode(e.target.value as typeof rerankMode)
              }
            >
              <option value="local">本地重排</option>
              <option value="off">关闭</option>
            </select>
          </label>
        </div>
        <textarea
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          rows={5}
          className="w-full border border-border/40 bg-background p-4 text-sm outline-none focus:border-foreground/70"
          placeholder="输入要查询的问题"
        />
        <button
          type="button"
          onClick={() => queryMutation.mutate()}
          disabled={isQueryDisabled}
          className="h-11 w-full flex items-center justify-center gap-2 bg-foreground text-background text-xs font-mono uppercase tracking-widest disabled:opacity-50"
        >
          {queryMutation.isPending ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Send size={14} />
          )}
          {queryMutation.isPending ? "Querying" : "Query Local Wiki"}
        </button>
        {queryMutation.error && (
          <ErrorBlock message={String(queryMutation.error.message)} />
        )}
        {result && (
          <div className="space-y-4">
            <article className="prose prose-sm max-w-none dark:prose-invert border border-border/30 p-4">
              <pre className="whitespace-pre-wrap text-sm font-sans">
                {result.answer}
              </pre>
            </article>
            <HubCitations citations={result.citations} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InfoBox title="Timings" value={result.timings} />
              <InfoBox title="Execution" value={result.execution} />
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function ModulePanel({
  icon,
  title,
  status,
  description,
  to,
}: {
  icon: ReactNode;
  title: string;
  status: string;
  description: string;
  to?: "/admin/personal-ai-hub/agent-chat";
}) {
  const content = (
    <div className="border border-border/30 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          {icon}
          <span>{title}</span>
        </div>
        <span className="text-[10px] font-mono text-muted-foreground uppercase">
          {status}
        </span>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">
        {description}
      </p>
    </div>
  );
  if (to) {
    return <Link to={to}>{content}</Link>;
  }
  return content;
}

function ErrorBlock({ message }: { message: string }) {
  return (
    <div className="border border-destructive/30 text-destructive p-3 text-xs">
      {message}
    </div>
  );
}

function InfoBox({ title, value }: { title: string; value: unknown }) {
  return (
    <div className="border border-border/30 p-4">
      <h3 className="text-xs font-mono uppercase tracking-widest mb-3">
        {title}
      </h3>
      <pre className="text-xs overflow-x-auto">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}
