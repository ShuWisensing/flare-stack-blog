import * as S from "../schema/hub-native.schema";
import { type HubRequestContext, hubFetch } from "./personal-ai-hub.service";
export const discoverNativeProjects = (
  ctx: HubRequestContext,
  input: { cursor?: string; archived?: boolean },
) => {
  const params = new URLSearchParams();
  if (input.cursor !== undefined) params.set("cursor", input.cursor);
  if (input.archived !== undefined)
    params.set("archived", String(input.archived));
  return hubFetch(
    ctx,
    "/hub/native/codex/projects?" + params,
    S.NativeProjects,
    { method: "GET" },
    25000,
  );
};
export const registerNativeProject = (
  ctx: HubRequestContext,
  input: { native_id: string; expected_cwd: string; name: string },
) =>
  hubFetch(
    ctx,
    "/hub/native/codex/projects",
    S.NativeProjectWorkspace,
    { method: "POST", body: JSON.stringify(input) },
    25000,
  );
export const listNativeCodex = (
  ctx: HubRequestContext,
  input: {
    workspace_id: string;
    cursor?: string;
    archived?: boolean;
    include_children?: boolean;
  },
) => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(input))
    if (value !== undefined) params.set(key, String(value));
  return hubFetch(
    ctx,
    "/hub/native/codex?" + params,
    S.NativePage,
    { method: "GET" },
    15000,
  );
};
export const bindNativeCodex = (
  ctx: HubRequestContext,
  input: { workspace_id: string; native_id: string },
) =>
  hubFetch(
    ctx,
    "/hub/native/codex/bindings",
    S.NativeSync,
    { method: "POST", body: JSON.stringify(input) },
    25000,
  );
export const synchronizeNativeCodex = (ctx: HubRequestContext, id: string) =>
  hubFetch(
    ctx,
    `/hub/conversations/${encodeURIComponent(id)}/native-sync`,
    S.NativeSync,
    { method: "POST", body: "{}" },
    25000,
  );
