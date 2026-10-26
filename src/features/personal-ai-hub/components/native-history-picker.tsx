import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { MessageSquare, X } from "lucide-react";
import { useState } from "react";
import * as Api from "../api/hub-native.admin.api";
import type { HubConversation } from "../schema/hub-chat.schema";
import { unwrapHubResult } from "../schema/personal-ai-hub.schema";
import { HubErrorNotice } from "./hub-feedback";

export function NativeHistoryPicker({
  workspaceId,
  close,
  select,
}: {
  workspaceId: string;
  close: () => void;
  select: (chat: HubConversation) => void;
}) {
  const cache = useQueryClient();
  const [archived, setArchived] = useState(false);
  const [children, setChildren] = useState(false);
  const [query, setQuery] = useState("");
  const page = useInfiniteQuery({
    queryKey: ["hub-native", workspaceId, archived, children],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) =>
      unwrapHubResult(
        await Api.listNativeCodexFn({
          data: {
            workspace_id: workspaceId,
            cursor: pageParam,
            archived,
            include_children: children,
          },
        }),
      ),
    getNextPageParam: (p) => p.next_cursor ?? undefined,
    retry: false,
  });
  const bind = useMutation({
    retry: false,
    mutationFn: async (native_id: string) =>
      unwrapHubResult(
        await Api.bindNativeCodexFn({
          data: { workspace_id: workspaceId, native_id },
        }),
      ),
    onSuccess: (result) => {
      void cache.invalidateQueries({
        queryKey: ["hub-v2", "conversations", workspaceId, "codex"],
      });
      select(result.conversation);
      close();
    },
  });
  return (
    <div className="hub-modal-backdrop">
      <section
        className="hub-modal hub-material-modal"
        role="dialog"
        aria-modal="true"
        aria-label="本机 Codex 聊天"
      >
        <div className="hub-row">
          <h2>本机 Codex 聊天</h2>
          <button
            type="button"
            aria-label="关闭"
            disabled={bind.isPending}
            onClick={close}
          >
            <X size={18} />
          </button>
        </div>
        <p className="hub-muted">
          读取当前工作区的原生记录，保留同一个会话编号。已有原生聊天目前可同步和整理，请在本机续聊。
        </p>
        <input
          aria-label="搜索已加载的原生聊天"
          placeholder="搜索已加载的聊天…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="hub-native-options">
          <label>
            <input
              type="checkbox"
              checked={archived}
              onChange={(e) => setArchived(e.target.checked)}
            />
            归档聊天
          </label>
          <label>
            <input
              type="checkbox"
              checked={children}
              onChange={(e) => setChildren(e.target.checked)}
            />
            显示子会话
          </label>
        </div>
        <div className="hub-native-list">
          {page.data?.pages
            .flatMap((p) => p.items)
            .filter((item) =>
              item.title.toLowerCase().includes(query.toLowerCase()),
            )
            .map((item) => (
              <button
                type="button"
                key={item.id}
                disabled={bind.isPending}
                onClick={() => bind.mutate(item.id)}
              >
                <MessageSquare size={17} />
                <span>
                  <strong>{item.title || item.id}</strong>
                  <small>
                    {item.source}
                    {item.parent_id ? " · 子会话" : ""} ·{" "}
                    {item.updated_at.slice(0, 10)}
                  </small>
                </span>
              </button>
            ))}
        </div>
        {page.isPending && <p>正在读取本机目录…</p>}
        <HubErrorNotice
          error={page.error ?? bind.error}
          retry={() => void page.refetch()}
        />
        {page.hasNextPage && (
          <button
            type="button"
            disabled={page.isFetchingNextPage}
            onClick={() => void page.fetchNextPage()}
          >
            更多原生聊天
          </button>
        )}
      </section>
    </div>
  );
}
