import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { MessageSquare, RefreshCw } from "lucide-react";
import * as Api from "../api/hub-native.admin.api";
import type { HubConversation } from "../schema/hub-chat.schema";
import { unwrapHubResult } from "../schema/personal-ai-hub.schema";
import { HubErrorNotice } from "./hub-feedback";

export function NativeConversationList({
  workspaceId,
  selectedId,
  select,
}: {
  workspaceId: string;
  selectedId?: string;
  select: (chat: HubConversation) => void;
}) {
  const cache = useQueryClient();
  const page = useInfiniteQuery({
    queryKey: ["hub-native", workspaceId, false, false],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) =>
      unwrapHubResult(
        await Api.listNativeCodexFn({
          data: {
            workspace_id: workspaceId,
            cursor: pageParam,
            archived: false,
            include_children: false,
          },
        }),
      ),
    getNextPageParam: (page) => page.next_cursor ?? undefined,
    retry: false,
    refetchOnWindowFocus: true,
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
      cache.setQueryData(["hub-v2", "conversation", result.conversation.id], {
        conversation: result.conversation,
      });
      void cache.invalidateQueries({
        queryKey: ["hub-v2", "messages", result.conversation.id],
      });
      select(result.conversation);
    },
  });
  const items = Array.from(
    new Map(
      page.data?.pages
        .flatMap((page) => page.items)
        .map((item) => [item.id, item]),
    ).values(),
  );
  return (
    <div className="hub-chat-links">
      <button
        type="button"
        disabled={page.isFetching}
        onClick={() => void page.refetch()}
      >
        <RefreshCw size={13} />
        刷新本机聊天
      </button>
      {items.map((item) => (
        <button
          type="button"
          key={item.id}
          title={item.title}
          disabled={bind.isPending}
          className={selectedId === item.id ? "is-selected" : ""}
          onClick={() => bind.mutate(item.id)}
        >
          <MessageSquare size={13} />
          <span>{item.title || item.id}</span>
        </button>
      ))}
      {page.isPending && <p className="hub-muted">读取本机聊天…</p>}
      {page.data && items.length === 0 && (
        <p className="hub-muted">这个目录尚无原生聊天，可点击“新对话”开始。</p>
      )}
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
    </div>
  );
}
