import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  Archive,
  Brain,
  ChevronDown,
  Folder,
  MessageSquare,
  Network,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  Settings2,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import * as Api from "../api/hub-chat.admin.api";
import type { HubConversation, HubWorkspace } from "../schema/hub-chat.schema";
import { unwrapHubResult } from "../schema/personal-ai-hub.schema";
import { HubConversationView } from "./hub-conversation";
import { HubErrorNotice } from "./hub-feedback";
import { WikiGraphView } from "./wiki-graph-view";
import "../hub.css";

export type HubLocation = {
  view: "chat" | "graph" | "sources" | "reader";
  scope: "knowledge" | "evidence";
  workspace?: string;
  chat?: string;
  node?: string;
};
export type HubNavigation = (location: HubLocation) => void;

function WorkspaceGroup({
  workspace,
  location,
  navigate,
}: {
  workspace: HubWorkspace;
  location: HubLocation;
  navigate: HubNavigation;
}) {
  const cache = useQueryClient();
  const [name, setName] = useState(workspace.name);
  const rename = useMutation({
    retry: false,
    mutationFn: async () =>
      unwrapHubResult(
        await Api.renameHubWorkspaceFn({ data: { id: workspace.id, name } }),
      ),
    onSuccess: () =>
      cache.invalidateQueries({ queryKey: ["hub-v2", "workspaces"] }),
  });
  const active = location.workspace === workspace.id;
  const chats = useInfiniteQuery({
    queryKey: ["hub-v2", "conversations", workspace.id],
    enabled: active,
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) =>
      unwrapHubResult(
        await Api.listHubConversationsFn({
          data: { workspace_id: workspace.id, cursor: pageParam },
        }),
      ),
    getNextPageParam: (page) => page.next_cursor ?? undefined,
    retry: false,
  });
  return (
    <section className="hub-workspace-group">
      <div className="hub-workspace-row">
        <button
          type="button"
          className="hub-workspace-button"
          aria-expanded={active}
          onClick={() =>
            navigate({
              ...location,
              view: "chat",
              workspace: workspace.id,
              chat: undefined,
            })
          }
        >
          <Folder size={16} />
          <span>{workspace.name}</span>
          <ChevronDown size={13} className={active ? "" : "-rotate-90"} />
        </button>
        <details className="hub-conversation-actions">
          <summary aria-label={`工作区设置 ${workspace.name}`}>
            <Settings2 size={13} />
          </summary>
          <div className="hub-menu">
            <form
              onSubmit={(event) => {
                event.preventDefault();
                if (name.trim()) rename.mutate();
              }}
            >
              <label>
                工作区名称
                <input
                  aria-label={`工作区名称 ${workspace.name}`}
                  maxLength={80}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </label>
              <button type="submit" disabled={!name.trim() || rename.isPending}>
                保存工作区名称
              </button>
            </form>
            <small className="hub-muted">
              目录绑定保持为 {workspace.root_path}
            </small>
            <HubErrorNotice error={rename.error} />
          </div>
        </details>
      </div>
      {!workspace.available && (
        <p className="hub-small-error">
          {workspace.error?.message ?? "目录不可用"}
        </p>
      )}
      {active && (
        <div className="hub-chat-links">
          {chats.data?.pages
            .flatMap((page) => page.items)
            .map((chat) => (
              <button
                type="button"
                key={chat.id}
                className={location.chat === chat.id ? "is-selected" : ""}
                onClick={() =>
                  navigate({
                    ...location,
                    view: "chat",
                    workspace: workspace.id,
                    chat: chat.id,
                  })
                }
                title={chat.title}
              >
                <MessageSquare size={13} />
                <span>{chat.title}</span>
              </button>
            ))}
          {chats.isPending && <p className="hub-muted">读取聊天…</p>}
          {chats.data && chats.data.pages[0].items.length === 0 && (
            <p className="hub-muted">还没有聊天</p>
          )}
          <HubErrorNotice
            error={chats.error}
            retry={() => void chats.refetch()}
          />
          {chats.hasNextPage && (
            <button
              type="button"
              disabled={chats.isFetchingNextPage}
              onClick={() => void chats.fetchNextPage()}
            >
              更多聊天
            </button>
          )}
        </div>
      )}
    </section>
  );
}

