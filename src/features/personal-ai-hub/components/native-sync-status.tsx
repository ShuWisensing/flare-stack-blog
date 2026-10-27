import { useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { useEffect } from "react";
import * as Api from "../api/hub-native.admin.api";
import { unwrapHubResult } from "../schema/personal-ai-hub.schema";
import { HubErrorNotice } from "./hub-feedback";

export function NativeSyncStatus({
  conversationId,
  readOnly,
}: {
  conversationId: string;
  readOnly: boolean;
}) {
  const cache = useQueryClient();
  const sync = useQuery({
    queryKey: ["hub-native", "sync", conversationId],
    queryFn: async () =>
      unwrapHubResult(
        await Api.synchronizeNativeCodexFn({ data: { id: conversationId } }),
      ),
    retry: false,
    refetchInterval: (query) => (query.state.error ? false : 5000),
    refetchOnWindowFocus: false,
  });
  useEffect(() => {
    if (
      sync.data &&
      (sync.data.added_turns > 0 || sync.data.read_only !== readOnly)
    ) {
      void cache.invalidateQueries({
        queryKey: ["hub-v2", "messages", conversationId],
      });
      void cache.invalidateQueries({
        queryKey: ["hub-v2", "conversation", conversationId],
      });
    }
  }, [sync.data, sync.dataUpdatedAt, cache, conversationId, readOnly]);
  return (
    <div className="hub-native-sync">
      <div className="hub-row">
        <span>
          {readOnly
            ? "原生聊天 · 可同步与整理，请在本机续聊"
            : "已关联同一条本机 Codex 聊天 · 桌面持锁时请先释放"}
          {sync.data?.native_busy ? " · 本机任务进行中" : ""}
        </span>
        <button
          type="button"
          disabled={sync.isFetching}
          onClick={() => void sync.refetch()}
        >
          <RefreshCw size={12} />
          刷新原生记录
        </button>
      </div>
      <HubErrorNotice error={sync.error} />
    </div>
  );
}
