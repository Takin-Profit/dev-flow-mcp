/**
 * Zod Validation Schemas for DevFlow MCP
 *
 * This module provides runtime validation using Zod for all core types.
 * It replaces the previous arktype-based validation with a more widely-adopted solution.
 *
 * ## Migration from ArkType
 *
 * This file provides Zod equivalents for all arktype schemas:
 * - EntityName (from shared.ts)
 * - Observation (from shared.ts)
 * - Entity (from entity.ts)
 * - Relation (from relation.ts)
 *
 * All validation rules remain identical to maintain compatibility.
 */

import { z } from "#config"

/**
 * Constants for validation rules
 */
export const VALIDATION_CONSTANTS = {
  /** Maximum length for entity names */
  MAX_ENTITY_NAME_LENGTH: 200,

  /** Maximum length for observation strings */
  MAX_OBSERVATION_LENGTH: 5000,

  /** Maximum vector dimensions for embeddings */
  MAX_VECTOR_DIMENSIONS: 10_000,

  /** Valid entity name pattern: starts with letter/underscore, then alphanumeric + _ or - */
  ENTITY_NAME_PATTERN: /^[a-zA-Z_][a-zA-Z0-9_-]*$/,
} as const

/**
 * Primitive Types
 *
 * These types prevent mixing up similar primitive values (e.g., timestamp vs version number).
 * Zod's schemas provide validation for these primitive types.
 */

/**
 * Unix timestamp in milliseconds
 * Must be a non-negative integer
 */
export const TimestampSchema = z.number().int().nonnegative()
export type Timestamp = z.infer<typeof TimestampSchema>

/**
 * Version number (1-based)
 * Must be a positive integer
 */
export const VersionSchema = z.number().int().positive()
export type Version = z.infer<typeof VersionSchema>

/**
 * Confidence score (0.0 to 1.0)
 * Represents certainty or confidence in a relation or classification
 */
export const ConfidenceScoreSchema = z.number().min(0).max(1)
export type ConfidenceScore = z.infer<typeof ConfidenceScoreSchema>

/**
 * Strength score (0.0 to 1.0)
 * Represents intensity or importance of a relation
 */
export const StrengthScoreSchema = z.number().min(0).max(1)
export type StrengthScore = z.infer<typeof StrengthScoreSchema>

/**
 * UUID-based entity identifier
 */
export const EntityIdSchema = z.uuidv4()
export type EntityId = z.infer<typeof EntityIdSchema>

/**
 * Relation identifier
 * Format: "{from}_{relationType}_{to}"
 */
export const RelationIdSchema = z.string()
export type RelationId = z.infer<typeof RelationIdSchema>

/**
 * Character offset in a string
 * Must be a non-negative integer
 */
export const CharacterOffsetSchema = z.number().int().nonnegative()
export type CharacterOffset = z.infer<typeof CharacterOffsetSchema>

/**
 * A field name in an entity
 */
export const EntityFieldSchema = z.string()
export type EntityField = z.infer<typeof EntityFieldSchema>

/**
 * A count of items
 * Must be a non-negative integer
 */
export const CountSchema = z.number().int().nonnegative()
export type Count = z.infer<typeof CountSchema>

/**
 * A duration in milliseconds
 * Must be a non-negative integer
 */
export const DurationSchema = z.number().int().nonnegative()
export type Duration = z.infer<typeof DurationSchema>

/**
 * A priority value for job processing
 * Must be an integer
 */
export const PrioritySchema = z.number().int()
export type Priority = z.infer<typeof PrioritySchema>

/**
 * A batch size for processing operations
 * Must be a positive integer
 */
export const BatchSizeSchema = z.number().int().positive()
export type BatchSize = z.infer<typeof BatchSizeSchema>

/**
 * A job identifier (UUID)
 */
export const JobIdSchema = z.uuidv4()
export type JobId = z.infer<typeof JobIdSchema>

/**
 * Entity Name Schema
 *
 * Rules:
 * - Must be non-empty strings (1-200 characters)
 * - Allowed characters: letters (a-z, A-Z), numbers (0-9), underscores (_), hyphens (-)
 * - Must start with a letter or underscore (not a number or hyphen)
 * - No spaces or special characters allowed
 *
 * Examples:
 * - ✅ Valid: "UserService", "user_repository", "Auth-Module", "_internal"
 * - ❌ Invalid: "User Service" (space), "123user" (starts with number), "user@service" (special char)
 */