function ArchivedChats({
  workspaceId,
  close,
  restore,
}: {
  workspaceId: string;
  close: () => void;
  restore: (chat: HubConversation) => void;
}) {
  const cache = useQueryClient();
  const chats = useInfiniteQuery({
    queryKey: ["hub-v2", "archived", workspaceId],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) =>
      unwrapHubResult(
        await Api.listHubConversationsFn({
          data: {
            workspace_id: workspaceId,
            include_archived: true,
            cursor: pageParam,
          },
        }),
      ),
    getNextPageParam: (page) => page.next_cursor ?? undefined,
    retry: false,
  });
  const mutation = useMutation({
    retry: false,
    mutationFn: async (id: string) =>
      unwrapHubResult(
        await Api.updateHubConversationFn({ data: { id, archived: false } }),
      ),
    onSuccess: (result) => {
      void cache.invalidateQueries({
        queryKey: ["hub-v2", "conversations", workspaceId],
      });
      restore(result.conversation);
      close();
    },
  });
  const archived = chats.data?.pages
    .flatMap((page) => page.items)
    .filter((chat) => Boolean(chat.archived_at));
  return (
    <div
      className="hub-modal-backdrop"
      onKeyDown={(event) => {
        if (event.key === "Escape") close();
      }}
    >
      <section
        className="hub-modal"
        role="dialog"
        aria-modal="true"
        aria-label="已归档聊天"
      >
        <div className="hub-row">
          <h2>已归档聊天</h2>
          <button type="button" aria-label="关闭归档列表" onClick={close}>
            <X size={17} />
          </button>
        </div>
        <div className="hub-detail-scroll">
          {archived?.map((chat) => (
            <div key={chat.id} className="hub-row py-2">
              <span>{chat.title}</span>
              <button
                type="button"
                disabled={mutation.isPending}
                aria-label={`恢复 ${chat.title}`}
                onClick={() => mutation.mutate(chat.id)}
              >
                恢复
              </button>
            </div>
          ))}
          {chats.data && archived?.length === 0 && (
            <p className="hub-muted">当前已读取的记录中没有归档聊天。</p>
          )}
          {chats.hasNextPage && (
            <button type="button" onClick={() => void chats.fetchNextPage()}>
              继续读取
            </button>
          )}
        </div>
        <HubErrorNotice error={chats.error ?? mutation.error} />
      </section>
    </div>
  );
}

function ProjectPicker({
  close,
  select,
}: {
  close: () => void;
  select: (workspace: HubWorkspace) => void;
}) {
  const cache = useQueryClient();
  const roots = useQuery({
    queryKey: ["hub-v2", "roots"],
    queryFn: async () => unwrapHubResult(await Api.listHubRootsFn()),
    retry: false,
  });
  const create = useMutation({
    retry: false,
    mutationFn: async (root: { key: string; name: string }) =>
      unwrapHubResult(
        await Api.createHubWorkspaceFn({
          data: { root_key: root.key, name: root.name },
        }),
      ),
    onSuccess: (result) => {
      void cache.invalidateQueries({ queryKey: ["hub-v2", "workspaces"] });
      select(result.workspace);
      close();
    },
  });
  return (
    <div
      className="hub-modal-backdrop"
      onKeyDown={(event) => {
        if (event.key === "Escape") close();
      }}
    >
      <section
        className="hub-modal"
        role="dialog"
        aria-modal="true"
        aria-label="添加工作区"
      >
        <div className="hub-row">
          <h2>选择项目目录</h2>
          <button type="button" aria-label="关闭" onClick={close}>
            <X size={18} />
          </button>
        </div>
        <p className="hub-muted">
          使用本机登记的目录。添加工作区不会把项目导入知识库。
        </p>
        {roots.data?.items.map((root) => (
          <button
            type="button"
            className="hub-root-option"
            disabled={!root.available || create.isPending}
            key={root.key}
            onClick={() => create.mutate(root)}
          >
            <Folder size={18} />
            <span>
              <strong>{root.name}</strong>
              <small>{root.path}</small>
              {!root.available && <small>{root.error?.message}</small>}
            </span>
            <Plus size={16} />
          </button>
        ))}
        <HubErrorNotice
          error={roots.error ?? create.error}
          retry={() => void roots.refetch()}
        />
      </section>
    </div>
  );
}

function ConversationActions({
  chat,
  navigate,
  location,
}: {
  chat: HubConversation;
  navigate: HubNavigation;
  location: HubLocation;
}) {
  const cache = useQueryClient();
  const [title, setTitle] = useState(chat.title);
  const change = useMutation({
    retry: false,
    mutationFn: async (input: { title?: string; archived?: boolean }) =>
      unwrapHubResult(
        await Api.updateHubConversationFn({ data: { id: chat.id, ...input } }),
      ),
    onSuccess: (_, input) => {
      void cache.invalidateQueries({
        queryKey: ["hub-v2", "conversations", chat.workspace_id],
      });
      void cache.invalidateQueries({
        queryKey: ["hub-v2", "conversation", chat.id],
      });
      if (input.archived) navigate({ ...location, chat: undefined });
    },
  });
  return (
    <details className="hub-conversation-actions">
      <summary aria-label="聊天设置">
        <Settings2 size={17} />
      </summary>
      <div className="hub-menu">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (title.trim()) change.mutate({ title });
          }}
        >
          <label>
            聊天名称
            <input
              aria-label="聊天名称"
              value={title}
              maxLength={120}
              onChange={(event) => setTitle(event.target.value)}
            />
          </label>
          <button type="submit" disabled={change.isPending || !title.trim()}>
            保存名称
          </button>
        </form>
        <button
          type="button"
          disabled={change.isPending || Boolean(chat.active_turn)}
          onClick={() => change.mutate({ archived: true })}
        >
          <Archive size={14} />
          归档聊天
        </button>
        <HubErrorNotice error={change.error} />
      </div>
    </details>
  );
}

