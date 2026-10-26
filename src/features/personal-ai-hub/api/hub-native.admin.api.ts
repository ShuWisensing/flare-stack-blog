import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { adminMiddleware } from "@/lib/middlewares";
import { RegisterNativeProject } from "../schema/hub-native.schema";
import * as N from "../service/hub-native.service";

export const discoverNativeProjectsFn = createServerFn({ method: "GET" })
  .middleware([adminMiddleware])
  .inputValidator(
    z.object({
      cursor: z.string().max(2048).optional(),
      archived: z.boolean().optional(),
    }),
  )
  .handler(({ context, data }) => N.discoverNativeProjects(context, data));
export const registerNativeProjectFn = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .inputValidator(RegisterNativeProject)
  .handler(({ context, data }) => N.registerNativeProject(context, data));

const Id = z.string().min(1).max(200);
export const listNativeCodexFn = createServerFn({ method: "GET" })
  .middleware([adminMiddleware])
  .inputValidator(
    z.object({
      workspace_id: Id,
      cursor: z.string().max(2048).optional(),
      archived: z.boolean().optional(),
      include_children: z.boolean().optional(),
    }),
  )
  .handler(({ context, data }) => N.listNativeCodex(context, data));
export const bindNativeCodexFn = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .inputValidator(z.object({ workspace_id: Id, native_id: Id }))
  .handler(({ context, data }) => N.bindNativeCodex(context, data));
export const synchronizeNativeCodexFn = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .inputValidator(z.object({ id: Id }))
  .handler(({ context, data }) => N.synchronizeNativeCodex(context, data.id));
