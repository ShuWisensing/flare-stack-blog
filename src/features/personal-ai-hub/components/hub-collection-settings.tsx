import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useState } from "react";
import type { z } from "zod";
import * as Api from "../api/hub-knowledge.admin.api";
import type { CollectionSettings } from "../schema/hub-knowledge.schema";
import { unwrapHubResult } from "../schema/personal-ai-hub.schema";
import { HubErrorNotice } from "./hub-feedback";

function CollectionEditor({
  config,
}: {
  config: z.infer<typeof CollectionSettings>;
}) {
  const cache = useQueryClient();
  const [enabled, setEnabled] = useState(config.enabled);
  const [auto, setAuto] = useState(config.auto_extract);
  const [model, setModel] = useState(config.model);
  const save = useMutation({
    retry: false,
    mutationFn: async () =>
      unwrapHubResult(
        await Api.configureKnowledgeCollectionFn({
          data: {
            workspace_id: config.workspace_id,
            version: config.version,
            enabled,
            auto_extract: auto,
            model,
          },
        }),
      ),
    onSuccess: (result) =>
      cache.setQueryData(
        ["hub-knowledge", "collection", config.workspace_id],
        result,
      ),
  });
  return (
    <div className="hub-collection-editor">
      <label>
        <input
          type="checkbox"
          aria-label="收集本项目的新 Codex 聊天"
          checked={enabled}
          disabled={save.isPending}
          onChange={(e) => {
            setEnabled(e.target.checked);
            if (!e.target.checked) setAuto(false);
          }}
        />
        收集本项目的新 Codex 聊天
      </label>
      <p className="hub-muted">
        每分钟观察启用后新完成的轮次，保存原文、角色和消息编号。不会回填全部旧聊天，也不会操作本机
        Codex。
      </p>
      <label>
        <input
          type="checkbox"
          aria-label="自动整理知识候选（调用 DeepSeek）"
          checked={auto}
          disabled={!enabled || save.isPending}
          onChange={(e) => setAuto(e.target.checked)}
        />
        自动整理知识候选（调用 DeepSeek）
      </label>
      <p className="hub-muted">
        开启后，符合条件的聊天正文会发给所选 DeepSeek 模型。每次最多 60000
        字符；未确认候选不会参与知识问答。
      </p>
      <label>
        整理模型
        <select
          value={model}
          disabled={!enabled || !auto || save.isPending}
          onChange={(e) => setModel(e.target.value as typeof model)}
        >
          <option value="deepseek-flash">DeepSeek Flash</option>
          <option value="deepseek-v4-pro">DeepSeek V4 Pro</option>
        </select>
      </label>
      {config.last_scan_at && (
        <small>
          上次观察：{new Date(config.last_scan_at).toLocaleString()}
        </small>
      )}
      {config.last_error && (
        <p role="alert" className="hub-error">
          {config.last_error.message}
        </p>
      )}
      <HubErrorNotice error={save.error} />
      <button
        type="button"
        className="hub-primary"
        disabled={save.isPending}
        onClick={() => save.mutate()}
      >
        {save.isPending ? "正在保存…" : "保存收集设置"}
      </button>
    </div>
  );
}

export function HubCollectionSettings({
  workspaceId,
  close,
}: {
  workspaceId: string;
  close: () => void;
}) {
  const query = useQuery({
    queryKey: ["hub-knowledge", "collection", workspaceId],
    queryFn: async () =>
      unwrapHubResult(
        await Api.getKnowledgeCollectionFn({
          data: { workspace_id: workspaceId },
        }),
      ),
    retry: false,
  });
  return (
    <div className="hub-modal-backdrop">
      <section
        className="hub-modal hub-material-modal"
        role="dialog"
        aria-modal="true"
        aria-label="日常聊天收集"
      >
        <div className="hub-row">
          <h2>日常聊天收集</h2>
          <button type="button" aria-label="关闭" onClick={close}>
            <X size={18} />
          </button>
        </div>
        {query.data && (
          <CollectionEditor key={query.data.version} config={query.data} />
        )}
        <HubErrorNotice
          error={query.error}
          retry={() => void query.refetch()}
        />
        {query.isPending && <p>正在读取设置…</p>}
      </section>
    </div>
  );
}