export const EntityNameSchema = z
  .string()
  .min(1, "Entity name cannot be empty")
  .max(
    VALIDATION_CONSTANTS.MAX_ENTITY_NAME_LENGTH,
    `Entity name cannot exceed ${VALIDATION_CONSTANTS.MAX_ENTITY_NAME_LENGTH} characters`
  )
  .regex(
    VALIDATION_CONSTANTS.ENTITY_NAME_PATTERN,
    "Entity name must start with a letter or underscore, followed by alphanumeric characters, underscores, or hyphens"
  )

export type EntityName = z.infer<typeof EntityNameSchema>

/**
 * Observation Schema
 *
 * Rules:
 * - Must be non-empty strings
 * - Maximum length: 5000 characters
 * - Used to store atomic facts or notes about entities
 */
export const ObservationSchema = z
  .string()
  .min(1, "Observation cannot be empty")
  .max(
    VALIDATION_CONSTANTS.MAX_OBSERVATION_LENGTH,
    `Observation cannot exceed ${VALIDATION_CONSTANTS.MAX_OBSERVATION_LENGTH} characters`
  )

export type Observation = z.infer<typeof ObservationSchema>

/**
 * Entity Type Schema
 *
 * Defines the semantic category of an entity:
 * - "feature": A product feature or capability
 * - "task": A work item or action item
 * - "decision": An architectural or design decision
 * - "component": A code component, module, or service
 * - "test": A test suite or test case
 */
export const EntityTypeSchema = z.enum([
  "feature",
  "task",
  "decision",
  "component",
  "test",
])

export type EntityType = z.infer<typeof EntityTypeSchema>

/**
 * Relation Type Schema
 *
 * Defines valid relationship types between entities:
 * - "implements": Entity implements or fulfills another entity
 * - "depends_on": Entity has a dependency on another entity
 * - "relates_to": General association between entities
 * - "part_of": Entity is a component or part of another entity
 */
export const RelationTypeSchema = z.enum([
  "implements",
  "depends_on",
  "relates_to",
  "part_of",
])

export type RelationType = z.infer<typeof RelationTypeSchema>

/**
 * Entity Embedding Schema
 *
 * Represents a semantic embedding vector for an entity:
 * - vector: Array of finite numbers (1-10000 dimensions)
 * - model: Identifier of the embedding model used
 * - lastUpdated: Unix timestamp in milliseconds
 */
export const EntityEmbeddingSchema = z
  .object({
    vector: z
      .array(z.number())
      .min(1, "Vector must have at least 1 dimension")
      .max(
        VALIDATION_CONSTANTS.MAX_VECTOR_DIMENSIONS,
        `Vector cannot exceed ${VALIDATION_CONSTANTS.MAX_VECTOR_DIMENSIONS} dimensions`
      ),
    model: z.string().min(1, "Model identifier cannot be empty"),
    lastUpdated: TimestampSchema,
  })
  .strict()

export type EntityEmbedding = z.infer<typeof EntityEmbeddingSchema>

/**
 * Entity Schema
 *
 * Core entity in the knowledge graph:
 * - name: Unique identifier (validated EntityName)
 * - entityType: Semantic category
 * - observations: Array of facts or notes
 * - embedding: Optional semantic embedding vector
 */
export const EntitySchema = z
  .object({
    name: EntityNameSchema,
    entityType: EntityTypeSchema,
    observations: z.array(ObservationSchema),
    embedding: EntityEmbeddingSchema.optional(),
  })
  .strict()

export type Entity = z.infer<typeof EntitySchema>

/**
 * Relation Metadata Schema
 *
 * Additional context for relations:
 * - createdAt: Unix timestamp when relation was created
 * - updatedAt: Unix timestamp of last update (must be >= createdAt)
 * - inferredFrom: Optional array of relation IDs this was derived from
 * - lastAccessed: Optional Unix timestamp of last access
 */
