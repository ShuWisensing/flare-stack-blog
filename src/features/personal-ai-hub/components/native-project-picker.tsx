import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { Folder, X } from "lucide-react";
import { useState } from "react";
import * as Api from "../api/hub-native.admin.api";
import type { HubWorkspace } from "../schema/hub-chat.schema";
import { unwrapHubResult } from "../schema/personal-ai-hub.schema";
import { HubErrorNotice } from "./hub-feedback";

export function NativeProjectPicker({
  close,
  select,
}: {
  close: () => void;
  select: (workspace: HubWorkspace) => void;
}) {
  const cache = useQueryClient();
  const [archived, setArchived] = useState(false);
  const [query, setQuery] = useState("");
  const projects = useInfiniteQuery({
    queryKey: ["hub-native", "projects", archived],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) =>
      unwrapHubResult(
        await Api.discoverNativeProjectsFn({
          data: { cursor: pageParam, archived },
        }),
      ),
    getNextPageParam: (page) => page.next_cursor ?? undefined,
    retry: false,
  });
  const register = useMutation({
    retry: false,
    mutationFn: async (input: {
      native_id: string;
      expected_cwd: string;
      name: string;
    }) => unwrapHubResult(await Api.registerNativeProjectFn({ data: input })),
    onSuccess: ({ workspace }) => {
      void cache.invalidateQueries({ queryKey: ["hub-v2", "workspaces"] });
      void cache.invalidateQueries({ queryKey: ["hub-v2", "roots"] });
      void cache.invalidateQueries({ queryKey: ["hub-native", "projects"] });
      select(workspace);
      close();
    },
  });
  const items = Array.from(
    new Map(
      projects.data?.pages
        .flatMap((page) => page.items)
        .map((item) => [item.id, item]),
    ).values(),
  );
  return (
    <div className="hub-modal-backdrop">
      <section
        className="hub-modal hub-material-modal"
        role="dialog"
        aria-modal="true"
        aria-label="发现本机项目"
      >
        <div className="hub-row">
          <h2>本机 Codex 项目</h2>
          <button
            type="button"
            aria-label="返回目录选择"
            onClick={close}
            disabled={register.isPending}
          >
            <X size={18} />
          </button>
        </div>
        <p className="hub-muted">
          从原生聊天发现项目目录。接入只登记工作区，聊天由你按需选择。
        </p>
        <input
          aria-label="搜索已发现项目"
          placeholder="搜索项目名称或目录…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="hub-native-options">
          <label>
            <input
              type="checkbox"
              checked={archived}
              onChange={(e) => setArchived(e.target.checked)}
              disabled={register.isPending}
            />
            从归档聊天发现
          </label>
        </div>
        <div className="hub-native-list">
          {items
            .filter((item) =>
              (item.name + " " + item.cwd)
                .toLowerCase()
                .includes(query.toLowerCase()),
            )
            .map((item) => (
              <div className="hub-native-project" key={item.id}>
                <Folder size={18} />
                <span>
                  <strong>{item.name}</strong>
                  <small>{item.cwd}</small>
                  {!item.available && <small>{item.error?.message}</small>}
                </span>
                <button
                  type="button"
                  aria-label={`接入 ${item.name}`}
                  disabled={!item.available || register.isPending}
                  onClick={() =>
                    register.mutate({
                      native_id: item.native_id,
                      expected_cwd: item.cwd,
                      name: item.name,
                    })
                  }
                >
                  {item.workspace_id ? "打开工作区" : "接入"}
                </button>
              </div>
            ))}
        </div>
        {projects.isPending && <p>正在发现项目…</p>}
        {projects.data && items.length === 0 && (
          <p className="hub-muted">当前已读取的记录中没有项目。</p>
        )}
        <HubErrorNotice
          error={projects.error ?? register.error}
          retry={() => void projects.refetch()}
        />
        {projects.hasNextPage && (
          <button
            type="button"
            disabled={projects.isFetchingNextPage || register.isPending}
            onClick={() => void projects.fetchNextPage()}
          >
            {projects.isFetchingNextPage ? "正在读取…" : "继续发现项目"}
          </button>
        )}
      </section>
    </div>
  );
}
