import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useState } from "react";
import * as Api from "../api/hub-knowledge.admin.api";
import { unwrapHubResult } from "../schema/personal-ai-hub.schema";
import { HubErrorNotice } from "./hub-feedback";

export function ChatKnowledgeCapture({
  conversationId,
  messages,
  close,
}: {
  conversationId: string;
  messages: { id: string; role: string; content_md: string }[];
  close: () => void;
}) {
  const cache = useQueryClient();
  const visible = messages.slice(-50);
  const [selected, setSelected] = useState(
    () => new Set(visible.map((m) => m.id)),
  );
  const [requestId] = useState(() => crypto.randomUUID());
  const save = useMutation({
    retry: false,
    mutationFn: async () =>
      unwrapHubResult(
        await Api.collectKnowledgeChatFn({
          data: {
            request_id: requestId,
            conversation_id: conversationId,
            message_ids: visible
              .filter((m) => selected.has(m.id))
              .map((m) => m.id),
          },
        }),
      ),
    onSuccess: () => {
      void cache.invalidateQueries({ queryKey: ["hub-knowledge"] });
      close();
    },
  });
  return (
    <div className="hub-modal-backdrop">
      <section
        className="hub-modal hub-material-modal"
        role="dialog"
        aria-modal="true"
        aria-label="保存聊天资料"
      >
        <div className="hub-row">
          <h2>保存聊天资料</h2>
          <button
            type="button"
            aria-label="关闭"
            disabled={save.isPending}
            onClick={close}
          >
            <X size={18} />
          </button>
        </div>
        <p className="hub-muted">
          保留所选消息及原始角色。保存后可在资料库整理成知识，经确认后再用于问答。
        </p>
        <div className="hub-capture-messages">
          {visible.map((m) => (
            <label key={m.id}>
              <input
                type="checkbox"
                aria-label={"选择消息 " + m.id}
                checked={selected.has(m.id)}
                disabled={save.isPending}
                onChange={(e) =>
                  setSelected((previous) => {
                    const next = new Set(previous);
                    if (e.target.checked) next.add(m.id);
                    else next.delete(m.id);
                    return next;
                  })
                }
              />
              <span>
                <strong>{m.role === "user" ? "你" : "助手"}</strong>
                <span>{m.content_md}</span>
              </span>
            </label>
          ))}
        </div>
        <small>
          本次显示最近加载的 {visible.length}{" "}
          条消息。只保存正文，工具输出和执行日志不参与整理。
        </small>
        <HubErrorNotice error={save.error} />
        <button
          type="button"
          className="hub-primary"
          disabled={save.isPending || selected.size === 0}
          onClick={() => save.mutate()}
        >
          {save.isPending ? "正在保存…" : "保存所选聊天"}
        </button>
      </section>
    </div>
  );
}
