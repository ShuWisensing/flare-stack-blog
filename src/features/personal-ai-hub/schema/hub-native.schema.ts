import { z } from "zod";
import { Conversation, Workspace } from "./hub-chat.schema";
export const NativeProject = z.object({
  id: z.string(),
  cwd: z.string(),
  name: z.string(),
  native_id: z.string(),
  available: z.boolean(),
  error: z.object({ reason: z.string(), message: z.string() }).nullable(),
  workspace_id: z.string().nullable(),
  observed_chats: z.number().int().positive(),
  updated_at: z.string(),
});
export const NativeProjects = z.object({
  items: z.array(NativeProject),
  next_cursor: z.string().nullable(),
});
export const RegisterNativeProject = z.object({
  native_id: z.string().min(1).max(200),
  expected_cwd: z.string().min(1).max(4096),
  name: z.string().trim().min(1).max(80),
});
export const NativeProjectWorkspace = z.object({ workspace: Workspace });
export const NativeEntry = z.object({
  id: z.string(),
  title: z.string(),
  cwd: z.string(),
  source: z.string(),
  parent_id: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  status: z.string(),
  archived: z.boolean(),
});
export const NativePage = z.object({
  items: z.array(NativeEntry),
  next_cursor: z.string().nullable(),
});
export const NativeSync = z.object({
  conversation: Conversation,
  conversation_id: z.string(),
  native_session_id: z.string(),
  added_turns: z.number().int(),
  native_busy: z.boolean(),
  read_only: z.boolean(),
});
