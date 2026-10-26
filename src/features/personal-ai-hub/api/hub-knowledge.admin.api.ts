import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { adminMiddleware } from "@/lib/middlewares";
import * as S from "../schema/hub-knowledge.schema";
import * as K from "../service/hub-knowledge.service";
export const getKnowledgeCollectionFn = createServerFn({ method: "GET" })
  .middleware([adminMiddleware])
  .inputValidator(z.object({ workspace_id: z.string().min(1).max(200) }))
  .handler(({ context, data }) =>
    K.getKnowledgeCollection(context, data.workspace_id),
  );
export const configureKnowledgeCollectionFn = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .inputValidator(S.CollectionInput)
  .handler(({ context, data }) =>
    K.configureKnowledgeCollection(context, data),
  );
export const rebuildKnowledgeFn = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .inputValidator(z.object({ request_id: z.string().min(1).max(128) }))
  .handler(({ context, data }) => K.rebuildKnowledge(context, data.request_id));

const Id = z.object({ id: z.string().min(1).max(200) });
export const getKnowledgeCatalogFn = createServerFn({ method: "GET" })
  .middleware([adminMiddleware])
  .handler(({ context }) => K.getKnowledgeCatalog(context));
export const getIngestCapabilitiesFn = createServerFn({ method: "GET" })
  .middleware([adminMiddleware])
  .handler(({ context }) => K.getIngestCapabilities(context));
export const beginKnowledgeUploadFn = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .inputValidator(
    z.object({
      request_id: z.string().min(1).max(128),
      filename: z.string().min(1).max(200),
      size_bytes: z
        .number()
        .int()
        .positive()
        .max(20 * 1024 * 1024),
      sha256: z.string().regex(/^[a-f0-9]{64}$/),
    }),
  )
  .handler(({ context, data }) => K.beginKnowledgeUpload(context, data));
export const sendKnowledgeChunkFn = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .inputValidator(
    Id.extend({
      index: z.number().int().min(0).max(20),
      data_base64: z.string().max(1398104),
      sha256: z.string().regex(/^[a-f0-9]{64}$/),
    }),
  )
  .handler(({ context, data: { id, ...body } }) =>
    K.sendKnowledgeChunk(context, id, body),
  );
export const finishKnowledgeUploadFn = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .inputValidator(
    Id.extend({ previous_source_id: z.string().min(1).max(200).optional() }),
  )
  .handler(({ context, data }) =>
    K.finishKnowledgeUpload(context, data.id, data.previous_source_id),
  );
export const submitKnowledgeImportFn = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .inputValidator(S.TextInput)
  .handler(({ context, data }) => K.submitKnowledgeImport(context, data));
export const submitKnowledgeExtractionFn = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .inputValidator(S.ExtractInput)
  .handler(({ context, data }) => K.submitKnowledgeExtraction(context, data));
export const getKnowledgeJobFn = createServerFn({ method: "GET" })
  .middleware([adminMiddleware])
  .inputValidator(Id)
  .handler(({ context, data }) => K.getKnowledgeJob(context, data.id));
export const retryKnowledgeJobFn = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .inputValidator(Id)
  .handler(({ context, data }) => K.retryKnowledgeJob(context, data.id));
export const getKnowledgeCandidatesFn = createServerFn({ method: "GET" })
  .middleware([adminMiddleware])
  .inputValidator(z.object({ cursor: z.string().min(1).max(2048).optional() }))
  .handler(({ context, data }) =>
    K.getKnowledgeCandidates(context, data.cursor),
  );
export const editKnowledgeCandidateFn = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .inputValidator(Id.extend(S.CandidateEditInput.shape))
  .handler(({ context, data: { id, ...body } }) =>
    K.editKnowledgeCandidate(context, id, body),
  );
export const publishKnowledgeCandidatesFn = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .inputValidator(
    z.object({
      request_id: z.string().min(1).max(128),
      candidates: z
        .array(
          z.object({
            id: z.string().min(1).max(200),
            version: z.number().int().positive(),
          }),
        )
        .min(1)
        .max(50),
    }),
  )
  .handler(({ context, data }) => K.publishKnowledgeCandidates(context, data));
export const collectKnowledgeChatFn = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .inputValidator(
    z.object({
      request_id: z.string().min(1).max(128),
      conversation_id: z.string().min(1).max(200),
      message_ids: z.array(z.string().min(1).max(200)).min(1).max(50),
    }),
  )
  .handler(({ context, data }) => K.collectKnowledgeChat(context, data));