export const RelationMetadataSchema = z
  .object({
    createdAt: TimestampSchema,
    updatedAt: TimestampSchema,
    inferredFrom: z.array(RelationIdSchema).optional(),
    lastAccessed: TimestampSchema.optional(),
  })
  .strict()
  .refine((data) => data.updatedAt >= data.createdAt, {
    message: "updatedAt must be greater than or equal to createdAt",
    path: ["updatedAt"],
  })

export type RelationMetadata = z.infer<typeof RelationMetadataSchema>

/**
 * Relation Schema
 *
 * Represents a relationship between two entities:
 * - from: Source entity name
 * - to: Target entity name (must be different from source)
 * - relationType: Type of relationship
 * - strength: Optional intensity/importance (0.0 - 1.0)
 * - confidence: Optional certainty about the relationship (0.0 - 1.0)
 * - metadata: Optional additional context
 */
export const RelationSchema = z
  .object({
    from: EntityNameSchema,
    to: EntityNameSchema,
    relationType: RelationTypeSchema,
    strength: StrengthScoreSchema.optional(),
    confidence: ConfidenceScoreSchema.optional(),
    metadata: RelationMetadataSchema.optional(),
  })
  .strict()
  .refine((data) => data.from !== data.to, {
    message:
      "Relation cannot connect an entity to itself (from must differ from to)",
    path: ["to"],
  })

export type Relation = z.infer<typeof RelationSchema>

/**
 * Temporal Entity Schema
 *
 * Extended entity with temporal versioning metadata:
 * - All Entity fields
 * - version: Version number (1-based)
 * - createdAt: Unix timestamp of creation
 * - updatedAt: Unix timestamp of last update
 * - validFrom: Optional timestamp when this version became valid
 * - validTo: Optional timestamp when this version was superseded (null = current)
 * - changedBy: Optional identifier of who made the change
 */
export const TemporalEntitySchema = EntitySchema.extend({
  id: EntityIdSchema.optional(),
  version: VersionSchema,
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
  validFrom: TimestampSchema.optional(),
  validTo: TimestampSchema.nullable().optional(),
  changedBy: z.string().nullable().optional(),
}).refine((data) => data.updatedAt >= data.createdAt, {
  message: "updatedAt must be greater than or equal to createdAt",
  path: ["updatedAt"],
})

export type TemporalEntity = z.infer<typeof TemporalEntitySchema>

/**
 * Knowledge Graph Schema
 *
 * A collection of entities and their relationships:
 * - entities: Array of entities
 * - relations: Array of relations between entities
 */
export const KnowledgeGraphSchema = z.object({
  entities: z.array(EntitySchema),
  relations: z.array(RelationSchema),
})

export type KnowledgeGraph = z.infer<typeof KnowledgeGraphSchema>

/**
 * Validators - Utility functions for validation
 *
 * Provides type guards and validation helpers compatible with the existing arktype-based API
 */
export const Validators = Object.freeze({
  /**
   * Validate entity name
   */
  entityName: (value: unknown): value is EntityName =>
    EntityNameSchema.safeParse(value).success,

  /**
   * Validate observation string
   */
  observation: (value: unknown): value is Observation =>
    ObservationSchema.safeParse(value).success,

  /**
   * Validate entity
   */
  entity: (value: unknown): value is Entity =>
    EntitySchema.safeParse(value).success,

  /**
   * Validate relation
   */
  relation: (value: unknown): value is Relation =>
    RelationSchema.safeParse(value).success,

  /**
   * Validate temporal entity
   */
  temporalEntity: (value: unknown): value is TemporalEntity =>
    TemporalEntitySchema.safeParse(value).success,

  /**
   * Validate knowledge graph
   */
  knowledgeGraph: (value: unknown): value is KnowledgeGraph =>
    KnowledgeGraphSchema.safeParse(value).success,

  /**
   * Parse and validate entity name (throws on invalid)
   */
  parseEntityName: (value: unknown): EntityName =>
    EntityNameSchema.parse(value),

  /**
   * Parse and validate entity (throws on invalid)
   */
  parseEntity: (value: unknown): Entity => EntitySchema.parse(value),

  /**
   * Parse and validate relation (throws on invalid)
   */
  parseRelation: (value: unknown): Relation => RelationSchema.parse(value),

  /**
   * Parse and validate knowledge graph (throws on invalid)
   */
  parseKnowledgeGraph: (value: unknown): KnowledgeGraph =>
    KnowledgeGraphSchema.parse(value),
})