export function HubApp({
  mode,
  location,
  navigate,
}: {
  mode: "wiki" | "agent";
  location: HubLocation;
  navigate: HubNavigation;
}) {
  const cache = useQueryClient();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarHidden, setSidebarHidden] = useState(false);
  const [adding, setAdding] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [runtime, setRuntime] = useState<"codex" | "opencode">("codex");
  const workspaces = useInfiniteQuery({
    queryKey: ["hub-v2", "workspaces", mode],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) =>
      unwrapHubResult(
        await Api.listHubWorkspacesFn({
          data: { kind: mode, cursor: pageParam },
        }),
      ),
    getNextPageParam: (page) => page.next_cursor ?? undefined,
    retry: false,
  });
  const workspaceItems = workspaces.data?.pages.flatMap((page) => page.items);
  const currentWorkspace = workspaceItems?.find(
    (workspace) => workspace.id === location.workspace,
  );
  useEffect(() => {
    if (mode === "wiki" && !location.workspace && workspaceItems?.length === 1)
      navigate({ ...location, workspace: workspaceItems[0].id });
  }, [mode, location, workspaceItems, navigate]);
  const current = useQuery({
    queryKey: ["hub-v2", "conversation", location.chat],
    enabled: Boolean(location.chat),
    queryFn: async () => {
      if (!location.chat) throw new Error("未选择聊天");
      return unwrapHubResult(
        await Api.getHubConversationFn({ data: { id: location.chat } }),
      );
    },
    retry: false,
  });
  const chat = current.data?.conversation;
  const create = useMutation({
    retry: false,
    mutationFn: async () => {
      if (!currentWorkspace?.available) throw new Error("请先选择可用的工作区");
      return unwrapHubResult(
        await Api.createHubConversationFn({
          data: {
            workspace_id: currentWorkspace.id,
            runtime: mode === "wiki" ? "wiki" : runtime,
            title: "新对话",
            model_id:
              mode === "agent" && runtime === "codex" ? null : "deepseek-flash",
          },
        }),
      );
    },
    onSuccess: (result) => {
      void cache.invalidateQueries({
        queryKey: ["hub-v2", "conversations", result.conversation.workspace_id],
      });
      navigate({
        ...location,
        workspace: result.conversation.workspace_id,
        chat: result.conversation.id,
        view: "chat",
      });
      setSidebarOpen(false);
    },
  });
  const changeLocation: HubNavigation = (next) => {
    navigate(next);
    setSidebarOpen(false);
  };
  const openNode = (node: string) =>
    navigate({ ...location, view: "reader", node });
  const workspaceMismatch =
    chat &&
    (chat.workspace_id !== location.workspace ||
      (mode === "wiki") !== (chat.runtime === "wiki"));
  return (
    <div className="hub-app" data-sidebar-hidden={sidebarHidden}>
      {sidebarOpen && (
        <button
          className="hub-sidebar-scrim"
          type="button"
          aria-label="关闭会话侧栏"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside
        className={`hub-sidebar ${sidebarOpen ? "is-open" : ""}`}
        aria-label="工作区和聊天"
      >
        <div className="hub-sidebar-brand">
          <Brain size={20} />
          <span>Personal AI Hub</span>
          <button
            type="button"
            aria-label="收起会话侧栏"
            onClick={() => {
              setSidebarHidden(true);
              setSidebarOpen(false);
            }}
          >
            <PanelLeftClose size={17} />
          </button>
        </div>
        <button
          type="button"
          className="hub-new-chat"
          disabled={!currentWorkspace?.available || create.isPending}
          onClick={() => create.mutate()}
        >
          <Plus size={17} />
          新对话
        </button>
        {mode === "wiki" && (
          <nav className="hub-view-tabs" aria-label="知识库视图">
            {(
              [
                { view: "chat", label: "对话", Icon: MessageSquare },
                { view: "graph", label: "知识图谱", Icon: Network },
                { view: "sources", label: "资料库", Icon: Search },
              ] as const
            ).map(({ view, label, Icon }) => (
              <button
                type="button"
                key={view}
                className={location.view === view ? "is-active" : ""}
                onClick={() =>
                  changeLocation({ ...location, view, node: undefined })
                }
              >
                <Icon size={16} />
                {label}
              </button>
            ))}
          </nav>
        )}
        <div className="hub-sidebar-scroll">
          <div className="hub-section-label">
            {mode === "wiki" ? "聊天记录" : "工作区"}
            {mode === "agent" && (
              <button
                type="button"
                aria-label="添加工作区"
                onClick={() => setAdding(true)}
              >
                <Plus size={15} />
              </button>
            )}
          </div>
          {workspaces.isPending && <p className="hub-muted">正在连接本机…</p>}
          {workspaceItems?.map((workspace) => (
            <WorkspaceGroup
              key={workspace.id}
              workspace={workspace}
              location={location}
              navigate={changeLocation}
            />
          ))}
          {workspaces.data && workspaceItems?.length === 0 && (
            <button
              type="button"
              className="hub-empty-project"
              onClick={() => setAdding(true)}
            >
              <Folder size={20} />
              添加一个项目工作区
            </button>
          )}
          {workspaces.hasNextPage && (
            <button
              type="button"
              onClick={() => void workspaces.fetchNextPage()}
            >
              更多工作区
            </button>
          )}
          <HubErrorNotice
            error={workspaces.error}
            retry={() => void workspaces.refetch()}
          />
        </div>
        <button
          type="button"
          className="hub-archived-button"
          disabled={!currentWorkspace}
          onClick={() => setShowArchived(true)}
        >
          <Archive size={13} />
          已归档聊天
        </button>
        <p className="hub-storage-note">聊天保存在本机 · SQLite</p>
      </aside>
      <main className="hub-main">
        <header className="hub-header">
          <button
            type="button"
            className="hub-sidebar-toggle"
            aria-label="展开会话侧栏"
            onClick={() => {
              setSidebarHidden(false);
              setSidebarOpen(true);
            }}
          >
            <PanelLeftOpen size={18} />
          </button>
          <div className="hub-heading">
            <h1>
              {mode === "wiki" && location.view !== "chat"
                ? { graph: "知识图谱", sources: "资料库", reader: "知识阅读" }[
                    location.view
                  ]
                : (chat?.title ??
                  (mode === "wiki" ? "我的知识库" : "Agent Chat"))}
            </h1>
            <span>
              {mode === "wiki"
                ? "Wiki · 查找与询问"
                : (currentWorkspace?.name ?? "选择项目工作区")}
            </span>
          </div>
          {mode === "agent" && (
            <label className="hub-runtime-picker">
              新对话执行器
              <select
                aria-label="新对话执行器"
                value={runtime}
                onChange={(event) =>
                  setRuntime(event.target.value as "codex" | "opencode")
                }
              >
                <option value="codex">Codex</option>
                <option value="opencode">opencode</option>
              </select>
            </label>
          )}
          {chat && location.view === "chat" && (
            <ConversationActions
              key={chat.id}
              chat={chat}
              location={location}
              navigate={navigate}
            />
          )}
        </header>
        <HubErrorNotice
          error={create.error ?? current.error}
          retry={current.error ? () => void current.refetch() : undefined}
        />
        {workspaceMismatch ? (
          <div className="hub-error">
            聊天与当前工作区或执行器类型不一致，请从侧栏重新选择。
          </div>
        ) : mode === "wiki" && location.view !== "chat" ? (
          <WikiGraphView location={location} navigate={navigate} />
        ) : chat ? (
          <HubConversationView
            key={chat.id}
            chat={chat}
            onNode={mode === "wiki" ? openNode : undefined}
          />
        ) : (
          <div className="hub-welcome">
            <span className="hub-welcome-icon">
              {mode === "wiki" ? <Brain size={28} /> : <Folder size={28} />}
            </span>
            <h2>
              {mode === "wiki" ? "从你的知识中找到答案" : "在项目里开始工作"}
            </h2>
            <p>
              {mode === "wiki"
                ? "查找资料、追问概念，或沿着知识图谱继续探索。"
                : "选择一个本机项目，用 Codex 或 opencode 开始独立聊天。"}
            </p>
            <button
              type="button"
              className="hub-primary"
              disabled={!currentWorkspace?.available || create.isPending}
              onClick={() => create.mutate()}
            >
              <Plus size={17} />
              开始新对话
            </button>
          </div>
        )}
      </main>
      {adding && (
        <ProjectPicker
          close={() => setAdding(false)}
          select={(workspace) =>
            navigate({
              ...location,
              workspace: workspace.id,
              chat: undefined,
              view: "chat",
            })
          }
        />
      )}
      {showArchived && currentWorkspace && (
        <ArchivedChats
          workspaceId={currentWorkspace.id}
          close={() => setShowArchived(false)}
          restore={(chat) =>
            navigate({
              ...location,
              workspace: chat.workspace_id,
              chat: chat.id,
              view: "chat",
            })
          }
        />
      )}
    </div>
  );
}
