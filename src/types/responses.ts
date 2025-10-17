/**
 * MCP Tool Response Schemas
 *
 * Standardized, validated response formats using Zod.
 * All responses use branded types for runtime validation.
 */

import { z } from "#config"
import {
  EntityNameSchema,
  EntitySchema,
  KnowledgeGraphSchema,
  RelationSchema,
  TemporalEntitySchema,
  TimestampSchema,
} from "#types/validation"

/**
 * Standard MCP Tool Response envelope
 * Updated to match MCP specification with isError and structuredContent
 */
export const MCPToolResponseSchema = z.object({
  content: z.array(
    z.object({
      type: z.literal("text"),
      text: z.string(),
    })
  ),
  isError: z.boolean().optional(),
  structuredContent: z.record(z.unknown()).optional(),
})

export type MCPToolResponse = z.infer<typeof MCPToolResponseSchema>

/**
 * Standardized error codes
 */
export enum ErrorCode {
  // Validation errors (4xx equivalent)
  INVALID_INPUT = "INVALID_INPUT",
  INVALID_ENTITY_NAME = "INVALID_ENTITY_NAME",
  INVALID_ENTITY_TYPE = "INVALID_ENTITY_TYPE",
  INVALID_RELATION_TYPE = "INVALID_RELATION_TYPE",
  INVALID_OBSERVATIONS = "INVALID_OBSERVATIONS",
  INVALID_STRENGTH = "INVALID_STRENGTH",
  INVALID_CONFIDENCE = "INVALID_CONFIDENCE",
  EMPTY_ARRAY = "EMPTY_ARRAY",

  // Not found errors (404 equivalent)
  ENTITY_NOT_FOUND = "ENTITY_NOT_FOUND",
  RELATION_NOT_FOUND = "RELATION_NOT_FOUND",

  // Conflict errors (409 equivalent)
  ENTITY_ALREADY_EXISTS = "ENTITY_ALREADY_EXISTS",
  RELATION_ALREADY_EXISTS = "RELATION_ALREADY_EXISTS",

  // Internal errors (5xx equivalent)
  DATABASE_ERROR = "DATABASE_ERROR",
  EMBEDDING_ERROR = "EMBEDDING_ERROR",
  INTERNAL_ERROR = "INTERNAL_ERROR",
}

/**
 * Success response schema (generic)
 */
export function createSuccessResponseSchema<T extends z.ZodTypeAny>(
  dataSchema: T
) {
  return z.object({
    success: z.literal(true),
    data: dataSchema,
  })
}

/**
 * ============================================================================
 * Tool-Specific Response Schemas
 * ============================================================================
 */

/**
 * create_entities response
 */
export const CreateEntitiesResponseSchema = createSuccessResponseSchema(
  z.object({
    created: z.number().int().nonnegative(),
    entities: z.array(EntitySchema),
  })
)
export type CreateEntitiesResponse = z.infer<
  typeof CreateEntitiesResponseSchema
>

/**
 * delete_entities response
 */
export const DeleteEntitiesResponseSchema = createSuccessResponseSchema(
  z.object({
    deleted: z.number().int().nonnegative(),
    entityNames: z.array(EntityNameSchema),
  })
)
export type DeleteEntitiesResponse = z.infer<
  typeof DeleteEntitiesResponseSchema
>

/**
 * read_graph response
 */
export const ReadGraphResponseSchema =
  createSuccessResponseSchema(KnowledgeGraphSchema)
export type ReadGraphResponse = z.infer<typeof ReadGraphResponseSchema>

/**
 * add_observations response
 */
export const AddObservationsResponseSchema = createSuccessResponseSchema(
  z.object({
    entityName: EntityNameSchema,
    added: z.number().int().nonnegative(),
    totalObservations: z.number().int().nonnegative(),
  })
)
export type AddObservationsResponse = z.infer<
  typeof AddObservationsResponseSchema
>

/**
 * delete_observations response
 */
export const DeleteObservationsResponseSchema = createSuccessResponseSchema(
  z.object({
    deleted: z.number().int().nonnegative(),
    entities: z.array(
      z.object({
        entityName: EntityNameSchema,
        deletedCount: z.number().int().nonnegative(),
      })
    ),
  })
)
export type DeleteObservationsResponse = z.infer<
  typeof DeleteObservationsResponseSchema