/**
 * Export all schemas for external use
 */
export const Schemas = Object.freeze({
  EntityName: EntityNameSchema,
  Observation: ObservationSchema,
  EntityType: EntityTypeSchema,
  RelationType: RelationTypeSchema,
  EntityEmbedding: EntityEmbeddingSchema,
  Entity: EntitySchema,
  RelationMetadata: RelationMetadataSchema,
  Relation: RelationSchema,
  TemporalEntity: TemporalEntitySchema,
  KnowledgeGraph: KnowledgeGraphSchema,
})

/**
 * ============================================================================
 * Tool Input Schemas
 * ============================================================================
 *
 * These schemas validate the input parameters for MCP tool handlers.
 * Each schema corresponds to a tool defined in list-tools-handler.ts
 */

/**
 * create_entities tool input
 */
export const CreateEntitiesInputSchema = z
  .object({
    entities: z.array(EntitySchema).min(1, "Must provide at least one entity"),
  })
  .strict()

export type CreateEntitiesInput = z.infer<typeof CreateEntitiesInputSchema>

/**
 * delete_entities tool input
 */
export const DeleteEntitiesInputSchema = z
  .object({
    entityNames: z
      .array(EntityNameSchema)
      .min(1, "Must provide at least one entity name"),
  })
  .strict()

export type DeleteEntitiesInput = z.infer<typeof DeleteEntitiesInputSchema>

/**
 * add_observations tool input
 */
export const AddObservationsInputSchema = z
  .object({
    entityName: EntityNameSchema,
    contents: z
      .array(ObservationSchema)
      .min(1, "Must provide at least one observation"),
  })
  .strict()

export type AddObservationsInput = z.infer<typeof AddObservationsInputSchema>

/**
 * delete_observations tool input
 */
export const DeleteObservationsInputSchema = z
  .object({
    deletions: z
      .array(
        z.object({
          entityName: EntityNameSchema,
          observations: z.array(ObservationSchema).min(1),
        })
      )
      .min(1, "Must provide at least one deletion"),
  })
  .strict()

export type DeleteObservationsInput = z.infer<
  typeof DeleteObservationsInputSchema
>

/**
 * create_relations tool input
 */
export const CreateRelationsInputSchema = z
  .object({
    relations: z
      .array(RelationSchema)
      .min(1, "Must provide at least one relation"),
  })
  .strict()

export type CreateRelationsInput = z.infer<typeof CreateRelationsInputSchema>

/**
 * delete_relations tool input
 */
export const DeleteRelationsInputSchema = z
  .object({
    relations: z
      .array(RelationSchema)
      .min(1, "Must provide at least one relation"),
  })
  .strict()

export type DeleteRelationsInput = z.infer<typeof DeleteRelationsInputSchema>

/**
 * search_nodes tool input
 */
export const SearchNodesInputSchema = z
  .object({
    query: z.string().min(1, "Search query cannot be empty"),
  })
  .strict()

export type SearchNodesInput = z.infer<typeof SearchNodesInputSchema>

/**
 * semantic_search tool input
 */
export const SemanticSearchInputSchema = z
  .object({
    query: z.string().min(1, "Search query cannot be empty"),
    limit: z.number().int().positive().optional(),
    minSimilarity: ConfidenceScoreSchema.optional(),
    entityTypes: z.array(EntityTypeSchema).optional(),
    hybridSearch: z.boolean().optional(),
    semanticWeight: z.number().min(0).max(1).optional(),
  })
  .strict()

export type SemanticSearchInput = z.infer<typeof SemanticSearchInputSchema>

/**
 * get_relation tool input
 */
export const GetRelationInputSchema = z
  .object({
    from: EntityNameSchema,
    to: EntityNameSchema,
    relationType: RelationTypeSchema,
  })
  .strict()

export type GetRelationInput = z.infer<typeof GetRelationInputSchema>

/**
 * update_relation tool input
 */
