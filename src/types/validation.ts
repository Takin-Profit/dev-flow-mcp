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

import { z } from "zod"

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
  .brand<"EntityName">()

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
      .array(z.number().finite())
      .min(1, "Vector must have at least 1 dimension")
      .max(
        VALIDATION_CONSTANTS.MAX_VECTOR_DIMENSIONS,
        `Vector cannot exceed ${VALIDATION_CONSTANTS.MAX_VECTOR_DIMENSIONS} dimensions`
      ),
    model: z.string().min(1, "Model identifier cannot be empty"),
    lastUpdated: z.number().int().nonnegative(),
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
    createdAt: z.number().int().nonnegative(),
    updatedAt: z.number().int().nonnegative(),
    inferredFrom: z.array(z.string()).optional(),
    lastAccessed: z.number().int().nonnegative().optional(),
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
    strength: z.number().min(0).max(1).optional(),
    confidence: z.number().min(0).max(1).optional(),
    metadata: RelationMetadataSchema.optional(),
  })
  .strict()
  .refine((data) => data.from !== data.to, {
    message: "Relation cannot connect an entity to itself (from must differ from to)",
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
  id: z.string().optional(),
  version: z.number().int().positive(),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
  validFrom: z.number().int().nonnegative().optional(),
  validTo: z.number().int().nonnegative().nullable().optional(),
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
  entityName: (value: unknown): value is EntityName => {
    return EntityNameSchema.safeParse(value).success
  },

  /**
   * Validate observation string
   */
  observation: (value: unknown): value is Observation => {
    return ObservationSchema.safeParse(value).success
  },

  /**
   * Validate entity
   */
  entity: (value: unknown): value is Entity => {
    return EntitySchema.safeParse(value).success
  },

  /**
   * Validate relation
   */
  relation: (value: unknown): value is Relation => {
    return RelationSchema.safeParse(value).success
  },

  /**
   * Validate temporal entity
   */
  temporalEntity: (value: unknown): value is TemporalEntity => {
    return TemporalEntitySchema.safeParse(value).success
  },

  /**
   * Validate knowledge graph
   */
  knowledgeGraph: (value: unknown): value is KnowledgeGraph => {
    return KnowledgeGraphSchema.safeParse(value).success
  },

  /**
   * Parse and validate entity name (throws on invalid)
   */
  parseEntityName: (value: unknown): EntityName => {
    return EntityNameSchema.parse(value)
  },

  /**
   * Parse and validate entity (throws on invalid)
   */
  parseEntity: (value: unknown): Entity => {
    return EntitySchema.parse(value)
  },

  /**
   * Parse and validate relation (throws on invalid)
   */
  parseRelation: (value: unknown): Relation => {
    return RelationSchema.parse(value)
  },

  /**
   * Parse and validate knowledge graph (throws on invalid)
   */
  parseKnowledgeGraph: (value: unknown): KnowledgeGraph => {
    return KnowledgeGraphSchema.parse(value)
  },
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