>

/**
 * create_relations response
 */
export const CreateRelationsResponseSchema = createSuccessResponseSchema(
  z.object({
    created: z.number().int().nonnegative(),
    relations: z.array(RelationSchema),
  })
)
export type CreateRelationsResponse = z.infer<
  typeof CreateRelationsResponseSchema
>

/**
 * delete_relations response
 */
export const DeleteRelationsResponseSchema = createSuccessResponseSchema(
  z.object({
    deleted: z.number().int().nonnegative(),
  })
)
export type DeleteRelationsResponse = z.infer<
  typeof DeleteRelationsResponseSchema
>

/**
 * search_nodes response
 */
export const SearchNodesResponseSchema = createSuccessResponseSchema(
  z.object({
    results: z.array(EntitySchema),
    count: z.number().int().nonnegative(),
  })
)
export type SearchNodesResponse = z.infer<typeof SearchNodesResponseSchema>

/**
 * semantic_search response
 */
export const SemanticSearchResponseSchema = createSuccessResponseSchema(
  z.object({
    results: z.array(
      z.object({
        entity: EntitySchema,
        similarity: z.number().min(0).max(1),
      })
    ),
    count: z.number().int().nonnegative(),
  })
)
export type SemanticSearchResponse = z.infer<
  typeof SemanticSearchResponseSchema
>

/**
 * get_relation response
 */
export const GetRelationResponseSchema = createSuccessResponseSchema(
  RelationSchema.nullable()
)
export type GetRelationResponse = z.infer<typeof GetRelationResponseSchema>

/**
 * update_relation response
 */
export const UpdateRelationResponseSchema =
  createSuccessResponseSchema(RelationSchema)
export type UpdateRelationResponse = z.infer<
  typeof UpdateRelationResponseSchema
>

/**
 * open_nodes response
 */
export const OpenNodesResponseSchema = createSuccessResponseSchema(
  z.object({
    nodes: z.array(EntitySchema),
    found: z.number().int().nonnegative(),
    notFound: z.array(EntityNameSchema),
  })
)
export type OpenNodesResponse = z.infer<typeof OpenNodesResponseSchema>

/**
 * get_entity_history response
 */
export const GetEntityHistoryResponseSchema = createSuccessResponseSchema(
  z.object({
    entityName: EntityNameSchema,
    history: z.array(TemporalEntitySchema),
    totalVersions: z.number().int().positive(),
  })
)
export type GetEntityHistoryResponse = z.infer<
  typeof GetEntityHistoryResponseSchema
>

/**
 * get_relation_history response
 */
export const GetRelationHistoryResponseSchema = createSuccessResponseSchema(
  z.object({
    from: EntityNameSchema,
    to: EntityNameSchema,
    relationType: z.string().min(1),
    history: z.array(TemporalEntitySchema),
    totalVersions: z.number().int().positive(),
  })
)
export type GetRelationHistoryResponse = z.infer<
  typeof GetRelationHistoryResponseSchema
>

/**
 * get_graph_at_time response
 */
export const GetGraphAtTimeResponseSchema = createSuccessResponseSchema(
  z.object({
    timestamp: TimestampSchema,
    graph: KnowledgeGraphSchema,
  })
)
export type GetGraphAtTimeResponse = z.infer<
  typeof GetGraphAtTimeResponseSchema
>

/**
 * get_decayed_graph response
 */
export const GetDecayedGraphResponseSchema =
  createSuccessResponseSchema(KnowledgeGraphSchema)
export type GetDecayedGraphResponse = z.infer<
  typeof GetDecayedGraphResponseSchema
>

/**
 * get_entity_embedding response
 */
export const GetEntityEmbeddingResponseSchema = createSuccessResponseSchema(
  z.object({
    entityName: EntityNameSchema,
    embedding: z.array(z.number().finite()).min(1),
    model: z.string().min(1, "Model identifier cannot be empty"),
  })
)
export type GetEntityEmbeddingResponse = z.infer<
  typeof GetEntityEmbeddingResponseSchema
>