export const UpdateRelationInputSchema = z
  .object({
    from: EntityNameSchema,
    to: EntityNameSchema,
    relationType: RelationTypeSchema,
    strength: StrengthScoreSchema.optional(),
    confidence: ConfidenceScoreSchema.optional(),
    metadata: RelationMetadataSchema.optional(),
  })
  .strict()

export type UpdateRelationInput = z.infer<typeof UpdateRelationInputSchema>

/**
 * open_nodes tool input
 */
export const OpenNodesInputSchema = z
  .object({
    names: z
      .array(EntityNameSchema)
      .min(1, "Must provide at least one entity name"),
  })
  .strict()

export type OpenNodesInput = z.infer<typeof OpenNodesInputSchema>

/**
 * get_entity_history tool input
 */
export const GetEntityHistoryInputSchema = z
  .object({
    entityName: EntityNameSchema,
  })
  .strict()

export type GetEntityHistoryInput = z.infer<typeof GetEntityHistoryInputSchema>

/**
 * get_relation_history tool input
 */
export const GetRelationHistoryInputSchema = z
  .object({
    from: EntityNameSchema,
    to: EntityNameSchema,
    relationType: RelationTypeSchema,
  })
  .strict()

export type GetRelationHistoryInput = z.infer<
  typeof GetRelationHistoryInputSchema
>

/**
 * get_graph_at_time tool input
 */
export const GetGraphAtTimeInputSchema = z
  .object({
    timestamp: TimestampSchema,
  })
  .strict()

export type GetGraphAtTimeInput = z.infer<typeof GetGraphAtTimeInputSchema>

/**
 * get_entity_embedding tool input
 */
export const GetEntityEmbeddingInputSchema = z
  .object({
    entityName: EntityNameSchema,
  })
  .strict()

export type GetEntityEmbeddingInput = z.infer<
  typeof GetEntityEmbeddingInputSchema
>

/**
 * read_graph tool has no parameters (empty object)
 */
export const ReadGraphInputSchema = z.object({}).strict()

export type ReadGraphInput = z.infer<typeof ReadGraphInputSchema>

/**
 * get_decayed_graph tool has no parameters (empty object)
 */
export const GetDecayedGraphInputSchema = z.object({}).strict()

export type GetDecayedGraphInput = z.infer<typeof GetDecayedGraphInputSchema>

/**
 * ============================================================================
 * Tool Output Schemas
 * ============================================================================
 *
 * Output schemas define the expected structure of tool responses.
 * These schemas enable:
 * - Runtime validation of handler outputs
 * - Type-safe response construction
 * - Early detection of implementation errors
 * - Better documentation and DX
 */

/**
 * create_entities output
 */
export const CreateEntitiesOutputSchema = z.object({
  created: z.number().int().nonnegative(),
  entities: z.array(EntitySchema),
})

export type CreateEntitiesOutput = z.infer<typeof CreateEntitiesOutputSchema>

/**
 * delete_entities output
 */
export const DeleteEntitiesOutputSchema = z.object({
  deleted: z.number().int().nonnegative(),
  entityNames: z.array(EntityNameSchema),
})

export type DeleteEntitiesOutput = z.infer<typeof DeleteEntitiesOutputSchema>

/**
 * read_graph output
 */
export const ReadGraphOutputSchema = KnowledgeGraphSchema

export type ReadGraphOutput = z.infer<typeof ReadGraphOutputSchema>

/**
 * create_relations output
 */
export const CreateRelationsOutputSchema = z.object({
  created: z.number().int().nonnegative(),
  relations: z.array(RelationSchema),
})

export type CreateRelationsOutput = z.infer<typeof CreateRelationsOutputSchema>

/**
 * add_observations output
 */
export const AddObservationsOutputSchema = z.object({
  entityName: EntityNameSchema,
  added: z.number().int().nonnegative(),
  totalObservations: z.number().int().nonnegative(),
})

export type AddObservationsOutput = z.infer<typeof AddObservationsOutputSchema>

/**
 * delete_observations output
 */
export const DeleteObservationsOutputSchema = z.object({
  deleted: z.number().int().nonnegative(),
  entities: z.array(
    z.object({
      entityName: EntityNameSchema,
      deletedCount: z.number().int().nonnegative(),
    })
  ),
})

export type DeleteObservationsOutput = z.infer<
  typeof DeleteObservationsOutputSchema
>

/**
 * delete_relations output
 */
export const DeleteRelationsOutputSchema = z.object({
  deleted: z.number().int().nonnegative(),
})

export type DeleteRelationsOutput = z.infer<typeof DeleteRelationsOutputSchema>

/**
 * get_relation output (can be null if not found)
 */
export const GetRelationOutputSchema = RelationSchema.nullable()

export type GetRelationOutput = z.infer<typeof GetRelationOutputSchema>

/**
 * update_relation output
 */
export const UpdateRelationOutputSchema = RelationSchema

export type UpdateRelationOutput = z.infer<typeof UpdateRelationOutputSchema>

/**
 * search_nodes output
 */
export const SearchNodesOutputSchema = z.object({
  results: z.array(EntitySchema),
  count: z.number().int().nonnegative(),
})

export type SearchNodesOutput = z.infer<typeof SearchNodesOutputSchema>

/**
 * open_nodes output
 */
export const OpenNodesOutputSchema = z.object({
  nodes: z.array(EntitySchema),
  found: z.number().int().nonnegative(),
  notFound: z.array(EntityNameSchema),
})

export type OpenNodesOutput = z.infer<typeof OpenNodesOutputSchema>

/**
 * get_entity_history output
 */
export const GetEntityHistoryOutputSchema = z.object({
  entityName: EntityNameSchema,
  history: z.array(TemporalEntitySchema),
  totalVersions: z.number().int().positive(),
})

export type GetEntityHistoryOutput = z.infer<
  typeof GetEntityHistoryOutputSchema
>

/**
 * get_relation_history output
 */
export const GetRelationHistoryOutputSchema = z.object({
  from: EntityNameSchema,
  to: EntityNameSchema,
  relationType: RelationTypeSchema,
  history: z.array(TemporalEntitySchema),
  totalVersions: z.number().int().positive(),
})

export type GetRelationHistoryOutput = z.infer<
  typeof GetRelationHistoryOutputSchema
>

/**
 * get_graph_at_time output
 */
export const GetGraphAtTimeOutputSchema = z.object({
  timestamp: TimestampSchema,
  graph: KnowledgeGraphSchema,
})

export type GetGraphAtTimeOutput = z.infer<typeof GetGraphAtTimeOutputSchema>

/**
 * get_decayed_graph output
 */
export const GetDecayedGraphOutputSchema = KnowledgeGraphSchema

export type GetDecayedGraphOutput = z.infer<typeof GetDecayedGraphOutputSchema>

/**
 * semantic_search output
 */
export const SemanticSearchOutputSchema = z.object({
  results: z.array(
    z.object({
      entity: EntitySchema,
      similarity: z.number().min(0).max(1),
    })
  ),
  count: z.number().int().nonnegative(),
})

export type SemanticSearchOutput = z.infer<typeof SemanticSearchOutputSchema>

/**
 * get_entity_embedding output
 */
export const GetEntityEmbeddingOutputSchema = z.object({
  entityName: EntityNameSchema,
  embedding: z.array(z.number()).min(1),
  model: z.string().min(1, "Model identifier cannot be empty"),
})

export type GetEntityEmbeddingOutput = z.infer<
  typeof GetEntityEmbeddingOutputSchema
>

/**
 * Relation validator utilities using Zod
 */
export const RelationValidator = Object.freeze({
  /**
   * Type guard: validates if data is a Relation
   */
  isRelation(data: unknown): data is Relation {
    return RelationSchema.safeParse(data).success
  },

  /**
   * Validates if data conforms to Relation schema
   */
  validateRelation(data: unknown) {
    return RelationSchema.safeParse(data)
  },
})

// ============================================================================
// MCP Protocol Types
// ============================================================================

/**
 * Standard MCP Tool Response envelope
 * Matches MCP specification with isError and structuredContent
 */
export const MCPToolResponseSchema = z.object({
  content: z.array(
    z.object({
      type: z.literal("text"),
      text: z.string(),
    })
  ),
  isError: z.boolean().optional(),
  structuredContent: z.record(z.string(), z.unknown()).optional(),
})

export type MCPToolResponse = z.infer<typeof MCPToolResponseSchema>
